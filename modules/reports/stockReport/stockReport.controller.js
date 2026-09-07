import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import Stock from "../../stock/stock.model.js";
import Item from "../../masters/item/item.model.js";
import "../../masters/item/item.model.js";
import "../../masters/itemCategory/itemCategory.model.js";
import "../../masters/uom/uom.model.js";
import "../../warehouse/warehouse.model.js";

const parseIncludeZero = (value) => value === true || value === "true";
const DEFAULT_GST_PERCENT = 18;

export const stockReport = asyncHandler(async (req, res) => {
  const {
    warehouseId,
    categoryId,
    itemId,
    includeZero = "false",
    page = 1,
    limit = 20,
  } = req.query;
  const showZeroStock = parseIncludeZero(includeZero);

  const filter = {
    companyId: req.companyId,
    financialYearId: req.fyId,
  };

  if (warehouseId) filter.warehouseId = warehouseId;
  if (itemId) filter.itemId = itemId;

  if (categoryId) {
    const items = await Item.find({
      companyId: req.companyId,
      categoryId,
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    const categoryItemIds = items.map((row) => row._id);
    if (!categoryItemIds.length) {
      return res.json(
        new ApiResponse(200, {
          data: [],
          total: 0,
          page: Number(page),
          totalPages: 1,
          hasNext: false,
          summary: {
            totalItems: 0,
            totalQty: 0,
            totalSGST: 0,
            totalCGST: 0,
            totalStockValue: 0,
          },
        })
      );
    }

    filter.itemId = itemId
      ? { $in: categoryItemIds.filter((id) => id.toString() === itemId) }
      : { $in: categoryItemIds };
  }

  if (!showZeroStock) filter.qty = { $gt: 0 };

  let data = await Stock.find(filter)
    .populate({
      path: "itemId",
      select: "name code hsnCode categoryId uomId taxPercent",
      populate: [
        { path: "categoryId", select: "name" },
        { path: "uomId", select: "name shortCode" },
      ],
    })
    .populate("warehouseId", "name code")
    .lean();

  data = data.map((row) => {
    const rate = row.avgCost ?? 0;
    const stockValue = Number((row.qty * rate).toFixed(2));
    const taxPercent = Number(row.itemId?.taxPercent) || DEFAULT_GST_PERCENT;
    const sgst = Number(((stockValue * taxPercent) / 200).toFixed(2));
    const cgst = Number(((stockValue * taxPercent) / 200).toFixed(2));

    return {
      ...row,
      uomId: row.itemId?.uomId ?? null,
      rate,
      stockValue,
      sgst,
      cgst,
    };
  });

  data.sort((a, b) => (a.itemId?.name ?? "").localeCompare(b.itemId?.name ?? ""));

  const summary = {
    totalItems: data.length,
    totalQty: Number(data.reduce((sum, row) => sum + (row.qty ?? 0), 0).toFixed(2)),
    totalSGST: Number(data.reduce((sum, row) => sum + (row.sgst ?? 0), 0).toFixed(2)),
    totalCGST: Number(data.reduce((sum, row) => sum + (row.cgst ?? 0), 0).toFixed(2)),
    totalStockValue: Number(data.reduce((sum, row) => sum + row.stockValue, 0).toFixed(2)),
  };

  const total = data.length;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));
  const skip = (pageNum - 1) * limitNum;
  const paginated = data.slice(skip, skip + limitNum);
  const totalPages = Math.max(1, Math.ceil(total / limitNum));

  res.json(
    new ApiResponse(200, {
      data: paginated,
      total,
      page: pageNum,
      totalPages,
      hasNext: pageNum < totalPages,
      summary,
    })
  );
});
