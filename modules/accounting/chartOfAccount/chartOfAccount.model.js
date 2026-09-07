import mongoose from "mongoose";

const chartOfAccountSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    accountType: {
      type: String,
      enum: ["asset", "liability", "equity", "income", "expense"],
      required: true,
    },
    subLedger: {
      type: String,
      enum: ["customer", "vendor", null],
      default: null,
    },
    parentCode: { type: String, trim: true },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

chartOfAccountSchema.index({ companyId: 1, code: 1 }, { unique: true });
chartOfAccountSchema.index({ companyId: 1, accountType: 1 });

export default mongoose.model("ChartOfAccount", chartOfAccountSchema);
