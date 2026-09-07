// import mongoose from "mongoose";

// const customerSchema = new mongoose.Schema(
//   {
//     companyId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Company",
//       required: true,
//       index: true,
//     },
//     name: { type: String, required: true, trim: true },
//     email: { type: String, lowercase: true, trim: true },
//     phone: { type: String, trim: true },
//     address: {
//       line1: String,
//       line2: String,
//       city: String,
//       state: String,
//       pincode: String,
//       country: { type: String, default: "India" },
//     },
//     gstin: String, // GST number for B2B
//     customerType: {
//       type: String,
//       enum: ["retail", "wholesale"],
//       default: "wholesale",
//     },
//     creditLimit: { type: Number, default: 0 },
//     isActive: { type: Boolean, default: true },
//   },
//   { timestamps: true }
// );

// export default mongoose.model("Customer", customerSchema);

import mongoose from "mongoose";

// ── Indian States with GST codes ──────────────────────────────
export const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" },
  { name: "Bihar", code: "10" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" },
  { name: "Kerala", code: "32" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" },
  { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" },
  { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" },
  { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
  { name: "Delhi", code: "07" },
  { name: "Jammu and Kashmir", code: "01" },
  { name: "Ladakh", code: "38" },
  { name: "Puducherry", code: "34" },
  { name: "Chandigarh", code: "04" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  { name: "Lakshadweep", code: "31" },
  { name: "Andaman and Nicobar Islands", code: "35" },
];

const customerSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    // ── Party type ────────────────────────────────────────────
    // sales   → customer you sell to
    // purchase → vendor/supplier you buy from
    type: {
      type: String,
      enum: ["sales", "purchase"],
      required: true,
      default: "sales",
    },

    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    gstin: { type: String, trim: true },

    // ── Retail / wholesale — applies to sales and purchase parties ─
    customerType: {
      type: String,
      enum: ["retail", "wholesale"],
      default: "retail",
    },

    creditLimit: { type: Number, default: 0, min: 0 },

    // ── Address with state code for GST calculation ───────────
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      place: { type: String, trim: true }, // locality/area
      city: { type: String, trim: true },
      state: { type: String, trim: true }, // "Kerala"
      stateCode: { type: String, trim: true }, // "32"
      pincode: { type: String, trim: true },
      country: { type: String, default: "India" },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
customerSchema.index({ companyId: 1, isActive: 1 });
customerSchema.index({ companyId: 1, type: 1, isActive: 1 });
customerSchema.index({ companyId: 1, "address.stateCode": 1 }); // interstate queries
customerSchema.index({
  companyId: 1,
  name: "text",
  phone: "text",
  email: "text",
});
customerSchema.index(
  { companyId: 1, name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  }
);

export default mongoose.model("Customer", customerSchema);
