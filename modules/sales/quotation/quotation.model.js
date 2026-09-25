import mongoose from "mongoose";

const quotationItemSchema = new mongoose.Schema(
  {
    slNo: { type: Number, required: true },
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
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    sgst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: true }
);

const quotationSchema = new mongoose.Schema(
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
    },

    quotationNo: { type: String, required: true },
    quotationDate: { type: Date, required: true },
    validUntil: { type: Date },
    salesType: { type: String, enum: ["retail", "wholesale"], required: true },

    priceLevelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PriceLevel",
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

    supplierStateCode: { type: String, trim: true },
    placeOfSupplyStateCode: { type: String, trim: true },
    gstSupplyType: { type: String, enum: ["intra", "inter"], default: "intra" },

    items: [quotationItemSchema],

    netAmount: { type: Number, default: 0 },
    totalSGST: { type: Number, default: 0 },
    totalCGST: { type: Number, default: 0 },
    totalIGST: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    lineNetAmount: { type: Number, default: 0 },
    cashDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
    cashDiscountAmt: { type: Number, default: 0 },
    billTotal: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "rejected", "converted", "cancelled"],
      default: "sent",
    },
    convertedToInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesInvoice",
    },
    convertedAt: { type: Date },

    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

quotationSchema.index({ companyId: 1, branchId: 1, financialYearId: 1 });
quotationSchema.index(
  { companyId: 1, quotationNo: 1, financialYearId: 1 },
  { unique: true }
);
quotationSchema.index({ companyId: 1, customerId: 1, financialYearId: 1 });
quotationSchema.index({ companyId: 1, salesType: 1, financialYearId: 1 });
quotationSchema.index({ companyId: 1, quotationDate: -1 });
quotationSchema.index({ companyId: 1, status: 1, financialYearId: 1 });

export default mongoose.model("Quotation", quotationSchema);
