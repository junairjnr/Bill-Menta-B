import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema(
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
    name:        { type: String, required: true, trim: true }, // "Main Warehouse"
    code:        { type: String, required: true, trim: true }, // "WH-01"
    description: { type: String, trim: true },
    isDefault:   { type: Boolean, default: false }, // default warehouse for branch
    isActive:    { type: Boolean, default: true  },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
warehouseSchema.index({ companyId: 1, branchId: 1, isActive: 1 });
warehouseSchema.index({ companyId: 1, branchId: 1, code: 1 }, { unique: true });
warehouseSchema.index({ companyId: 1, branchId: 1, name: "text" });

export default mongoose.model("Warehouse", warehouseSchema);