import mongoose from "mongoose";

const customRoleSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true, default: "" },
    basedOn: { type: String, trim: true },
    permissions: {
      type: Map,
      of: Boolean,
      default: {},
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

customRoleSchema.index({ companyId: 1, slug: 1 }, { unique: true });
customRoleSchema.index({ companyId: 1, isActive: 1 });

export default mongoose.model("CustomRole", customRoleSchema);
