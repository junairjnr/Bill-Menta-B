// ── 6. SALES HISTORY — Item wise ──────────────────────────────

import ApiResponse from "../../../utils/ApiResponse.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import salesInvoiceModel from "../../sales/salesInvoice/salesInvoice.model.js";

const SGST_RATE = 9;
const CGST_RATE = 9;

const lineTax = (itemRow) => {
  const taxableValue = Number(
    itemRow?.taxableValue ??
      Number(itemRow?.qty || 0) * Number(itemRow?.rate || 0)
  );

  const sgst =
    itemRow?.sgst > 0
      ? Number(itemRow.sgst)
      : Number(((taxableValue * SGST_RATE) / 100).toFixed(2));
  const cgst =
    itemRow?.cgst > 0
      ? Number(itemRow.cgst)
      : Number(((taxableValue * CGST_RATE) / 100).toFixed(2));

  return { taxableValue, sgst, cgst };
};

export const salesHistory = asyncHandler(async (req, res) => {
  const { itemId, customerId, salesType, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  const filter = {
    companyId: req.companyId,
    financialYearId: req.fyId,
    isActive: true,
  };

  if (itemId) filter["items.itemId"] = itemId;
  if (customerId) filter.customerId = customerId;
  if (salesType) filter.salesType = salesType;
  if (dateFrom || dateTo) {
    filter.invoiceDate = {};
    if (dateFrom) filter.invoiceDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const e = new Date(dateTo);
      e.setHours(23, 59, 59, 999);
      filter.invoiceDate.$lte = e;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const invoices = await salesInvoiceModel
    .find(filter)
    .populate("customerId", "name phone")
    .populate("warehouseId", "name code")
    .populate("priceLevelId", "name taxPercent")
    .populate("items.itemId", "name code")
    .select(
      "invoiceNo invoiceDate salesType customerId customerSnapshot warehouseId priceLevelSnapshot items grandTotal status"
    )
    .sort({ invoiceDate: -1 })
    .lean();

  const mapRow = (inv, itemRow) => {
    const { taxableValue, sgst, cgst } = lineTax(itemRow);
    const total =
      itemRow?.total > 0
        ? itemRow.total
        : Number((taxableValue + sgst + cgst).toFixed(2));

    return {
      _id: inv._id,
      invoiceNo: inv.invoiceNo,
      invoiceId: inv._id,
      invoiceDate: inv.invoiceDate,
      salesType: inv.salesType,
      customer:
        typeof inv.customerId === "object" ? inv.customerId : inv.customerSnapshot,
      priceLevel: inv.priceLevelSnapshot,
      warehouse: inv.warehouseId,
      itemId: itemRow?.itemId?._id ?? itemRow?.itemId,
      itemName: typeof itemRow?.itemId === "object" ? itemRow.itemId.name : "",
      hsn: itemRow?.hsn || "",
      baseRate: itemRow?.baseRate || 0,
      priceLevelPct: itemRow?.priceLevelPct || 0,
      rate: itemRow?.rate || 0,
      qty: itemRow?.qty || 0,
      discount: itemRow?.discount || 0,
      discountAmt: itemRow?.discountAmt || 0,
      taxableValue,
      sgst,
      cgst,
      total,
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
    retailBills: new Set(
      allRows
        .filter((r) => r.salesType === "retail")
        .map((r) => String(r.invoiceId))
    ).size,
    wholesaleBills: new Set(
      allRows
        .filter((r) => r.salesType === "wholesale")
        .map((r) => String(r.invoiceId))
    ).size,
    totalQty: Number(allRows.reduce((s, r) => s + r.qty, 0).toFixed(2)),
    totalValue: Number(allRows.reduce((s, r) => s + r.total, 0).toFixed(2)),
    totalTaxable: Number(
      allRows.reduce((s, r) => s + r.taxableValue, 0).toFixed(2)
    ),
    totalSGST: Number(allRows.reduce((s, r) => s + r.sgst, 0).toFixed(2)),
    totalCGST: Number(allRows.reduce((s, r) => s + r.cgst, 0).toFixed(2)),
    totalDiscount: Number(
      allRows.reduce((s, r) => s + r.discountAmt, 0).toFixed(2)
    ),
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
