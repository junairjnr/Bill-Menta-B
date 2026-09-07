import ApiResponse from "../../../utils/ApiResponse.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import SalesReturn from "../../sales/salesReturn/salesReturn.model.js";

const SGST_RATE = 9;
const CGST_RATE = 9;

const lineTax = (itemRow) => {
  const taxableValue = Number(
    itemRow?.taxableValue ?? Number(itemRow?.qty || 0) * Number(itemRow?.rate || 0)
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

export const salesReturnHistory = asyncHandler(async (req, res) => {
  const { itemId, customerId, salesType, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  const filter = {
    companyId: req.companyId,
    financialYearId: req.fyId,
    isActive: { $ne: false },
    status: "confirmed",
  };

  if (itemId) filter["items.itemId"] = itemId;
  if (customerId) filter.customerId = customerId;
  if (salesType) filter.salesType = salesType;
  if (dateFrom || dateTo) {
    filter.returnDate = {};
    if (dateFrom) filter.returnDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.returnDate.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const returns = await SalesReturn.find(filter)
    .populate("customerId", "name phone")
    .populate("warehouseId", "name code")
    .populate("items.itemId", "name code")
    .select(
      "returnNo returnDate salesType customerId customerSnapshot warehouseId priceLevelSnapshot originalInvoiceNo items grandTotal status"
    )
    .sort({ returnDate: -1 })
    .lean();

  const mapRow = (doc, itemRow) => {
    const { taxableValue, sgst, cgst } = lineTax(itemRow);
    const total =
      itemRow?.total > 0 ? itemRow.total : Number((taxableValue + sgst + cgst).toFixed(2));

    return {
      _id: doc._id,
      returnNo: doc.returnNo,
      returnId: doc._id,
      returnDate: doc.returnDate,
      originalInvoiceNo: doc.originalInvoiceNo,
      salesType: doc.salesType,
      customer:
        typeof doc.customerId === "object" ? doc.customerId : doc.customerSnapshot,
      priceLevel: doc.priceLevelSnapshot,
      warehouse: doc.warehouseId,
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

  const allRows = returns.flatMap((doc) => {
    const itemRows = itemId
      ? doc.items.filter(
          (row) =>
            row.itemId?._id?.toString() === itemId || row.itemId?.toString() === itemId
        )
      : doc.items;
    return itemRows.map((itemRow) => mapRow(doc, itemRow));
  });

  const total = allRows.length;
  const rows = allRows.slice(skip, skip + Number(limit));

  const summary = {
    totalReturns: new Set(allRows.map((row) => String(row.returnId))).size,
    retailReturns: new Set(
      allRows.filter((row) => row.salesType === "retail").map((row) => String(row.returnId))
    ).size,
    wholesaleReturns: new Set(
      allRows.filter((row) => row.salesType === "wholesale").map((row) => String(row.returnId))
    ).size,
    totalQty: Number(allRows.reduce((sum, row) => sum + row.qty, 0).toFixed(2)),
    totalValue: Number(allRows.reduce((sum, row) => sum + row.total, 0).toFixed(2)),
    totalTaxable: Number(allRows.reduce((sum, row) => sum + row.taxableValue, 0).toFixed(2)),
    totalSGST: Number(allRows.reduce((sum, row) => sum + row.sgst, 0).toFixed(2)),
    totalCGST: Number(allRows.reduce((sum, row) => sum + row.cgst, 0).toFixed(2)),
    avgRate: allRows.length
      ? Number((allRows.reduce((sum, row) => sum + row.rate, 0) / allRows.length).toFixed(2))
      : 0,
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
