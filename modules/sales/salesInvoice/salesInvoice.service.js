import SalesInvoice  from "./salesInvoice.model.js";
import Customer      from "../../masters/customer/customer.model.js";
import Item          from "../../masters/item/item.model.js";
import PriceLevel    from "../../masters/priceLevel/priceLevel.model.js";
import Stock         from "../../stock/stock.model.js";
import { moveStock } from "../../stock/stock.services.js";
import ApiError      from "../../../utils/ApiError.js";
import { withTransaction, sessionOpts } from "../../../utils/withTransaction.js";
import { postSalesInvoice } from "../../accounting/journal/posting.service.js";
import { getNextSalesInvoiceNo } from "../../documentNumber/documentNumber.service.js";
import { regexContains } from "../../../utils/escapeRegex.js";
import { optionalSearchString } from "../../../utils/sanitizeInput.js";
import Branch from "../../branch/branch.model.js";
import {
  calculateLineGst,
  resolveGstSupplyType,
  stateCodeFromGstin,
} from "../../../utils/gstTax.js";
import { resolveItemBaseRate } from "../../../utils/itemRates.js";
import {
  normalizeInvoicePaymentSplits,
  resolveInvoicePaymentFromInput,
} from "../../../utils/invoicePayment.utils.js";

const customerSnapshotFromCustomer = (customer) => ({
  name: customer.name,
  gstin: customer.gstin || "",
  place: customer.address?.place || "",
  state: customer.address?.state || "",
  stateCode: customer.address?.stateCode || "",
  address: [customer.address?.line1, customer.address?.place, customer.address?.city]
    .filter(Boolean)
    .join(", "),
});

const resolveCustomerSnapshot = (invoice) => {
  if (invoice.customerSnapshot?.name) return invoice.customerSnapshot;
  const customer =
    invoice.customerId && typeof invoice.customerId === "object" ? invoice.customerId : null;
  return customer ? customerSnapshotFromCustomer(customer) : invoice.customerSnapshot ?? {};
};

const round2 = (n) => Number(Number(n).toFixed(2));

const computeInvoiceTotals = ({
  lineNetAmount,
  totalSGST,
  totalCGST,
  totalIGST = 0,
  cashDiscountPercent = 0,
  cashDiscountAmt: cashDiscountInput = 0,
}) => {
  const netAmount = round2(lineNetAmount);
  const totalTax = round2(totalSGST + totalCGST + totalIGST);
  const total = round2(netAmount + totalTax);
  const billTotal = Math.round(total);
  const roundOff = round2(billTotal - total);

  const cashDiscPct = Number(cashDiscountPercent) || 0;
  const manualCashDisc = round2(cashDiscountInput);
  let cashDiscountAmt =
    manualCashDisc > 0
      ? manualCashDisc
      : round2(billTotal * cashDiscPct / 100);

  if (cashDiscountAmt > billTotal) {
    cashDiscountAmt = billTotal;
  }

  const grandTotal = round2(billTotal - cashDiscountAmt);

  return {
    lineNetAmount: netAmount,
    netAmount,
    totalSGST: round2(totalSGST),
    totalCGST: round2(totalCGST),
    totalTax,
    total,
    roundOff,
    billTotal,
    cashDiscountPercent: cashDiscPct,
    cashDiscountAmt,
    grandTotal,
  };
};

const resolveInvoicePayment = (grandTotal, receivedInput, saleMode = "cash") =>
  resolveInvoicePaymentFromInput({
    grandTotal,
    receivedInput,
    saleMode,
    autoFullPayment: true,
  });

// ── Create Sales Invoice ──────────────────────────────────────
export const createSalesInvoice = async ({
  companyId,
  branchId,
  financialYearId,
  warehouseId,
  invoiceDate,
  salesType,
  priceLevelId,
  customerId,
  items,
  notes,
  cashDiscountPercent = 0,
  cashDiscountAmt = 0,
  saleMode = "cash",
  paidAmount: receivedInput = 0,
  payments = [],
  userId,
}) => {
  const customer = await Customer.findOne({
    _id: customerId,
    companyId,
    type: "sales",
    customerType: salesType,
    isActive: true,
  });
  if (!customer) {
    throw new ApiError(404, `Customer not found. Must be a ${salesType} customer.`);
  }

  const priceLevel = await PriceLevel.findOne({
    _id: priceLevelId,
    companyId,
    isActive: true,
  });
  if (!priceLevel) throw new ApiError(404, "Price level not found");

  const branch = await Branch.findOne({ _id: branchId, companyId }).select("address gstin");
  const supplierStateCode =
    branch?.address?.stateCode || stateCodeFromGstin(branch?.gstin) || "";
  const placeOfSupplyStateCode =
    customer.address?.stateCode || stateCodeFromGstin(customer.gstin) || "";
  const gstSupplyType = resolveGstSupplyType(
    supplierStateCode,
    placeOfSupplyStateCode
  );

  const itemIds = items.map((i) => i.itemId);
  const dbItems = await Item.find({
    _id: { $in: itemIds },
    companyId,
    isActive: true,
  }).populate("uomId", "name shortCode");
  if (dbItems.length !== itemIds.length) {
    throw new ApiError(400, "One or more items not found");
  }

  const invoiceNo = await getNextSalesInvoiceNo(companyId, financialYearId, salesType);

  let lineNetAmount = 0;
  let totalSGST = 0;
  let totalCGST = 0;
  let totalIGST = 0;

  const processedItems = items.map((row, index) => {
    const dbItem = dbItems.find((d) => String(d._id) === String(row.itemId));

    const priceLevelPct = priceLevel.taxPercent;
    const baseRate = resolveItemBaseRate(dbItem, row, priceLevelPct);
    const rate = Number((baseRate + (baseRate * priceLevelPct / 100)).toFixed(2));
    const taxPercent = Number(dbItem.taxPercent) || 0;

    const discount = Number(row.discount) || 0;
    const grossAmt = Number((rate * row.qty).toFixed(2));
    const discountAmt = Number((grossAmt * discount / 100).toFixed(2));
    const taxableValue = Number((grossAmt - discountAmt).toFixed(2));

    const gst = calculateLineGst({
      taxableValue,
      taxPercent,
      supplierStateCode,
      placeOfSupplyStateCode,
    });
    const total = Number((taxableValue + gst.sgst + gst.cgst + gst.igst).toFixed(2));

    lineNetAmount += taxableValue;
    totalSGST += gst.sgst;
    totalCGST += gst.cgst;
    totalIGST += gst.igst;

    return {
      slNo: index + 1,
      itemId: row.itemId,
      hsn: row.hsn || dbItem.hsnCode || dbItem.hsn || "",
      uomId: dbItem.uomId._id,
      baseRate,
      priceLevelPct,
      rate,
      qty: row.qty,
      discount,
      discountAmt,
      taxableValue,
      taxPercent,
      sgst: gst.sgst,
      cgst: gst.cgst,
      igst: gst.igst,
      total,
    };
  });

  const totals = computeInvoiceTotals({
    lineNetAmount,
    totalSGST,
    totalCGST,
    totalIGST,
    cashDiscountPercent,
    cashDiscountAmt,
  });

  if (totals.grandTotal <= 0 && totals.lineNetAmount <= 0) {
    throw new ApiError(
      400,
      "Invoice total is zero. Check item sales rate / price in product master."
    );
  }

  const isCashSale = saleMode !== "credit";
  const effectiveSaleMode = isCashSale ? "cash" : "credit";

  const customerSnapshot = {
    name: customer.name,
    gstin: customer.gstin || "",
    place: customer.address?.place || "",
    state: customer.address?.state || "",
    stateCode: customer.address?.stateCode || "",
    address: [customer.address?.line1, customer.address?.place, customer.address?.city]
      .filter(Boolean)
      .join(", "),
  };

  const priceLevelSnapshot = {
    name: priceLevel.name,
    taxPercent: priceLevel.taxPercent,
  };

  return withTransaction(async (session) => {
    const payment = resolveInvoicePayment(
      totals.grandTotal,
      receivedInput,
      effectiveSaleMode
    );
    const { paidAmount, balanceAmount, paymentStatus } = payment;

    let invoicePayments = [];
    if (Array.isArray(payments) && payments.length && paidAmount > 0) {
      const splits = await normalizeInvoicePaymentSplits({
        companyId,
        payments,
        paidAmount,
        session,
      });
      invoicePayments = splits.normalizedPayments;
    }

    const [invoice] = await SalesInvoice.create(
      [{
        companyId,
        branchId,
        financialYearId,
        warehouseId,
        invoiceNo,
        invoiceDate: new Date(invoiceDate),
        salesType,
        priceLevelId,
        priceLevelSnapshot,
        customerId,
        customerSnapshot,
        supplierStateCode,
        placeOfSupplyStateCode,
        gstSupplyType,
        items: processedItems,
        lineNetAmount: totals.lineNetAmount,
        cashDiscountPercent: totals.cashDiscountPercent,
        cashDiscountAmt: totals.cashDiscountAmt,
        billTotal: totals.billTotal,
        saleMode: isCashSale ? "cash" : "credit",
        netAmount: totals.netAmount,
        totalSGST: totals.totalSGST,
        totalCGST: totals.totalCGST,
        totalIGST,
        totalTax: totals.totalTax,
        total: totals.total,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        paidAmount,
        balanceAmount,
        paymentStatus,
        payments: invoicePayments,
        status: "confirmed",
        notes,
      }],
      sessionOpts(session)
    );

    for (const row of processedItems) {
      const stock = await Stock.findOne({
        companyId,
        warehouseId,
        itemId: row.itemId,
        financialYearId,
      }).session(session);
      row.avgCost = stock?.avgCost ?? 0;

      await moveStock({
        companyId,
        branchId,
        financialYearId,
        warehouseId,
        itemId: row.itemId,
        uomId: row.uomId,
        movementType: "sales_out",
        qty: row.qty,
        rate: row.rate,
        referenceType: "SalesInvoice",
        referenceId: invoice._id,
        referenceNo: invoiceNo,
      }, session);
    }

    await postSalesInvoice(
      {
        companyId,
        branchId,
        financialYearId,
        warehouseId,
        invoice,
        items: processedItems,
        userId,
      },
      session
    );

    return invoice;
  });
};

// ── Get all sales invoices ────────────────────────────────────
export const getAllSalesInvoices = async ({
  companyId, branchId, financialYearId,
  page = 1, limit = 20, search = "", salesType,
}) => {
  const filter = { companyId, branchId, financialYearId, isActive: true };
  const safeSearch = optionalSearchString(search);
  if (safeSearch) filter.invoiceNo = regexContains(safeSearch);
  if (salesType) filter.salesType = salesType;

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    SalesInvoice.find(filter)
      .populate("customerId",   "name phone")
      .populate("warehouseId",  "name code")
      .populate("priceLevelId", "name taxPercent")
      .select("invoiceNo invoiceDate salesType customerId customerSnapshot warehouseId priceLevelSnapshot grandTotal paidAmount balanceAmount paymentStatus saleMode status createdAt")
      .sort({ invoiceDate: -1 })
      .skip(skip).limit(limit).lean(),
    SalesInvoice.countDocuments(filter),
  ]);

  const enriched = data.map((inv) => ({
    ...inv,
    customerSnapshot: resolveCustomerSnapshot(inv),
  }));

  return {
    data: enriched,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / limit),
    hasNext:    page < Math.ceil(total / limit),
  };
};

// ── Get one sales invoice ─────────────────────────────────────
export const getOneSalesInvoice = async (companyId, invoiceId) => {
  const invoice = await SalesInvoice.findOne({ _id: invoiceId, companyId })
    .populate("customerId",    "name phone gstin address")
    .populate("warehouseId",   "name code")
    .populate("priceLevelId",  "name taxPercent")
    .populate("items.itemId",  "name code hsn")
    .populate("items.uomId",   "name shortCode")
    .lean();
  if (!invoice) throw new ApiError(404, "Sales invoice not found");
  return {
    ...invoice,
    customerSnapshot: resolveCustomerSnapshot(invoice),
  };
};
