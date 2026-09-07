import mongoose from "mongoose";
import PurchaseReturn from "./purchaseReturn.model.js";
import PurchaseInvoice from "../purchaseInvoice/purchaseInvoice.model.js";
import Customer from "../../masters/customer/customer.model.js";
import Item from "../../masters/item/item.model.js";
import Warehouse from "../../warehouse/warehouse.model.js";
import { moveStock } from "../../stock/stock.services.js";
import ApiError from "../../../utils/ApiError.js";
import { withTransaction, sessionOpts } from "../../../utils/withTransaction.js";
import { getNextPurchaseReturnNo } from "../../documentNumber/documentNumber.service.js";
import { regexContains } from "../../../utils/escapeRegex.js";
import { optionalSearchString } from "../../../utils/sanitizeInput.js";
import { normalizeAttachments } from "../../upload/upload.utils.js";

const recalcPaymentStatus = (invoice) => {
  const effectiveTotal = Math.max(
    0,
    Number(invoice.grandTotal || 0) - Number(invoice.returnedAmount || 0)
  );
  const paid = Number(invoice.paidAmount || 0);
  invoice.balanceAmount = Math.max(0, Number((effectiveTotal - paid).toFixed(2)));

  if (paid <= 0) invoice.paymentStatus = "pending";
  else if (paid >= effectiveTotal - 0.009) invoice.paymentStatus = "paid";
  else invoice.paymentStatus = "partial";
};

const getReturnedQtyByLine = async (purchaseInvoiceId) => {
  const returns = await PurchaseReturn.find({
    purchaseInvoiceId,
    isActive: true,
    status: "confirmed",
  }).select("items");

  const map = {};
  for (const ret of returns) {
    for (const row of ret.items) {
      const key = String(row.invoiceItemId);
      map[key] = (map[key] || 0) + row.qty;
    }
  }
  return map;
};

const findInvoiceLine = (invoice, { slNo, itemId, invoiceItemId }) => {
  if (invoiceItemId) {
    return invoice.items.id(invoiceItemId);
  }
  if (slNo != null) {
    return invoice.items.find((row) => row.slNo === Number(slNo));
  }
  const matches = invoice.items.filter((row) => String(row.itemId) === String(itemId));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new ApiError(
      400,
      `Item ${itemId} appears on multiple lines. Send slNo or invoiceItemId.`
    );
  }
  return null;
};

const buildPurchaseReturnLine = (invoiceLine, qty) => {
  const ratio = qty / invoiceLine.qty;
  const taxableValue = Number((invoiceLine.taxableValue * ratio).toFixed(2));
  const sgst = Number((invoiceLine.sgst * ratio).toFixed(2));
  const cgst = Number((invoiceLine.cgst * ratio).toFixed(2));
  const total = Number((invoiceLine.total * ratio).toFixed(2));

  return {
    invoiceItemId: invoiceLine._id,
    itemId: invoiceLine.itemId,
    hsn: invoiceLine.hsn,
    uomId: invoiceLine.uomId,
    rate: invoiceLine.rate,
    qty,
    taxPercent: invoiceLine.taxPercent,
    taxableValue,
    sgst,
    cgst,
    total,
  };
};

export const getReturnableItems = async (companyId, purchaseInvoiceId) => {
  const invoice = await PurchaseInvoice.findOne({
    _id: purchaseInvoiceId,
    companyId,
    isActive: true,
    status: "confirmed",
  }).lean();

  if (!invoice) throw new ApiError(404, "Purchase invoice not found");

  const returnedMap = await getReturnedQtyByLine(purchaseInvoiceId);

  const items = invoice.items.map((row) => {
    const returnedQty = returnedMap[String(row._id)] || 0;
    const returnableQty = Number((row.qty - returnedQty).toFixed(3));
    return {
      invoiceItemId: row._id,
      slNo: row.slNo,
      itemId: row.itemId,
      hsn: row.hsn,
      uomId: row.uomId,
      rate: row.rate,
      originalQty: row.qty,
      returnedQty,
      returnableQty: Math.max(0, returnableQty),
    };
  });

  return {
    purchaseInvoiceId: invoice._id,
    invoiceNo: invoice.invoiceNo,
    vendorInvoiceNo: invoice.vendorInvoiceNo,
    vendorId: invoice.vendorId,
    warehouseId: invoice.warehouseId,
    grandTotal: invoice.grandTotal,
    returnedAmount: invoice.returnedAmount || 0,
    items,
  };
};

const vendorSnapshotFromCustomer = (vendor) => ({
  name: vendor.name,
  gstin: vendor.gstin || "",
  place: vendor.address?.place || "",
  state: vendor.address?.state || "",
  stateCode: vendor.address?.stateCode || "",
  address: [vendor.address?.line1, vendor.address?.place, vendor.address?.city]
    .filter(Boolean)
    .join(", "),
});

const buildManualPurchaseReturnLine = (dbItem, row, slNo) => {
  const qty = Number(row.qty);
  const rate = Number(row.rate);
  const taxPercent = Number(row.taxPercent ?? dbItem.taxPercent ?? 18);
  const taxableValue = Number((qty * rate).toFixed(2));
  const sgst = Number(((taxableValue * taxPercent) / 200).toFixed(2));
  const cgst = Number(((taxableValue * taxPercent) / 200).toFixed(2));
  const total = Number((taxableValue + sgst + cgst).toFixed(2));

  return {
    slNo,
    invoiceItemId: new mongoose.Types.ObjectId(),
    itemId: dbItem._id,
    hsn: row.hsn || dbItem.hsn || "",
    uomId: dbItem.uomId?._id ?? dbItem.uomId,
    rate,
    qty,
    taxPercent,
    taxableValue,
    sgst,
    cgst,
    total,
  };
};

const createManualPurchaseReturn = async ({
  companyId,
  branchId,
  financialYearId,
  returnDate,
  vendorId,
  warehouseId,
  referenceInvoiceNo,
  vendorInvoiceNo,
  items,
  notes,
  attachments,
}) => {
  if (!vendorId) throw new ApiError(400, "Vendor is required for manual return");
  if (!warehouseId) throw new ApiError(400, "Warehouse is required for manual return");
  if (!items?.length) throw new ApiError(400, "At least one return item is required");

  const [vendor, warehouse] = await Promise.all([
    Customer.findOne({ _id: vendorId, companyId, type: "purchase", isActive: true }),
    Warehouse.findOne({ _id: warehouseId, companyId, isActive: true }),
  ]);

  if (!vendor) throw new ApiError(404, "Vendor not found");
  if (!warehouse) throw new ApiError(404, "Warehouse not found");

  const itemIds = [...new Set(items.map((row) => String(row.itemId)).filter(Boolean))];
  const dbItems = await Item.find({ _id: { $in: itemIds }, companyId, isActive: true }).populate(
    "uomId",
    "name shortCode"
  );
  const itemMap = Object.fromEntries(dbItems.map((item) => [String(item._id), item]));

  const processedItems = [];
  let netAmount = 0;
  let totalSGST = 0;
  let totalCGST = 0;

  for (const row of items) {
    const qty = Number(row.qty);
    const rate = Number(row.rate);
    if (!row.itemId || !qty || qty <= 0) continue;
    if (!rate || rate <= 0) {
      throw new ApiError(400, "Rate is required for each manual return line");
    }

    const dbItem = itemMap[String(row.itemId)];
    if (!dbItem) throw new ApiError(404, `Item not found: ${row.itemId}`);

    const built = buildManualPurchaseReturnLine(dbItem, row, processedItems.length + 1);
    processedItems.push(built);
    netAmount += built.taxableValue;
    totalSGST += built.sgst;
    totalCGST += built.cgst;
  }

  if (!processedItems.length) {
    throw new ApiError(400, "No valid return quantities provided");
  }

  const totalTax = Number((totalSGST + totalCGST).toFixed(2));
  const total = Number((netAmount + totalTax).toFixed(2));
  const grandTotal = Math.round(total);
  const roundOff = Number((grandTotal - total).toFixed(2));
  const returnNo = await getNextPurchaseReturnNo(companyId, financialYearId);
  const originalInvoiceNo = referenceInvoiceNo?.trim() || "MANUAL";
  const normalizedAttachments = normalizeAttachments(companyId, attachments);

  return withTransaction(async (session) => {
    const [purchaseReturn] = await PurchaseReturn.create(
      [
        {
          companyId,
          branchId,
          financialYearId,
          warehouseId,
          returnNo,
          returnDate: new Date(returnDate),
          returnMode: "manual",
          referenceInvoiceNo: referenceInvoiceNo?.trim() || "",
          originalInvoiceNo,
          vendorInvoiceNo: vendorInvoiceNo?.trim() || "",
          vendorId,
          vendorSnapshot: vendorSnapshotFromCustomer(vendor),
          items: processedItems,
          netAmount: Number(netAmount.toFixed(2)),
          totalSGST: Number(totalSGST.toFixed(2)),
          totalCGST: Number(totalCGST.toFixed(2)),
          totalTax,
          total,
          roundOff,
          grandTotal,
          status: "confirmed",
          notes,
          attachments: normalizedAttachments,
        },
      ],
      sessionOpts(session)
    );

    for (const row of processedItems) {
      await moveStock(
        {
          companyId,
          branchId,
          financialYearId,
          warehouseId,
          itemId: row.itemId,
          uomId: row.uomId,
          movementType: "purchase_return",
          qty: row.qty,
          rate: row.rate,
          referenceType: "PurchaseReturn",
          referenceId: purchaseReturn._id,
          referenceNo: returnNo,
        },
        session
      );
    }

    return purchaseReturn;
  });
};

export const createPurchaseReturn = async (payload) => {
  const {
    companyId,
    branchId,
    financialYearId,
    purchaseInvoiceId,
    returnDate,
    items,
    notes,
    returnMode,
    vendorId,
    warehouseId,
    referenceInvoiceNo,
    vendorInvoiceNo,
    attachments,
  } = payload;

  const isManual = returnMode === "manual" || !purchaseInvoiceId;

  if (isManual) {
    return createManualPurchaseReturn({
      companyId,
      branchId,
      financialYearId,
      returnDate,
      vendorId,
      warehouseId,
      referenceInvoiceNo,
      vendorInvoiceNo,
      items,
      notes,
      attachments,
    });
  }

  const invoice = await PurchaseInvoice.findOne({
    _id: purchaseInvoiceId,
    companyId,
    branchId,
    financialYearId,
    isActive: true,
    status: "confirmed",
  });

  if (!invoice) throw new ApiError(404, "Purchase invoice not found");

  if (!items?.length) throw new ApiError(400, "At least one return item is required");

  const returnedMap = await getReturnedQtyByLine(purchaseInvoiceId);
  const processedItems = [];
  let netAmount = 0;
  let totalSGST = 0;
  let totalCGST = 0;

  for (const row of items) {
    const qty = Number(row.qty);
    if (!qty || qty <= 0) continue;

    const invoiceLine = findInvoiceLine(invoice, row);
    if (!invoiceLine) {
      throw new ApiError(404, `Invoice line not found for item ${row.itemId ?? row.invoiceItemId}`);
    }

    const alreadyReturned = returnedMap[String(invoiceLine._id)] || 0;
    const returnableQty = invoiceLine.qty - alreadyReturned;

    if (qty > returnableQty + 0.0001) {
      throw new ApiError(
        400,
        `Return qty ${qty} exceeds returnable qty ${Math.max(0, returnableQty)} for line ${invoiceLine.slNo}`
      );
    }

    const built = buildPurchaseReturnLine(invoiceLine, qty);
    processedItems.push(built);
    netAmount += built.taxableValue;
    totalSGST += built.sgst;
    totalCGST += built.cgst;
  }

  if (!processedItems.length) {
    throw new ApiError(400, "No valid return quantities provided");
  }

  const totalTax = Number((totalSGST + totalCGST).toFixed(2));
  const total = Number((netAmount + totalTax).toFixed(2));
  const grandTotal = Math.round(total);
  const roundOff = Number((grandTotal - total).toFixed(2));
  const returnNo = await getNextPurchaseReturnNo(companyId, financialYearId);
  const normalizedAttachments = normalizeAttachments(companyId, attachments);

  return withTransaction(async (session) => {
    const [purchaseReturn] = await PurchaseReturn.create(
      [{
        companyId,
        branchId,
        financialYearId,
        warehouseId: invoice.warehouseId,
        returnNo,
        returnDate: new Date(returnDate),
        returnMode: "invoice",
        purchaseInvoiceId: invoice._id,
        originalInvoiceNo: invoice.invoiceNo,
        vendorInvoiceNo: invoice.vendorInvoiceNo,
        vendorId: invoice.vendorId,
        vendorSnapshot: invoice.vendorSnapshot,
        items: processedItems.map((row, index) => ({ ...row, slNo: index + 1 })),
        netAmount: Number(netAmount.toFixed(2)),
        totalSGST: Number(totalSGST.toFixed(2)),
        totalCGST: Number(totalCGST.toFixed(2)),
        totalTax,
        total,
        roundOff,
        grandTotal,
        status: "confirmed",
        notes,
        attachments: normalizedAttachments,
      }],
      sessionOpts(session)
    );

    invoice.returnedAmount = Number(((invoice.returnedAmount || 0) + grandTotal).toFixed(2));
    recalcPaymentStatus(invoice);
    await invoice.save(sessionOpts(session));

    for (const row of processedItems) {
      await moveStock(
        {
          companyId,
          branchId,
          financialYearId,
          warehouseId: invoice.warehouseId,
          itemId: row.itemId,
          uomId: row.uomId,
          movementType: "purchase_return",
          qty: row.qty,
          rate: row.rate,
          referenceType: "PurchaseReturn",
          referenceId: purchaseReturn._id,
          referenceNo: returnNo,
        },
        session
      );
    }

    return purchaseReturn;
  });
};

export const getAllPurchaseReturns = async ({
  companyId,
  branchId,
  financialYearId,
  page = 1,
  limit = 20,
  search = "",
  purchaseInvoiceId,
}) => {
  const filter = { companyId, branchId, financialYearId, isActive: true };
  const safeSearch = optionalSearchString(search);
  if (safeSearch) filter.returnNo = regexContains(safeSearch);
  if (purchaseInvoiceId) filter.purchaseInvoiceId = purchaseInvoiceId;

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    PurchaseReturn.find(filter)
      .populate("vendorId", "name phone")
      .populate("warehouseId", "name code")
      .populate("purchaseInvoiceId", "invoiceNo vendorInvoiceNo purchaseDate")
      .select(
        "returnNo returnDate returnMode purchaseInvoiceId originalInvoiceNo referenceInvoiceNo vendorInvoiceNo vendorId vendorSnapshot warehouseId grandTotal status createdAt"
      )
      .sort({ returnDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    PurchaseReturn.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    hasNext: Number(page) < Math.ceil(total / Number(limit)),
  };
};

export const getOnePurchaseReturn = async (companyId, returnId) => {
  const purchaseReturn = await PurchaseReturn.findOne({ _id: returnId, companyId, isActive: true })
    .populate("vendorId", "name phone gstin address")
    .populate("warehouseId", "name code")
    .populate("purchaseInvoiceId", "invoiceNo vendorInvoiceNo purchaseDate grandTotal returnedAmount")
    .populate("items.itemId", "name code hsn")
    .populate("items.uomId", "name shortCode")
    .lean();

  if (!purchaseReturn) throw new ApiError(404, "Purchase return not found");
  return purchaseReturn;
};
