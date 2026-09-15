import mongoose from "mongoose";

const taxMasterSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    taxPercent: { type: Number, required: true, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

taxMasterSchema.index({ companyId: 1, isActive: 1 });
taxMasterSchema.index({ companyId: 1, name: "text", taxPercent: "text" });

export default mongoose.model("TaxMaster", taxMasterSchema);
