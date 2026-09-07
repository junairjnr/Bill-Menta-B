import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
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
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    role: {
      type: String,
      required: true,
      default: "viewer",
      validate: {
        validator(value) {
          return typeof value === "string" && value.length > 0;
        },
        message: "Role is required",
      },
    },
    isActive: { type: Boolean, default: true },

    // invite flow
    inviteToken: { type: String, select: false },
    inviteTokenExpiry: { type: Date, select: false },
    isVerified: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
// userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ companyId: 1, branchId: 1, role: 1 });
userSchema.index({ companyId: 1, branchId: 1, isActive: 1 });
userSchema.index({ companyId: 1, isActive: 1 });
userSchema.index({ inviteToken: 1 }, { sparse: true });

// ── Password hash before save ─────────────────────────────────
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ── Compare password at login ─────────────────────────────────
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Generate invite token ─────────────────────────────────────
userSchema.methods.generateInviteToken = function () {
  const raw = crypto.randomBytes(32).toString("hex");
  this.inviteToken = crypto.createHash("sha256").update(raw).digest("hex");
  this.inviteTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return raw;
};

export default mongoose.model("User", userSchema);
