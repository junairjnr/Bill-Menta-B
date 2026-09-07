import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    accountName: { type: String, required: true, trim: true }, // "SBI Current A/C"
    bankName: { type: String, required: true, trim: true }, // "State Bank of India"
    accountNumber: { type: String, required: true, trim: true }, // "1234567890"
    ifscCode: { type: String, trim: true }, // "SBIN0001234"
    branch: { type: String, trim: true }, // "Kozhikode Main"
    accountType: {
      type: String,
      enum: ["current", "savings", "overdraft"],
      default: "current",
    },
    upiId: { type: String, trim: true }, // for UPI payments
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bankAccountSchema.index({ companyId: 1, isActive: 1 });
bankAccountSchema.index({ companyId: 1, branchId: 1, isActive: 1 });
bankAccountSchema.index({ companyId: 1, isDefault: 1 });

export default mongoose.model("BankAccount", bankAccountSchema);
