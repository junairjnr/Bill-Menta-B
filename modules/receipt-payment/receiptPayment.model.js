import mongoose from "mongoose";

const partySnapshotSchema = {
  name: String,
  phone: String,
  gstin: String,
  place: String,
  state: String,
  stateCode: String,
  address: String,
};

const receiptPaymentSchema = new mongoose.Schema(
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
    voucherNo: { type: String, required: true },
    voucherType: {
      type: String,
      enum: ["receipt", "payment"],
      required: true,
    },
    date: { type: Date, required: true },
    partyType: {
      type: String,
      enum: ["customer", "vendor"],
      required: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    partySnapshot: partySnapshotSchema,
    paymentMode: {
      type: String,
      enum: ["cash", "bank", "upi", "cheque", "card", "other", "bank_transfer"],
      required: true,
      default: "cash",
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankAccount",
    },
    bankAccountSnapshot: {
      accountName: String,
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      upiId: String,
    },

    referenceNo: { type: String, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    notes: { type: String },
    status: {
      type: String,
      enum: ["draft", "completed", "cancelled"],
      default: "completed",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

receiptPaymentSchema.index({ companyId: 1, branchId: 1, financialYearId: 1 });
receiptPaymentSchema.index(
  { companyId: 1, voucherNo: 1, financialYearId: 1, voucherType: 1 },
  { unique: true }
);
receiptPaymentSchema.index({ companyId: 1, partyId: 1, voucherType: 1 });
receiptPaymentSchema.index({ companyId: 1, date: -1 });

export default mongoose.model("ReceiptPayment", receiptPaymentSchema);
