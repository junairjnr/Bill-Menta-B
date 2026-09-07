import mongoose from "mongoose";

const journalLineSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChartOfAccount",
      required: true,
    },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    narration: { type: String },
  },
  { _id: true }
);

const journalEntrySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
      required: true,
    },
    journalNo: { type: String, required: true },
    entryDate: { type: Date, required: true },
    referenceType: {
      type: String,
      enum: [
        "SalesInvoice",
        "PurchaseInvoice",
        "ReceiptPayment",
        "Expense",
        "SalesReturn",
        "PurchaseReturn",
        "Manual",
        "Reversal",
      ],
      required: true,
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    referenceNo: { type: String },
    narration: { type: String },
    lines: { type: [journalLineSchema], required: true },
    totalDebit: { type: Number, required: true },
    totalCredit: { type: Number, required: true },
    isReversal: { type: Boolean, default: false },
    reversedJournalId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    originalJournalId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    status: {
      type: String,
      enum: ["posted", "reversed"],
      default: "posted",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

journalEntrySchema.index({ companyId: 1, financialYearId: 1, journalNo: 1 }, { unique: true });
journalEntrySchema.index({ companyId: 1, branchId: 1, financialYearId: 1 });
journalEntrySchema.index({ companyId: 1, referenceType: 1, referenceId: 1 });
journalEntrySchema.index({ companyId: 1, entryDate: -1 });
journalEntrySchema.index({ "lines.customerId": 1 });
journalEntrySchema.index({ "lines.vendorId": 1 });

export default mongoose.model("JournalEntry", journalEntrySchema);
