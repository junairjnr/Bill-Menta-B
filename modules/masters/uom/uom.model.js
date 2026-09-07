import mongoose from "mongoose";

const uomSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true }, // "Kilogram"
    shortCode: { type: String, required: true, trim: true }, // "kg"
    // type: {
    //   type: String,
    //   enum: ["weight", "length", "volume", "quantity", "time", "other"],
    //   default: "quantity",
    // },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
uomSchema.index({ companyId: 1, isActive: 1 });
uomSchema.index({ companyId: 1, shortCode: 1 }, { unique: true });
uomSchema.index({ companyId: 1, name: "text", shortCode: "text" });

export default mongoose.model("Uom", uomSchema);
