import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema(
  {
    receiptPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReceiptPayment",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
      required: true,
    },
    invoiceType: {
      type: String,
      enum: ["sales", "purchase"],
      required: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    invoiceNo: String,
    invoiceDate: Date,
    invoiceTotal: Number,
    paidBefore: { type: Number, default: 0 },
    amountAdjusted: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

allocationSchema.index({ receiptPaymentId: 1 });
allocationSchema.index({ companyId: 1, invoiceId: 1, invoiceType: 1 });

export default mongoose.model("Allocation", allocationSchema);
