import SalesInvoice from "../sales/salesInvoice/salesInvoice.model.js";
import PurchaseInvoice from "../purchase/purchaseInvoice/purchaseInvoice.model.js";
import Stock from "../stock/stock.model.js";
import Item from "../masters/item/item.model.js";
import StockLedger from "../stock/stockLedger.model.js";
import { getShopReport } from "../reports/shopReport/shopReport.service.js";
import salesInvoiceModel from "../sales/salesInvoice/salesInvoice.model.js";
import purchaseInvoiceModel from "../purchase/purchaseInvoice/purchaseInvoice.model.js";
import SalesReturn from "../sales/salesReturn/salesReturn.model.js";
import PurchaseReturn from "../purchase/purchaseReturn/purchaseReturn.model.js";
import Expense from "../expense/expense.model.js";

const DEFAULT_GST_PERCENT = 18;
const EXPORT_LIMIT = 10000;

const buildDateFilter = (query, field = "invoiceDate") => {
  const { dateFrom, dateTo } = query;
  if (!dateFrom && !dateTo) return {};
  const filter = {};
  filter[field] = {};
  if (dateFrom) filter[field].$gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    filter[field].$lte = end;
  }
  return filter;
};

const baseScope = (ctx) => ({
  companyId: ctx.companyId,
  branchId: ctx.branchId,
  financialYearId: ctx.financialYearId,
  isActive: true,
});

export const fetchOperationalReportRows = async (reportType, ctx) => {
  const { companyId, branchId, financialYearId, query = {} } = ctx;

  switch (reportType) {
    case "sales-report": {
      const filter = { ...baseScope(ctx), ...buildDateFilter(query) };
      if (query.customerId) filter.customerId = query.customerId;
      if (query.salesType) filter.salesType = query.salesType;
      if (query.warehouseId) filter.warehouseId = query.warehouseId;
      if (query.status) filter.status = query.status;
      return SalesInvoice.find(filter)
        .populate("customerId", "name phone")
        .populate("priceLevelId", "name")
        .select("invoiceNo invoiceDate salesType customerSnapshot priceLevelSnapshot netAmount totalTax grandTotal status")
        .sort({ invoiceDate: -1 })
        .limit(EXPORT_LIMIT)
        .lean();
    }
    case "purchase-report": {
      const filter = { ...baseScope(ctx), ...buildDateFilter(query, "purchaseDate") };
      if (query.vendorId) filter.vendorId = query.vendorId;
      if (query.warehouseId) filter.warehouseId = query.warehouseId;
      if (query.status) filter.status = query.status;
      return PurchaseInvoice.find(filter)
        .populate("vendorId", "name phone")
        .select("invoiceNo purchaseDate vendorSnapshot netAmount totalTax grandTotal status")
        .sort({ purchaseDate: -1 })
        .limit(EXPORT_LIMIT)
        .lean();
    }
    case "stock-report": {
      const filter = { companyId, financialYearId };
      if (query.warehouseId) filter.warehouseId = query.warehouseId;
      if (query.itemId) filter.itemId = query.itemId;
      if (query.includeZero !== "true") filter.qty = { $gt: 0 };
      if (query.categoryId) {
        const items = await Item.find({ companyId, categoryId: query.categoryId }).select("_id").lean();
        filter.itemId = query.itemId
          ? { $in: items.map((i) => i._id).filter((id) => id.toString() === query.itemId) }
          : { $in: items.map((i) => i._id) };
      }
      const rows = await Stock.find(filter)
        .populate({ path: "itemId", select: "name code hsnCode categoryId uomId taxPercent", populate: [{ path: "categoryId", select: "name" }, { path: "uomId", select: "name" }] })
        .populate("warehouseId", "name code")
        .lean();
      return rows.map((row) => {
        const rate = row.avgCost ?? 0;
        const stockValue = Number((row.qty * rate).toFixed(2));
        const taxPercent = Number(row.itemId?.taxPercent) || DEFAULT_GST_PERCENT;
        return { ...row, rate, stockValue, sgst: Number(((stockValue * taxPercent) / 200).toFixed(2)), cgst: Number(((stockValue * taxPercent) / 200).toFixed(2)) };
      });
    }
    case "ledger-report": {
      if (!query.itemId) return [];
      const filter = { companyId, financialYearId, itemId: query.itemId };
      if (query.warehouseId) filter.warehouseId = query.warehouseId;
      if (query.movementType) filter.movementType = query.movementType;
      Object.assign(filter, buildDateFilter(query, "createdAt"));
      return StockLedger.find(filter)
        .populate({ path: "itemId", select: "name code uomId", populate: { path: "uomId", select: "name" } })
        .populate("warehouseId", "name code")
        .sort({ createdAt: -1 })
        .limit(EXPORT_LIMIT)
        .lean();
    }
    case "shop-report": {
      const data = await getShopReport({
        companyId,
        financialYearId,
        partyType: query.partyType,
        partyId: query.partyId || query.customerId || query.vendorId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: 1,
        limit: EXPORT_LIMIT,
      });
      return data.rows || [];
    }
    case "sales-history": {
      const filter = { companyId, financialYearId, isActive: true, ...buildDateFilter(query) };
      if (query.itemId) filter["items.itemId"] = query.itemId;
      if (query.customerId) filter.customerId = query.customerId;
      if (query.salesType) filter.salesType = query.salesType;
      const invoices = await salesInvoiceModel.find(filter).populate("customerId", "name").select("invoiceNo invoiceDate salesType customerSnapshot items grandTotal status").limit(EXPORT_LIMIT).lean();
      const rows = [];
      for (const inv of invoices) {
        for (const item of inv.items || []) {
          if (query.itemId && item.itemId?.toString() !== query.itemId) continue;
          rows.push({ invoiceNo: inv.invoiceNo, date: inv.invoiceDate, salesType: inv.salesType, customer: inv.customerSnapshot?.name || "", itemName: item.name || item.itemSnapshot?.name || "", qty: item.qty, rate: item.rate, total: item.total ?? item.qty * item.rate, status: inv.status });
        }
      }
      return rows;
    }
    case "purchase-history": {
      const filter = { companyId, financialYearId, isActive: true, ...buildDateFilter(query, "purchaseDate") };
      if (query.itemId) filter["items.itemId"] = query.itemId;
      if (query.vendorId) filter.vendorId = query.vendorId;
      const invoices = await purchaseInvoiceModel.find(filter).populate("vendorId", "name").select("invoiceNo purchaseDate vendorSnapshot items grandTotal status").limit(EXPORT_LIMIT).lean();
      const rows = [];
      for (const inv of invoices) {
        for (const item of inv.items || []) {
          if (query.itemId && item.itemId?.toString() !== query.itemId) continue;
          rows.push({ invoiceNo: inv.invoiceNo, date: inv.purchaseDate, vendor: inv.vendorSnapshot?.name || "", itemName: item.name || item.itemSnapshot?.name || "", qty: item.qty, rate: item.rate, total: item.total ?? item.qty * item.rate, status: inv.status });
        }
      }
      return rows;
    }
    case "sales-return-history": {
      const filter = { companyId, financialYearId, isActive: true, ...buildDateFilter(query, "returnDate") };
      if (query.itemId) filter["items.itemId"] = query.itemId;
      if (query.customerId) filter.customerId = query.customerId;
      const returns = await SalesReturn.find(filter).populate("customerId", "name").select("returnNo returnDate customerSnapshot items grandTotal status").limit(EXPORT_LIMIT).lean();
      const rows = [];
      for (const ret of returns) {
        for (const item of ret.items || []) {
          if (query.itemId && item.itemId?.toString() !== query.itemId) continue;
          rows.push({ returnNo: ret.returnNo, date: ret.returnDate, customer: ret.customerSnapshot?.name || "", itemName: item.name || "", qty: item.qty, rate: item.rate, total: item.total ?? item.qty * item.rate, status: ret.status });
        }
      }
      return rows;
    }
    case "purchase-return-history": {
      const filter = { companyId, financialYearId, isActive: true, ...buildDateFilter(query, "returnDate") };
      if (query.itemId) filter["items.itemId"] = query.itemId;
      if (query.vendorId) filter.vendorId = query.vendorId;
      const returns = await PurchaseReturn.find(filter).populate("vendorId", "name").select("returnNo returnDate vendorSnapshot items grandTotal status").limit(EXPORT_LIMIT).lean();
      const rows = [];
      for (const ret of returns) {
        for (const item of ret.items || []) {
          if (query.itemId && item.itemId?.toString() !== query.itemId) continue;
          rows.push({ returnNo: ret.returnNo, date: ret.returnDate, vendor: ret.vendorSnapshot?.name || "", itemName: item.name || "", qty: item.qty, rate: item.rate, total: item.total ?? item.qty * item.rate, status: ret.status });
        }
      }
      return rows;
    }
    case "expense-report": {
      const filter = { companyId, branchId, financialYearId, isActive: { $ne: false } };
      if (query.category) filter.category = query.category;
      Object.assign(filter, buildDateFilter(query, "date"));
      return Expense.find(filter).select("expenseNo date category title amount paymentMode referenceNo notes").sort({ date: -1 }).limit(EXPORT_LIMIT).lean();
    }
    default:
      return undefined;
  }
};
