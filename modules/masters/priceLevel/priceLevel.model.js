import mongoose from "mongoose";

const priceLevelSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true }, // "wholesale", "retail", "vip", etc.
    taxPercent: { type: Number, default: 0 }, // "%"
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
priceLevelSchema.index({ companyId: 1, isActive: 1 });
priceLevelSchema.index({ companyId: 1, name: "text", taxPercent: "text" });

export default mongoose.model("PriceLevel", priceLevelSchema);
