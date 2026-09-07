import mongoose from "mongoose";
import { MANAGED_ROLES } from "./permissions.constants.js";

const rolePermissionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    role: {
      type: String,
      enum: MANAGED_ROLES,
      required: true,
    },
    views: {
      type: Map,
      of: Boolean,
      default: {},
    },
  },
  { timestamps: true }
);

rolePermissionSchema.index({ companyId: 1, role: 1 }, { unique: true });

export default mongoose.model("RolePermission", rolePermissionSchema);
