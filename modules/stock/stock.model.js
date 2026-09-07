import mongoose from "mongoose";

const stockSchema = new mongoose.Schema(
  {
    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Company",
      required: true,
    },
    branchId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Branch",
      required: true,
    },
    financialYearId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "FinancialYear",
      required: true,
    },
    warehouseId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Warehouse",
      required: true,
    },
    itemId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Item",
      required: true,
    },

    // Current stock
    qty:         { type: Number, default: 0 },

    // Weighted average cost
    // (total value / total qty) — recalculated on every purchase
    avgCost:     { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
// One stock record per item+warehouse+FY — unique constraint
stockSchema.index(
  { companyId: 1, warehouseId: 1, itemId: 1, financialYearId: 1 },
  { unique: true }
);
stockSchema.index({ companyId: 1, branchId: 1, financialYearId: 1 });
stockSchema.index({ companyId: 1, warehouseId: 1, financialYearId: 1 });
stockSchema.index({ companyId: 1, itemId: 1, financialYearId: 1 });

export default mongoose.model("Stock", stockSchema);