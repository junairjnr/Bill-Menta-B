// ── 5. PURCHASE HISTORY — Item wise ──────────────────────────

import ApiResponse from "../../../utils/ApiResponse.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import purchaseInvoiceModel from "../../purchase/purchaseInvoice/purchaseInvoice.model.js";

const DEFAULT_GST_PERCENT = 18;

const lineTax = (itemRow) => {
  const taxableValue = Number(
    itemRow?.taxableValue ??
      Number(itemRow?.qty || 0) * Number(itemRow?.rate || 0)
  );
  const taxPercent = Number(itemRow?.taxPercent) || DEFAULT_GST_PERCENT;

  const sgst =
    itemRow?.sgst > 0
      ? Number(itemRow.sgst)
      : Number(((taxableValue * taxPercent) / 200).toFixed(2));
  const cgst =
    itemRow?.cgst > 0
      ? Number(itemRow.cgst)
      : Number(((taxableValue * taxPercent) / 200).toFixed(2));

  return { sgst, cgst };
};

export const purchaseHistory = asyncHandler(async (req, res) => {
  const { itemId, vendorId, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  const filter = {
    companyId: req.companyId,
    financialYearId: req.fyId,
    isActive: true,
  };

  if (itemId) filter["items.itemId"] = itemId;
  if (vendorId) filter.vendorId = vendorId;
  if (dateFrom || dateTo) {
    filter.purchaseDate = {};
    if (dateFrom) filter.purchaseDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const e = new Date(dateTo);
      e.setHours(23, 59, 59, 999);
      filter.purchaseDate.$lte = e;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const invoices = await purchaseInvoiceModel
    .find(filter)
    .populate("vendorId", "name phone")
    .populate("warehouseId", "name code")
    .populate("items.itemId", "name code")
    .select(
      "invoiceNo purchaseDate vendorId vendorSnapshot warehouseId items grandTotal status"
    )
    .sort({ purchaseDate: -1 })
    .lean();

  const mapRow = (inv, itemRow) => {
    const { sgst, cgst } = lineTax(itemRow);
    const taxableValue = Number(
      itemRow?.taxableValue ??
        Number(itemRow?.qty || 0) * Number(itemRow?.rate || 0)
    );
    const total =
      itemRow?.total > 0
        ? itemRow.total
        : Number((taxableValue + sgst + cgst).toFixed(2));

    return {
      _id: inv._id,
      invoiceNo: inv.invoiceNo,
      invoiceId: inv._id,
      purchaseDate: inv.purchaseDate,
      vendor:
        typeof inv.vendorId === "object" ? inv.vendorId : inv.vendorSnapshot,
      warehouse: inv.warehouseId,
      itemId: itemRow?.itemId?._id ?? itemRow?.itemId,
      itemName: typeof itemRow?.itemId === "object" ? itemRow.itemId.name : "",
      hsn: itemRow?.hsn || "",
      qty: itemRow?.qty || 0,
      rate: itemRow?.rate || 0,
      taxableValue,
      sgst,
      cgst,
      total,
      taxPercent: Number(itemRow?.taxPercent) || DEFAULT_GST_PERCENT,
    };
  };

  const allRows = invoices.flatMap((inv) => {
    const itemRows = itemId
      ? inv.items.filter(
          (i) =>
            i.itemId?._id?.toString() === itemId ||
            i.itemId?.toString() === itemId
        )
      : inv.items;
    return itemRows.map((itemRow) => mapRow(inv, itemRow));
  });

  const total = allRows.length;
  const rows = allRows.slice(skip, skip + Number(limit));

  const summary = {
    totalBills: new Set(allRows.map((r) => String(r.invoiceId))).size,
    totalQty: Number(allRows.reduce((s, r) => s + r.qty, 0).toFixed(2)),
    totalValue: Number(allRows.reduce((s, r) => s + r.total, 0).toFixed(2)),
    totalTaxable: Number(
      allRows.reduce((s, r) => s + r.taxableValue, 0).toFixed(2)
    ),
    totalSGST: Number(allRows.reduce((s, r) => s + r.sgst, 0).toFixed(2)),
    totalCGST: Number(allRows.reduce((s, r) => s + r.cgst, 0).toFixed(2)),
    avgRate: allRows.length
      ? Number(
          (allRows.reduce((s, r) => s + r.rate, 0) / allRows.length).toFixed(2)
        )
      : 0,
    minRate: allRows.length ? Math.min(...allRows.map((r) => r.rate)) : 0,
    maxRate: allRows.length ? Math.max(...allRows.map((r) => r.rate)) : 0,
  };

  res.json(
    new ApiResponse(200, {
      rows,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      hasNext: Number(page) < Math.ceil(total / Number(limit)),
      summary,
    })
  );
});
