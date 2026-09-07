import mongoose from "mongoose";
import Stock from "./stock.model.js";
import StockLedger from "./stockLedger.model.js";
import ApiError from "../../utils/ApiError.js";

/*
  moveStock — called by:
    - Purchase Invoice     → purchase_in
    - Purchase Return      → purchase_return
    - Sales Invoice        → sales_out
    - Sales Return         → sales_return
    - Stock Transfer       → transfer_out + transfer_in (two calls)
    - Stock Adjustment     → adjustment_in or adjustment_out
    - Opening Stock        → opening_stock
*/

export const moveStock = async (
  {
    companyId,
    branchId,
    financialYearId,
    warehouseId,
    itemId,
    movementType,
    qty,
    rate = 0,
    referenceType,
    referenceId,
    referenceNo,
    linkedWarehouseId = null,
    notes = "",
  },
  session = null
) => {
  // ── Determine direction ─────────────────────────────────────
  const inMovements = [
    "purchase_in",
    "sales_return",
    "transfer_in",
    "adjustment_in",
    "opening_stock",
  ];
  const outMovements = [
    "sales_out",
    "purchase_return",
    "transfer_out",
    "adjustment_out",
  ];

  const isIn = inMovements.includes(movementType);
  const isOut = outMovements.includes(movementType);

  if (!isIn && !isOut) {
    throw new ApiError(400, `Invalid movement type: ${movementType}`);
  }

  // ── Get or create stock record ──────────────────────────────
  let stock = await Stock.findOne({
    companyId,
    warehouseId,
    itemId,
    financialYearId,
  }).session(session);

  if (!stock) {
    // First time this item appears in this warehouse+FY
    stock = new Stock({
      companyId,
      branchId,
      financialYearId,
      warehouseId,
      itemId,
      qty: 0,
      avgCost: 0,
    });
  }

  // ── Check sufficient stock for out movements ────────────────
  if (isOut && stock.qty < qty) {
    throw new ApiError(
      400,
      `Insufficient stock. Available: ${stock.qty}, Requested: ${qty}`
    );
  }

  // ── Calculate new qty ───────────────────────────────────────
  const prevQty = stock.qty;
  const newQty = isIn ? prevQty + qty : prevQty - qty;
  const value = qty * rate;

  // ── Weighted average cost — only on IN movements ────────────
  // Formula: (prevQty * prevAvgCost + newQty * newRate) / totalQty
  if (isIn && rate > 0) {
    const prevValue = prevQty * stock.avgCost;
    const newValue = qty * rate;
    stock.avgCost = (prevValue + newValue) / newQty;
  }

  stock.qty = newQty;

  // ── Save stock ──────────────────────────────────────────────
  if (session) {
    await stock.save({ session });
  } else {
    await stock.save();
  }

  // ── Create ledger entry ─────────────────────────────────────
  const ledgerData = {
    companyId,
    branchId,
    financialYearId,
    warehouseId,
    itemId,
    movementType,
    qty,
    rate,
    value,
    balanceQty: newQty,
    referenceType,
    referenceId,
    referenceNo,
    linkedWarehouseId,
    notes,
  };

  if (session) {
    await StockLedger.create([ledgerData], { session });
  } else {
    await StockLedger.create(ledgerData);
  }

  return stock;
};

// ── Get current stock for item in warehouse ─────────────────
export const getStock = async ({
  companyId,
  warehouseId,
  itemId,
  financialYearId,
}) => {
  return Stock.findOne({ companyId, warehouseId, itemId, financialYearId })
    .populate("itemId", "name code")
    .populate("warehouseId", "name code")
    .lean();
};

// ── Get all stock for a company ───────────────────────────
export const getCompanyStock = async ({ companyId, financialYearId }) => {
  return Stock.find({ companyId, financialYearId, qty: { $gt: 0 } })
    .populate("itemId", "name code uomId")
    .populate("warehouseId", "name code")
    .sort({ updatedAt: -1 })
    .lean();
};

// ── Get all stock for a warehouse ───────────────────────────
export const getWarehouseStock = async ({
  companyId,
  warehouseId,
  financialYearId,
}) => {
  return Stock.find({
    companyId,
    warehouseId,
    financialYearId,
    qty: { $gt: 0 },
  })
    .populate("itemId", "name code uomId")
    .populate("warehouseId", "name code")
    .sort({ updatedAt: -1 })
    .lean();
};

// ── Get stock ledger for item in warehouse ──────────────────
export const getStockLedger = async ({
  companyId,
  warehouseId,
  itemId,
  financialYearId,
  page = 1,
  limit = 50,
}) => {
  const filter = { companyId, warehouseId, financialYearId };
  if (itemId) filter.itemId = itemId;

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    StockLedger.find(filter)
      .populate("itemId", "name code")
      .populate("warehouseId", "name code")
      .populate("linkedWarehouseId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockLedger.countDocuments(filter),
  ]);

  return { data, total, page, totalPages: Math.ceil(total / limit) };
};