import mongoose from "mongoose";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import SalesInvoice from "../../sales/salesInvoice/salesInvoice.model.js";
import PurchaseInvoice from "../../purchase/purchaseInvoice/purchaseInvoice.model.js";
import SalesReturn from "../../sales/salesReturn/salesReturn.model.js";
import PurchaseReturn from "../../purchase/purchaseReturn/purchaseReturn.model.js";
import ReceiptPayment from "../../receipt-payment/receiptPayment.model.js";
import Expense from "../../expense/expense.model.js";
import Stock from "../../stock/stock.model.js";
import Item from "../../masters/item/item.model.js";
import Customer from "../../masters/customer/customer.model.js";
import "../../masters/itemCategory/itemCategory.model.js";

const LOW_STOCK_THRESHOLD = 10;

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

const buildCompanyFilter = (req, extra = {}) => ({
  companyId: toObjectId(req.companyId),
  financialYearId: toObjectId(req.fyId),
  isActive: { $ne: false },
  ...extra,
});

const sumAmount = async (Model, amountField, filter) => {
  const rows = await Model.find(filter).select(amountField).lean();
  return Number(
    rows.reduce((sum, row) => sum + Number(row[amountField] || 0), 0).toFixed(2)
  );
};

const formatMonthLabel = (key) => {
  if (!key) return "N/A";
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-IN", {
    month: "short",
    year: "2-digit",
  });
};

const aggregateMonthlyTrend = async (Model, dateField, filter, amountField = "grandTotal") => {
  const { companyId, financialYearId, status, ...rest } = filter;
  const match = {
    companyId,
    financialYearId,
    isActive: { $ne: false },
    [dateField]: { $type: "date" },
    ...rest,
  };
  if (status !== undefined) match.status = status;

  const rows = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: `$${dateField}` } },
        total: { $sum: `$${amountField}` },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows
    .filter((row) => row._id)
    .map((row) => ({
      key: row._id,
      label: formatMonthLabel(row._id),
      value: Number((row.total / 1000).toFixed(2)),
    }));
};

const mergeTrend = (salesRows, purchaseRows) => {
  const keys = [
    ...new Set([...salesRows.map((row) => row.key), ...purchaseRows.map((row) => row.key)]),
  ].sort();

  const salesMap = Object.fromEntries(salesRows.map((row) => [row.key, row]));
  const purchaseMap = Object.fromEntries(purchaseRows.map((row) => [row.key, row]));

  return keys.map((key) => ({
    month: salesMap[key]?.label || purchaseMap[key]?.label || key,
    sales: salesMap[key]?.value || 0,
    purchase: purchaseMap[key]?.value || 0,
  }));
};

const mergeDualTrend = (leftRows, rightRows, leftKey, rightKey) => {
  const keys = [
    ...new Set([...leftRows.map((row) => row.key), ...rightRows.map((row) => row.key)]),
  ].sort();

  const leftMap = Object.fromEntries(leftRows.map((row) => [row.key, row]));
  const rightMap = Object.fromEntries(rightRows.map((row) => [row.key, row]));

  return keys.map((key) => ({
    month: leftMap[key]?.label || rightMap[key]?.label || key,
    [leftKey]: leftMap[key]?.value || 0,
    [rightKey]: rightMap[key]?.value || 0,
  }));
};

const buildCategoryPercents = (rows) => {
  const total = rows.reduce((sum, row) => sum + row.amount, 0) || 1;
  return rows.map((row) => ({
    ...row,
    percent: Number(((row.amount / total) * 100).toFixed(1)),
  }));
};

export const dashboardReport = asyncHandler(async (req, res) => {
  const invoiceFilter = buildCompanyFilter(req, { status: "confirmed" });
  const voucherFilter = buildCompanyFilter(req, {
    status: { $ne: "cancelled" },
  });
  const expenseFilter = buildCompanyFilter(req, {
    status: { $ne: "cancelled" },
  });
  const returnFilter = buildCompanyFilter(req, { status: "confirmed" });

  const [
    salesTotal,
    purchaseTotal,
    receiptsTotal,
    paymentsTotal,
    expensesTotal,
    salesTrendRows,
    purchaseTrendRows,
    salesReturnTrendRows,
    purchaseReturnTrendRows,
    salesTypeRows,
    paymentStatusRows,
    topSoldRows,
    salesByCategoryRows,
    salesReturnTotal,
    purchaseReturnTotal,
    receiptTrendRows,
    paymentTrendRows,
    expenseByCategoryRows,
    expenseTrendRows,
    recentSales,
    recentPurchases,
    lowStockRows,
    productCount,
    customerCount,
  ] = await Promise.all([
    sumAmount(SalesInvoice, "grandTotal", invoiceFilter),
    sumAmount(PurchaseInvoice, "grandTotal", invoiceFilter),
    sumAmount(ReceiptPayment, "totalAmount", {
      ...voucherFilter,
      voucherType: "receipt",
    }),
    sumAmount(ReceiptPayment, "totalAmount", {
      ...voucherFilter,
      voucherType: "payment",
    }),
    sumAmount(Expense, "amount", expenseFilter),
    aggregateMonthlyTrend(SalesInvoice, "invoiceDate", invoiceFilter),
    aggregateMonthlyTrend(PurchaseInvoice, "purchaseDate", invoiceFilter),
    aggregateMonthlyTrend(SalesReturn, "returnDate", returnFilter),
    aggregateMonthlyTrend(PurchaseReturn, "returnDate", returnFilter),
    SalesInvoice.aggregate([
      { $match: invoiceFilter },
      { $group: { _id: "$salesType", total: { $sum: "$grandTotal" } } },
    ]),
    SalesInvoice.aggregate([
      { $match: invoiceFilter },
      { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
    ]),
    SalesInvoice.aggregate([
      { $match: invoiceFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemId",
          totalQty: { $sum: "$items.qty" },
          totalAmount: { $sum: { $ifNull: ["$items.total", 0] } },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
    ]),
    SalesInvoice.aggregate([
      { $match: invoiceFilter },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "items",
          localField: "items.itemId",
          foreignField: "_id",
          as: "item",
        },
      },
      { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "itemcategories",
          localField: "item.categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$category._id", "uncategorized"] },
          name: { $first: { $ifNull: ["$category.name", "Uncategorized"] } },
          amount: { $sum: { $ifNull: ["$items.total", 0] } },
        },
      },
      { $sort: { amount: -1 } },
      { $limit: 8 },
    ]),
    sumAmount(SalesReturn, "grandTotal", returnFilter),
    sumAmount(PurchaseReturn, "grandTotal", returnFilter),
    aggregateMonthlyTrend(
      ReceiptPayment,
      "date",
      { ...voucherFilter, voucherType: "receipt" },
      "totalAmount"
    ),
    aggregateMonthlyTrend(
      ReceiptPayment,
      "date",
      { ...voucherFilter, voucherType: "payment" },
      "totalAmount"
    ),
    Expense.aggregate([
      { $match: expenseFilter },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
      { $limit: 8 },
    ]),
    aggregateMonthlyTrend(Expense, "date", expenseFilter, "amount"),
    SalesInvoice.find(invoiceFilter)
      .populate("customerId", "name")
      .select("invoiceNo invoiceDate customerId customerSnapshot grandTotal paymentStatus items")
      .sort({ invoiceDate: -1 })
      .limit(5)
      .lean(),
    PurchaseInvoice.find(invoiceFilter)
      .populate("vendorId", "name")
      .select("invoiceNo purchaseDate vendorId vendorSnapshot grandTotal paymentStatus items status")
      .sort({ purchaseDate: -1 })
      .limit(5)
      .lean(),
    Stock.find({
      companyId: invoiceFilter.companyId,
      financialYearId: invoiceFilter.financialYearId,
      qty: { $lte: LOW_STOCK_THRESHOLD },
    })
      .populate("itemId", "name code")
      .sort({ qty: 1 })
      .limit(10)
      .lean(),
    Item.countDocuments({
      companyId: invoiceFilter.companyId,
      isActive: { $ne: false },
    }),
    Customer.countDocuments({
      companyId: invoiceFilter.companyId,
      isActive: { $ne: false },
    }),
  ]);

  const itemIds = topSoldRows.map((row) => row._id).filter(Boolean);
  const items = itemIds.length
    ? await Item.find({ _id: { $in: itemIds } })
        .select("name code")
        .lean()
    : [];
  const itemMap = Object.fromEntries(items.map((item) => [item._id.toString(), item]));

  const retail = salesTypeRows.find((row) => row._id === "retail")?.total || 0;
  const wholesale = salesTypeRows.find((row) => row._id === "wholesale")?.total || 0;
  const salesTypeTotal = retail + wholesale || 1;

  const paid = paymentStatusRows.find((row) => row._id === "paid")?.count || 0;
  const partial = paymentStatusRows.find((row) => row._id === "partial")?.count || 0;
  const pending =
    (paymentStatusRows.find((row) => row._id === "pending")?.count || 0) +
    (paymentStatusRows.find((row) => row._id === "unpaid")?.count || 0);

  const businessMix = buildCategoryPercents(
    [
      { id: "sales", label: "Sales", amount: salesTotal },
      { id: "purchase", label: "Purchase", amount: purchaseTotal },
      { id: "sales_return", label: "Sales Return", amount: salesReturnTotal },
      { id: "purchase_return", label: "Purchase Return", amount: purchaseReturnTotal },
      { id: "expense", label: "Expenses", amount: expensesTotal },
    ].filter((row) => row.amount > 0)
  );

  const expenseByCategory = buildCategoryPercents(
    expenseByCategoryRows.map((row) => ({
      id: String(row._id || "other"),
      label: String(row._id || "Other").replace(/_/g, " "),
      amount: Number((row.amount || 0).toFixed(2)),
    }))
  );

  const salesByCategory = buildCategoryPercents(
    salesByCategoryRows.map((row) => ({
      id: String(row._id),
      label: row.name || "Uncategorized",
      amount: Number((row.amount || 0).toFixed(2)),
    }))
  );

  const cashFlowTrend = mergeTrend(receiptTrendRows, paymentTrendRows).map((row) => ({
    month: row.month,
    receipts: row.sales,
    payments: row.purchase,
  }));

  const expenseTrend = expenseTrendRows.map((row) => ({
    month: row.label,
    amount: row.value,
  }));

  const returnTrend = mergeDualTrend(
    salesReturnTrendRows,
    purchaseReturnTrendRows,
    "salesReturn",
    "purchaseReturn"
  );

  res.json(
    new ApiResponse(200, {
      stats: {
        salesTotal,
        purchaseTotal,
        salesReturnTotal,
        purchaseReturnTotal,
        receiptsTotal,
        paymentsTotal,
        expensesTotal,
        productCount,
        customerCount,
      },
      revenueTrend: mergeTrend(salesTrendRows, purchaseTrendRows),
      returnTrend,
      cashFlowTrend,
      expenseTrend,
      businessMix,
      salesByCategory,
      expenseByCategory,
      salesByType: {
        retail,
        wholesale,
        retailPercent: Number(((retail / salesTypeTotal) * 100).toFixed(1)),
        wholesalePercent: Number(((wholesale / salesTypeTotal) * 100).toFixed(1)),
        total: Number((retail + wholesale).toFixed(2)),
      },
      paymentStatus: { paid, partial, pending, total: paid + partial + pending },
      topSoldProducts: topSoldRows.map((row, index) => ({
        id: row._id?.toString() || String(index),
        rank: index + 1,
        product: itemMap[row._id?.toString()]?.name || "Unknown",
        sku: itemMap[row._id?.toString()]?.code || "-",
        qty: Number(row.totalQty || 0),
        amount: Number((row.totalAmount || 0).toFixed(2)),
      })),
      recentSales: recentSales.map((row) => ({
        id: row._id,
        invoiceNo: row.invoiceNo,
        customer: row.customerSnapshot?.name || row.customerId?.name || "-",
        date: row.invoiceDate,
        amount: row.grandTotal,
        paymentStatus: row.paymentStatus,
      })),
      recentPurchases: recentPurchases.map((row) => ({
        id: row._id,
        invoiceNo: row.invoiceNo,
        vendor: row.vendorSnapshot?.name || row.vendorId?.name || "-",
        date: row.purchaseDate,
        items: row.items?.length || 0,
        amount: row.grandTotal,
        status: row.status,
      })),
      lowStock: lowStockRows.map((row) => ({
        id: row._id,
        product: row.itemId?.name || "Unknown",
        sku: row.itemId?.code || "-",
        stock: row.qty,
        threshold: LOW_STOCK_THRESHOLD,
      })),
    })
  );
});
