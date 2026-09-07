import asyncHandler  from "../../../utils/asyncHandler.js";
import ApiResponse   from "../../../utils/ApiResponse.js";
import StockLedger   from "../../stock/stockLedger.model.js";
import "../../masters/item/item.model.js";
import "../../masters/uom/uom.model.js";
import "../../warehouse/warehouse.model.js";


// ── 4. LEDGER REPORT ──────────────────────────────────────────
// Stock movement history for an item
export const ledgerReport = asyncHandler(async (req, res) => {
  const {
    itemId,         // required
    warehouseId,
    movementType,
    dateFrom,
    dateTo,
    page  = 1,
    limit = 50,
  } = req.query;

  if (!itemId) {
    return res.status(400).json(
      new ApiResponse(400, null, "itemId is required for ledger report"),
    );
  }

  const filter = {
    companyId:       req.companyId,
    financialYearId: req.fyId,
    itemId,
  };

  if (warehouseId)   filter.warehouseId   = warehouseId;
  if (movementType)  filter.movementType  = movementType;

  // Date range
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [rawData, total] = await Promise.all([
    StockLedger.find(filter)
      .populate({
        path: "itemId",
        select: "name code uomId",
        populate: { path: "uomId", select: "name shortCode" },
      })
      .populate("warehouseId",       "name code")
      .populate("linkedWarehouseId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    StockLedger.countDocuments(filter),
  ]);

  const data = rawData.map((row) => ({
    ...row,
    uomId: row.itemId?.uomId ?? null,
  }));

  // Summary
  const inTypes  = ["purchase_in", "sales_return", "transfer_in",
                    "adjustment_in", "opening_stock"];
  const outTypes = ["sales_out", "purchase_return", "transfer_out", "adjustment_out"];

  const allData = await StockLedger.find(filter).select("movementType qty value").lean();

  const summary = {
    totalMovements: total,
    totalIn:        Number(allData
                      .filter((r) => inTypes.includes(r.movementType))
                      .reduce((s, r) => s + r.qty, 0).toFixed(2)),
    totalOut:       Number(allData
                      .filter((r) => outTypes.includes(r.movementType))
                      .reduce((s, r) => s + r.qty, 0).toFixed(2)),
    totalValue:     Number(allData.reduce((s, r) => s + r.value, 0).toFixed(2)),
  };

  res.json(new ApiResponse(200, {
    data,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    hasNext:    Number(page) < Math.ceil(total / Number(limit)),
    summary,
  }));
});
