// // import mongoose from "mongoose";

// // // ── Sales item schema — inline, owned by this model ───────────
// // // Difference from purchase: has discount field
// // const salesItemSchema = new mongoose.Schema(
// //   {
// //     slNo:         { type: Number,  required: true },
// //     itemId:       { type: mongoose.Schema.Types.ObjectId, ref: "Item",  required: true },
// //     hsn:          { type: String,  trim: true },
// //     uomId:        { type: mongoose.Schema.Types.ObjectId, ref: "Uom",   required: true },
// //     rate:         { type: Number,  required: true, min: 0 }, // base price + price level %
// //     qty:          { type: Number,  required: true, min: 0 },
// //     discount:     { type: Number,  default: 0, min: 0, max: 100 }, // ← only in sales
// //     taxableValue: { type: Number,  required: true },               // after discount
// //     taxPercent:   { type: Number,  default: 0 },
// //     sgst:         { type: Number,  default: 0 },
// //     cgst:         { type: Number,  default: 0 },
// //     total:        { type: Number,  required: true },
// //   },
// //   { _id: true }
// // );

// // // ── Sales invoice schema ──────────────────────────────────────
// // const salesInvoiceSchema = new mongoose.Schema(
// //   {
// //     companyId: {
// //       type:     mongoose.Schema.Types.ObjectId,
// //       ref:      "Company",
// //       required: true,
// //     },
// //     branchId: {
// //       type:     mongoose.Schema.Types.ObjectId,
// //       ref:      "Branch",
// //       required: true,
// //     },
// //     financialYearId: {
// //       type:     mongoose.Schema.Types.ObjectId,
// //       ref:      "FinancialYear",
// //       required: true,
// //     },
// //     warehouseId: {
// //       type:     mongoose.Schema.Types.ObjectId,
// //       ref:      "Warehouse",
// //       required: true,
// //     },

// //     // ── Invoice identity ──────────────────────────────────
// //     // SINV-R-2526-0001 → retail
// //     // SINV-W-2526-0001 → wholesale
// //     invoiceNo:   { type: String, required: true },
// //     invoiceDate: { type: Date,   required: true },

// //     // ── Sales type ────────────────────────────────────────
// //     salesType: {
// //       type:     String,
// //       enum:     ["retail", "wholesale"],
// //       required: true,
// //     },

// //     // ── Customer ──────────────────────────────────────────
// //     customerId: {
// //       type:     mongoose.Schema.Types.ObjectId,
// //       ref:      "Customer",
// //       required: true,
// //     },
// //     customerSnapshot: {
// //       name:         { type: String },
// //       phone:        { type: String },
// //       gstin:        { type: String },
// //       place:        { type: String },
// //       state:        { type: String },
// //       stateCode:    { type: String },
// //       address:      { type: String },
// //       customerType: { type: String },
// //     },

// //     // ── Price level ───────────────────────────────────────
// //     priceLevelId: {
// //       type: mongoose.Schema.Types.ObjectId,
// //       ref:  "PriceLevel",
// //     },
// //     priceLevelSnapshot: {
// //       name:       { type: String },
// //       taxPercent: { type: Number }, // % added on top of base price
// //     },

// //     // ── Items — sales has discount ────────────────────────
// //     items: [salesItemSchema],

// //     // ── Totals ────────────────────────────────────────────
// //     netAmount:  { type: Number, default: 0 }, // sum of taxableValues
// //     totalSGST:  { type: Number, default: 0 },
// //     totalCGST:  { type: Number, default: 0 },
// //     totalTax:   { type: Number, default: 0 },
// //     total:      { type: Number, default: 0 },
// //     roundOff:   { type: Number, default: 0 },
// //     grandTotal: { type: Number, default: 0 },

// //     // ── Status ────────────────────────────────────────────
// //     status: {
// //       type:    String,
// //       enum:    ["draft", "confirmed", "cancelled"],
// //       default: "confirmed",
// //     },

// //     notes:    { type: String },
// //     isActive: { type: Boolean, default: true },
// //   },
// //   { timestamps: true }
// // );

// // // ── Indexes ───────────────────────────────────────────────────
// // salesInvoiceSchema.index({ companyId: 1, branchId: 1, financialYearId: 1 });
// // salesInvoiceSchema.index(
// //   { companyId: 1, invoiceNo: 1, financialYearId: 1 },
// //   { unique: true }
// // );
// // salesInvoiceSchema.index({ companyId: 1, customerId: 1,  financialYearId: 1 });
// // salesInvoiceSchema.index({ companyId: 1, salesType: 1,   financialYearId: 1 });
// // salesInvoiceSchema.index({ companyId: 1, invoiceDate: -1 });
// // salesInvoiceSchema.index({ companyId: 1, priceLevelId: 1 });
// // salesInvoiceSchema.index({ companyId: 1, status: 1,      financialYearId: 1 });

// // export default mongoose.model("SalesInvoice", salesInvoiceSchema);

// import mongoose from "mongoose";

// // ── Sales item row — has discount, fixed 9%+9% GST ───────────
// const salesItemSchema = new mongoose.Schema(
//   {
//     slNo:         { type: Number, required: true },
//     itemId:       { type: mongoose.Schema.Types.ObjectId, ref: "Item",  required: true },
//     hsn:          { type: String, trim: true },
//     uomId:        { type: mongoose.Schema.Types.ObjectId, ref: "Uom",   required: true },
//     baseRate:     { type: Number, required: true, min: 0 }, // item.price (original)
//     priceLevelPct:{ type: Number, default: 0 },             // priceLevel.taxPercent
//     rate:         { type: Number, required: true, min: 0 }, // baseRate + (baseRate * priceLevelPct/100)
//     qty:          { type: Number, required: true, min: 0 },
//     discount:     { type: Number, default: 0, min: 0, max: 100 }, // discount %
//     discountAmt:  { type: Number, default: 0 },             // rate*qty*discount/100
//     taxableValue: { type: Number, required: true },         // rate*qty - discountAmt
//     sgst:         { type: Number, default: 0 },             // 9% of taxableValue
//     cgst:         { type: Number, default: 0 },             // 9% of taxableValue
//     total:        { type: Number, required: true },         // taxableValue + sgst + cgst
//   },
//   { _id: true }
// );

// // ── Sales invoice ─────────────────────────────────────────────
// const salesInvoiceSchema = new mongoose.Schema(
//   {
//     companyId: {
//       type:     mongoose.Schema.Types.ObjectId,
//       ref:      "Company",
//       required: true,
//     },
//     branchId: {
//       type:     mongoose.Schema.Types.ObjectId,
//       ref:      "Branch",
//       required: true,
//     },
//     financialYearId: {
//       type:     mongoose.Schema.Types.ObjectId,
//       ref:      "FinancialYear",
//       required: true,
//     },
//     warehouseId: {
//       type:     mongoose.Schema.Types.ObjectId,
//       ref:      "Warehouse",
//       required: true,
//     },

//     // ── Invoice identity ──────────────────────────────────
//     invoiceNo:   { type: String, required: true },
//     // SINV-R-2526-0001 for retail
//     // SINV-W-2526-0001 for wholesale
//     invoiceDate: { type: Date, required: true },

//     // ── Sales type ────────────────────────────────────────
//     salesType: {
//       type:     String,
//       enum:     ["retail", "wholesale"],
//       required: true,
//     },

//     // ── Price level ───────────────────────────────────────
//     priceLevelId: {
//       type:     mongoose.Schema.Types.ObjectId,
//       ref:      "PriceLevel",
//       required: true,
//     },
//     priceLevelSnapshot: {
//       name:       String,
//       taxPercent: Number, // the % used at time of invoice
//     },

//     // ── Customer (type=sales, filtered by salesType) ──────
//     customerId: {
//       type:     mongoose.Schema.Types.ObjectId,
//       ref:      "Customer",
//       required: true,
//     },
//     customerSnapshot: {
//       name:      String,
//       gstin:     String,
//       place:     String,
//       state:     String,
//       stateCode: String,
//       address:   String,
//     },

//     // ── Items ─────────────────────────────────────────────
//     items: [salesItemSchema],

//     // ── Totals ────────────────────────────────────────────
//     netAmount:  { type: Number, default: 0 }, // sum of taxableValues
//     totalSGST:  { type: Number, default: 0 },
//     totalCGST:  { type: Number, default: 0 },
//     totalTax:   { type: Number, default: 0 }, // sgst + cgst
//     total:      { type: Number, default: 0 }, // netAmount + totalTax
//     roundOff:   { type: Number, default: 0 },
//     grandTotal: { type: Number, default: 0 },

//     // ── Status ────────────────────────────────────────────
//     status: {
//       type:    String,
//       enum:    ["draft", "confirmed", "cancelled"],
//       default: "confirmed",
//     },

//     notes:    { type: String },
//     isActive: { type: Boolean, default: true },
//   },
//   { timestamps: true }
// );

// // ── Indexes ───────────────────────────────────────────────────
// salesInvoiceSchema.index({ companyId: 1, branchId: 1, financialYearId: 1 });
// salesInvoiceSchema.index({ companyId: 1, invoiceNo: 1, financialYearId: 1 }, { unique: true });
// salesInvoiceSchema.index({ companyId: 1, customerId: 1, financialYearId: 1 });
// salesInvoiceSchema.index({ companyId: 1, salesType: 1, financialYearId: 1 });
// salesInvoiceSchema.index({ companyId: 1, invoiceDate: -1 });
// salesInvoiceSchema.index({ companyId: 1, status: 1, financialYearId: 1 });
// salesInvoiceSchema.index({ companyId: 1, priceLevelId: 1 });

// export default mongoose.model("SalesInvoice", salesInvoiceSchema);

import mongoose from "mongoose";

const salesItemSchema = new mongoose.Schema(
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

const salesInvoiceSchema = new mongoose.Schema(
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

    // PKS/WH/2026-27/01 → wholesale, PKS/RT/2026-27/01 → retail
    invoiceNo: { type: String, required: true },
    invoiceDate: { type: Date, required: true },
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

    supplierStateCode: { type: String, trim: true },
    placeOfSupplyStateCode: { type: String, trim: true },
    gstSupplyType: { type: String, enum: ["intra", "inter"], default: "intra" },

    items: [salesItemSchema],

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
    saleMode: { type: String, enum: ["credit", "cash"], default: "cash" },

    returnedAmount: { type: Number, default: 0 },

    // ── Payment tracking ── ADD THESE ────────────────────
    paidAmount: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid", "unpaid"],
      default: "pending",
    },

    status: {
      type: String,
      enum: ["draft", "confirmed", "cancelled"],
      default: "confirmed",
    },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
salesInvoiceSchema.index({ companyId: 1, branchId: 1, financialYearId: 1 });
salesInvoiceSchema.index(
  { companyId: 1, invoiceNo: 1, financialYearId: 1 },
  { unique: true }
);
salesInvoiceSchema.index({ companyId: 1, customerId: 1, financialYearId: 1 });
salesInvoiceSchema.index({ companyId: 1, salesType: 1, financialYearId: 1 });
salesInvoiceSchema.index({ companyId: 1, invoiceDate: -1 });
salesInvoiceSchema.index({ companyId: 1, status: 1, financialYearId: 1 });
salesInvoiceSchema.index({
  companyId: 1,
  paymentStatus: 1,
  financialYearId: 1,
}); // ← ADD
salesInvoiceSchema.index({ companyId: 1, priceLevelId: 1 });

export default mongoose.model("SalesInvoice", salesInvoiceSchema);
