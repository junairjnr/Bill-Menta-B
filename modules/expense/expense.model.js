import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
      required: true,
    },
    expenseNo: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    category: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: {
      type: String,
      enum: ["cash", "bank", "upi", "cheque", "card", "other", "bank_transfer"],
      default: "cash",
    },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" },
    referenceNo: { type: String, trim: true },
    notes: { type: String },
    status: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

expenseSchema.index({ companyId: 1, financialYearId: 1, expenseNo: 1 }, { unique: true });
expenseSchema.index({ companyId: 1, financialYearId: 1, date: -1 });

export default mongoose.model("Expense", expenseSchema);
