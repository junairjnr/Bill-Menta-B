import mongoose from "mongoose";

const invoicePaymentSchema = new mongoose.Schema(
  {
    paymentMode: {
      type: String,
      enum: ["cash", "bank", "bank_transfer", "upi", "cheque", "card", "other"],
      required: true,
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankAccount",
    },
    bankAccountSnapshot: { type: mongoose.Schema.Types.Mixed },
    amount: { type: Number, required: true, min: 0 },
    referenceNo: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

export default invoicePaymentSchema;
