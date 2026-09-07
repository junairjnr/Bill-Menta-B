import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ItemCategory",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true }, // SKU / item code
    // unit: { type: String, default: "pcs" }, // pcs, kg, ltr, etc.
    uomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Uom",
      required: true,
    },
    salesRate: { type: Number, min: 0, default: 0 },
    purchaseRate: { type: Number, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0 }, // legacy; kept in sync with salesRate
    taxPercent: { type: Number, default: 0 }, // GST %
    hsnCode: { type: String, trim: true }, // for GST reporting
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
itemSchema.index({ companyId: 1, isActive: 1 });
itemSchema.index({ companyId: 1, categoryId: 1, isActive: 1 });
itemSchema.index({ companyId: 1, uomId: 1 });
itemSchema.index({ companyId: 1, code: 1 },  { sparse: true });
itemSchema.index({ companyId: 1, hsnCode: 1 });
itemSchema.index(
  { companyId: 1, name: 1 },
  {
    unique: true,
    // strength 3 = case-insensitive, punctuation-sensitive (fixes false dupes with " in names)
    collation: { locale: "en", strength: 3 },
  }
);
itemSchema.index({ companyId: 1, name: "text", description: "text" });

/** Legacy items may have salesRate/purchaseRate 0 while price is set. */
itemSchema.post("init", function syncLegacyRates() {
  const price = Number(this.price) || 0;
  if (price <= 0) return;
  if (!Number(this.salesRate)) this.salesRate = price;
  if (!Number(this.purchaseRate)) this.purchaseRate = price;
});

export default mongoose.model("Item", itemSchema);
