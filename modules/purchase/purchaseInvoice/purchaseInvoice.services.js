import PurchaseInvoice from "./purchaseInvoice.model.js";
import Customer        from "../../masters/customer/customer.model.js";
import Item            from "../../masters/item/item.model.js";
import { moveStock }   from "../../stock/stock.services.js";
import ApiError        from "../../../utils/ApiError.js";
import { withTransaction, sessionOpts } from "../../../utils/withTransaction.js";
import { postPurchaseInvoice } from "../../accounting/journal/posting.service.js";
import { getNextPurchaseInvoiceNo } from "../../documentNumber/documentNumber.service.js";
import { regexContains } from "../../../utils/escapeRegex.js";
import { optionalSearchString } from "../../../utils/sanitizeInput.js";
import { normalizeAttachments } from "../../upload/upload.utils.js";
import {
  normalizeInvoicePaymentSplits,
  resolveInvoicePaymentFromInput,
} from "../../../utils/invoicePayment.utils.js";

// ── Create Purchase Invoice ───────────────────────────────────
export const createPurchaseInvoice = async ({
  companyId,
  branchId,
  financialYearId,
  warehouseId,
  vendorId,
  vendorInvoiceNo,
  purchaseDate,
  items,
  notes,
  attachments,
  payments = [],
  paidAmount: receivedInput = 0,
  cashDiscountPercent = 0,
  cashDiscountAmt = 0,
  userId,
}) => {
  return withTransaction(async (session) => {
    // 1. Validate vendor
    const vendor = await Customer.findOne({
      _id: vendorId, companyId, type: "purchase", isActive: true,
    }).session(session);
    if (!vendor) throw new ApiError(404, "Vendor not found or invalid");

    // 2. Validate items
    const itemIds = items.map((i) => i.itemId);
    const dbItems = await Item.find({
      _id: { $in: itemIds }, companyId, isActive: true,
    }).populate("uomId", "name shortCode").session(session);
    if (dbItems.length !== itemIds.length)
      throw new ApiError(400, "One or more items not found");

    // 3. Check for duplicate vendorInvoiceNo (within same company + vendor + financial year)
    if (vendorInvoiceNo && vendorInvoiceNo.trim() !== "") {
      const duplicate = await PurchaseInvoice.findOne({
        companyId,
        financialYearId,
        vendorId,
        vendorInvoiceNo: vendorInvoiceNo.trim(),
      }).session(session).lean();
      if (duplicate) {
        throw new ApiError(
          409,
          `Vendor invoice number "${vendorInvoiceNo.trim()}" already exists for this vendor in the current financial year (Ref: ${duplicate.invoiceNo})`
        );
      }
    }

    // 4. Generate invoice number
    const invoiceNo = await getNextPurchaseInvoiceNo(companyId, financialYearId);

    // 5. Calculate amounts
    let netAmount = 0, totalSGST = 0, totalCGST = 0;

    const processedItems = items.map((row, index) => {
      const dbItem      = dbItems.find((d) => String(d._id) === String(row.itemId));
      const discount     = Number(row.discount) || 0;
      const grossAmt     = Number((row.qty * row.rate).toFixed(2));
      const discountAmt  = Number((grossAmt * discount / 100).toFixed(2));
      const taxableValue = Number((grossAmt - discountAmt).toFixed(2));
      const taxPercent   = Number(row.taxPercent ?? dbItem.taxPercent ?? 18);
      const sgst         = Number((taxableValue * taxPercent / 200).toFixed(2));
      const cgst         = Number((taxableValue * taxPercent / 200).toFixed(2));
      const total        = Number((taxableValue + sgst + cgst).toFixed(2));

      netAmount  += taxableValue;
      totalSGST  += sgst;
      totalCGST  += cgst;

      return {
        slNo: index + 1,
        itemId: row.itemId,
        hsn:   row.hsn || dbItem.hsn || "",
        uomId: dbItem.uomId._id,
        rate:  row.rate,
        qty:   row.qty,
        discount,
        discountAmt,
        taxableValue,
        taxPercent,
        sgst,
        cgst,
        total,
      };
    });

    const totalTax   = Number((totalSGST + totalCGST).toFixed(2));
    const total      = Number((netAmount + totalTax).toFixed(2));
    const billTotal  = Math.round(total);
    const roundOff   = Number((billTotal - total).toFixed(2));

    const cashDiscPct = Number(cashDiscountPercent) || 0;
    const manualCashDisc = Number(Number(cashDiscountAmt || 0).toFixed(2));
    let cashDiscountAmount =
      manualCashDisc > 0
        ? manualCashDisc
        : Number((billTotal * cashDiscPct / 100).toFixed(2));
    if (cashDiscountAmount > billTotal) cashDiscountAmount = billTotal;
    const grandTotal = Number((billTotal - cashDiscountAmount).toFixed(2));

    // 5. Vendor snapshot
    const vendorSnapshot = {
      name:      vendor.name,
      gstin:     vendor.gstin || "",
      place:     vendor.address?.place || "",
      state:     vendor.address?.state || "",
      stateCode: vendor.address?.stateCode || "",
      address:   [vendor.address?.line1, vendor.address?.place, vendor.address?.city]
                   .filter(Boolean).join(", "),
    };

    // 6. Create invoice
    const normalizedAttachments = normalizeAttachments(companyId, attachments);

    const payment = resolveInvoicePaymentFromInput({
      grandTotal,
      receivedInput,
      saleMode: "credit",
      autoFullPayment: false,
    });
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

    const [invoice] = await PurchaseInvoice.create([{
      companyId, branchId, financialYearId, warehouseId,
      invoiceNo, vendorInvoiceNo,
      purchaseDate: new Date(purchaseDate),
      vendorId, vendorSnapshot,
      items: processedItems,
      netAmount: Number(netAmount.toFixed(2)),
      totalSGST: Number(totalSGST.toFixed(2)),
      totalCGST: Number(totalCGST.toFixed(2)),
      totalTax, total, roundOff, billTotal,
      cashDiscountPercent: cashDiscPct,
      cashDiscountAmt: cashDiscountAmount,
      grandTotal,
      paidAmount,
      balanceAmount,
      paymentStatus,
      payments: invoicePayments,
      status: "confirmed", notes,
      attachments: normalizedAttachments,
    }], sessionOpts(session));

    for (const row of processedItems) {
      await moveStock({
        companyId, branchId, financialYearId, warehouseId,
        itemId:        row.itemId,
        uomId:         row.uomId,
        movementType:  "purchase_in",
        qty:           row.qty,
        rate:          row.rate,
        referenceType: "PurchaseInvoice",
        referenceId:   invoice._id,
        referenceNo:   invoiceNo,
      }, session);
    }

    await postPurchaseInvoice(
      { companyId, branchId, financialYearId, invoice, userId },
      session
    );

    return invoice;
  });
};

export const getAllPurchaseInvoices = async ({
  companyId, branchId, financialYearId, page = 1, limit = 20, search = "",
}) => {
  const filter = { companyId, branchId, financialYearId, isActive: true };
  const safeSearch = optionalSearchString(search);
  if (safeSearch) filter.invoiceNo = regexContains(safeSearch);

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    PurchaseInvoice.find(filter)
      .populate("vendorId",    "name phone")
      .populate("warehouseId", "name code")
      .select("invoiceNo vendorInvoiceNo purchaseDate vendorId vendorSnapshot warehouseId grandTotal status createdAt")
      .sort({ purchaseDate: -1 })
      .skip(skip).limit(limit).lean(),
    PurchaseInvoice.countDocuments(filter),
  ]);

  return { data, total, page: Number(page), totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit) };
};

export const getOnePurchaseInvoice = async (companyId, invoiceId) => {
  const invoice = await PurchaseInvoice.findOne({ _id: invoiceId, companyId })
    .populate("vendorId",     "name phone gstin address")
    .populate("warehouseId",  "name code")
    .populate("items.itemId", "name code hsn")
    .populate("items.uomId",  "name shortCode")
    .lean();
  if (!invoice) throw new ApiError(404, "Purchase invoice not found");
  return invoice;
};