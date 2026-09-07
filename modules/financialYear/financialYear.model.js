import mongoose from "mongoose";

const financialYearSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    label: { type: String, required: true }, // "2025-26"
    startDate: { type: Date, required: true }, // 2025-04-01
    endDate: { type: Date, required: true }, // 2026-03-31
    isActive: { type: Boolean, default: true }, // currently selected
    isClosed: { type: Boolean, default: false }, // locked — no transactions
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
financialYearSchema.index({ companyId: 1, isActive: 1 });
financialYearSchema.index({ companyId: 1, isClosed: 1 });
financialYearSchema.index({ companyId: 1, label: 1 }, { unique: true });

export default mongoose.model("FinancialYear", financialYearSchema);
