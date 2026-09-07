import mongoose from "mongoose";

const salesReturnItemSchema = new mongoose.Schema(
  {
    slNo: { type: Number, required: true },
    invoiceItemId: { type: mongoose.Schema.Types.ObjectId },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    hsn: { type: String, trim: true },
    uomId: { type: mongoose.Schema.Types.ObjectId, ref: "Uom", required: true },
    baseRate: { type: Number, required: true, min: 0 },
    priceLevelPct: { type: Number, default: 0 },
    rate: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    discountAmt: { type: Number, default: 0 },
    taxableValue: { type: Number, required: true },
    sgst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: true }
);

const salesReturnSchema = new mongoose.Schema(
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
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    returnNo: { type: String, required: true },
    returnDate: { type: Date, required: true },

    returnMode: {
      type: String,
      enum: ["invoice", "manual"],
      default: "invoice",
    },

    salesInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesInvoice",
    },
    originalInvoiceNo: { type: String, trim: true, default: "" },
    referenceInvoiceNo: { type: String, trim: true },
    salesType: { type: String, enum: ["retail", "wholesale"], required: true },

    priceLevelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PriceLevel",
      required: true,
    },
    priceLevelSnapshot: { name: String, taxPercent: Number },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerSnapshot: {
      name: String,
      gstin: String,
      place: String,
      state: String,
      stateCode: String,
      address: String,
    },

    items: [salesReturnItemSchema],

    netAmount: { type: Number, default: 0 },
    totalSGST: { type: Number, default: 0 },
    totalCGST: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

salesReturnSchema.index({ companyId: 1, branchId: 1, financialYearId: 1 });
salesReturnSchema.index(
  { companyId: 1, returnNo: 1, financialYearId: 1 },
  { unique: true }
);
salesReturnSchema.index({ companyId: 1, salesInvoiceId: 1 });
salesReturnSchema.index({ companyId: 1, customerId: 1, financialYearId: 1 });
salesReturnSchema.index({ companyId: 1, returnDate: -1 });

export default mongoose.model("SalesReturn", salesReturnSchema);
