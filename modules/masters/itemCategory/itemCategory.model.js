import mongoose from "mongoose";

const itemCategorySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique name per company
itemCategorySchema.index({ companyId: 1, name: 1 }, { unique: true });

export default mongoose.model("ItemCategory", itemCategorySchema);
