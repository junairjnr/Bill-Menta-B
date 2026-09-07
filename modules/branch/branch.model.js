import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true }, // "Head Office"
    code: { type: String, required: true, trim: true }, // "HO", "BR1"
    address: {
      line1: String,
      line2: String,
      place: String,
      city: String,
      state: String,
      stateCode: String,
      pincode: String,
      country: { type: String, default: "India" },
    },
    phone: String,
    email: String,
    gstin: String,
    isHeadOffice: { type: Boolean, default: false }, // only one per company
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
branchSchema.index({ companyId: 1, isActive: 1 });
branchSchema.index({ companyId: 1, code: 1 }, { unique: true });
branchSchema.index({ companyId: 1, name: "text" });

export default mongoose.model("Branch", branchSchema);
