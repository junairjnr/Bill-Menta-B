import Quotation from "./quotation.model.js";
import Customer from "../../masters/customer/customer.model.js";
import Item from "../../masters/item/item.model.js";
import PriceLevel from "../../masters/priceLevel/priceLevel.model.js";
import ApiError from "../../../utils/ApiError.js";
import { getNextQuotationNo } from "../../documentNumber/documentNumber.service.js";
import { regexContains } from "../../../utils/escapeRegex.js";
import { optionalSearchString } from "../../../utils/sanitizeInput.js";
import Branch from "../../branch/branch.model.js";
import {
  calculateLineGst,
  resolveGstSupplyType,
  stateCodeFromGstin,
} from "../../../utils/gstTax.js";
import { resolveItemBaseRate } from "../../../utils/itemRates.js";

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

const resolveCustomerSnapshot = (doc) => {
  if (doc.customerSnapshot?.name) return doc.customerSnapshot;
  const customer =
    doc.customerId && typeof doc.customerId === "object" ? doc.customerId : null;
  return customer ? customerSnapshotFromCustomer(customer) : doc.customerSnapshot ?? {};
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
      : round2((billTotal * cashDiscPct) / 100);

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

export const createQuotation = async ({
  companyId,
  branchId,
  financialYearId,
  warehouseId,
  quotationDate,
  validUntil,
  salesType,
  priceLevelId,
  customerId,
  items,
  notes,
  status = "sent",
  cashDiscountPercent = 0,
  cashDiscountAmt = 0,
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

  let priceLevel = null;
  if (priceLevelId) {
    priceLevel = await PriceLevel.findOne({
      _id: priceLevelId,
      companyId,
      isActive: true,
    });
    if (!priceLevel) throw new ApiError(404, "Price level not found");
  }

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

  const quotationNo = await getNextQuotationNo(companyId, financialYearId, salesType);

  let lineNetAmount = 0;
  let totalSGST = 0;
  let totalCGST = 0;
  let totalIGST = 0;

  const processedItems = items.map((row, index) => {
    const dbItem = dbItems.find((d) => String(d._id) === String(row.itemId));
    if (!dbItem?.uomId?._id) {
      throw new ApiError(400, `Unit of measure missing for item ${dbItem?.name || row.itemId}`);
    }

    const priceLevelPct = priceLevel?.taxPercent ?? 0;
    const baseRate = resolveItemBaseRate(dbItem, row, priceLevelPct);
    const calculatedRate = Number(
      (baseRate + (baseRate * priceLevelPct) / 100).toFixed(2)
    );
    const submittedRate = Number(row.rate);
    const rate = submittedRate > 0 ? submittedRate : calculatedRate;
    const taxPercent = Number(row.taxPercent ?? dbItem.taxPercent ?? 0);

    const discount = Number(row.discount) || 0;
    const grossAmt = Number((rate * row.qty).toFixed(2));
    const discountAmt = Number(((grossAmt * discount) / 100).toFixed(2));
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
      "Quotation total is zero. Check item sales rate / price in product master."
    );
  }

  const customerSnapshot = customerSnapshotFromCustomer(customer);
  const priceLevelSnapshot = priceLevel
    ? { name: priceLevel.name, taxPercent: priceLevel.taxPercent }
    : undefined;

  const allowedStatus = ["draft", "sent", "accepted", "rejected", "cancelled"];
  const docStatus = allowedStatus.includes(status) ? status : "sent";

  const [quotation] = await Quotation.create([
    {
      companyId,
      branchId,
      financialYearId,
      ...(warehouseId ? { warehouseId } : {}),
      quotationNo,
      quotationDate: new Date(quotationDate),
      ...(validUntil ? { validUntil: new Date(validUntil) } : {}),
      salesType,
      ...(priceLevel ? { priceLevelId: priceLevel._id, priceLevelSnapshot } : {}),
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
      netAmount: totals.netAmount,
      totalSGST: totals.totalSGST,
      totalCGST: totals.totalCGST,
      totalIGST,
      totalTax: totals.totalTax,
      total: totals.total,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      status: docStatus,
      notes,
    },
  ]);

  return quotation;
};

export const getAllQuotations = async ({
  companyId,
  branchId,
  financialYearId,
  page = 1,
  limit = 20,
  search = "",
  salesType,
  status,
}) => {
  const filter = { companyId, branchId, financialYearId, isActive: true };
  const safeSearch = optionalSearchString(search);
  if (safeSearch) filter.quotationNo = regexContains(safeSearch);
  if (salesType) filter.salesType = salesType;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Quotation.find(filter)
      .populate("customerId", "name phone")
      .populate("warehouseId", "name code")
      .populate("priceLevelId", "name taxPercent")
      .select(
        "quotationNo quotationDate validUntil salesType customerId customerSnapshot warehouseId priceLevelSnapshot grandTotal status convertedToInvoiceId createdAt"
      )
      .sort({ quotationDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Quotation.countDocuments(filter),
  ]);

  return {
    data: data.map((row) => ({
      ...row,
      customerSnapshot: resolveCustomerSnapshot(row),
    })),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
    hasNext: page < Math.ceil(total / limit),
  };
};

export const getOneQuotation = async (companyId, quotationId) => {
  const quotation = await Quotation.findOne({ _id: quotationId, companyId })
    .populate("customerId", "name phone gstin address")
    .populate("warehouseId", "name code")
    .populate("priceLevelId", "name taxPercent")
    .populate("items.itemId", "name code hsn")
    .populate("items.uomId", "name shortCode")
    .populate("convertedToInvoiceId", "invoiceNo")
    .lean();
  if (!quotation) throw new ApiError(404, "Quotation not found");
  return {
    ...quotation,
    customerSnapshot: resolveCustomerSnapshot(quotation),
  };
};

export const markQuotationConverted = async ({
  companyId,
  quotationId,
  salesInvoiceId,
}) => {
  if (!salesInvoiceId) {
    throw new ApiError(400, "salesInvoiceId is required");
  }

  const quotation = await Quotation.findOne({
    _id: quotationId,
    companyId,
    isActive: true,
  });
  if (!quotation) throw new ApiError(404, "Quotation not found");
  if (quotation.status === "converted") {
    throw new ApiError(400, "Quotation is already converted");
  }
  if (quotation.status === "cancelled") {
    throw new ApiError(400, "Cancelled quotation cannot be converted");
  }

  quotation.status = "converted";
  quotation.convertedToInvoiceId = salesInvoiceId;
  quotation.convertedAt = new Date();
  await quotation.save();

  return quotation;
};
