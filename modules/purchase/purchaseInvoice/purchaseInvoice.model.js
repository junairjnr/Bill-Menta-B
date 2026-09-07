import mongoose from "mongoose";
import attachmentSchema from "../../upload/attachment.schema.js";

// ── Item row inside invoice ───────────────────────────────────
const purchaseItemSchema = new mongoose.Schema(
  {
    slNo: { type: Number, required: true },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    hsn: { type: String, trim: true },
    uomId: { type: mongoose.Schema.Types.ObjectId, ref: "Uom", required: true },
    rate: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    discountAmt: { type: Number, default: 0 },
    taxableValue: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    total: { type: Number, required: true }, // taxableValue + sgst + cgst
  },
  { _id: true }
);

// ── Main invoice schema ───────────────────────────────────────
const purchaseInvoiceSchema = new mongoose.Schema(
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

    // ── Invoice identity ────────────────────────────────────
    invoiceNo: { type: String, required: true }, // PKS/PI/2026-27/01 (our number)
    vendorInvoiceNo: { type: String, required: true, trim: true }, // supplier's invoice number
    purchaseDate: { type: Date, required: true },

    // ── Vendor (customer with type=purchase) ────────────────
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    // Snapshot of vendor details at time of purchase
    vendorSnapshot: {
      name: String,
      gstin: String,
      place: String,
      state: String,
      stateCode: String,
      address: String,
    },

    // ── Items ───────────────────────────────────────────────
    items: [purchaseItemSchema],

    // ── Totals ──────────────────────────────────────────────
    netAmount: { type: Number, default: 0 }, // sum of taxableValues
    totalSGST: { type: Number, default: 0 },
    totalCGST: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 }, // sgst + cgst
    total: { type: Number, default: 0 }, // netAmount + totalTax
    roundOff: { type: Number, default: 0 }, // Math.round(total) - total
    grandTotal: { type: Number, default: 0 },

    returnedAmount: { type: Number, default: 0 },

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
    attachments: { type: [attachmentSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
purchaseInvoiceSchema.index({ companyId: 1, branchId: 1, financialYearId: 1 });
purchaseInvoiceSchema.index(
  { companyId: 1, invoiceNo: 1, financialYearId: 1 },
  { unique: true }
);
purchaseInvoiceSchema.index({ companyId: 1, vendorId: 1, financialYearId: 1 });
purchaseInvoiceSchema.index({ companyId: 1, purchaseDate: -1 });
purchaseInvoiceSchema.index({ companyId: 1, status: 1, financialYearId: 1 });
purchaseInvoiceSchema.index(
  {
    companyId: 1,
    financialYearId: 1,
    vendorId: 1,
    vendorInvoiceNo: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      vendorInvoiceNo: { $exists: true, $ne: null, $ne: "" },
    },
  }
);

export default mongoose.model("PurchaseInvoice", purchaseInvoiceSchema);
