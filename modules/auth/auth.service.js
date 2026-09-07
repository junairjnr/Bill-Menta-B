import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../user/user.model.js";
import Company from "../company/company.model.js";
import Branch from "../branch/branch.model.js";
import ApiError from "../../utils/ApiError.js";
import {
  createFinancialYear,
  getCurrentFYStartYear,
} from "../financialYear/financialYear.services.js";
import financialYearModel from "../financialYear/financialYear.model.js";
import { seedDefaultPermissions, getEffectivePermissions, ensureRolePermissions } from "../settings/settings.service.js";
import { seedDefaultChartOfAccounts } from "../accounting/chartOfAccount/chartOfAccount.service.js";
import { requireString } from "../../utils/sanitizeInput.js";

const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    algorithm: "HS256",
  });

// Register = Create Company + Admin User (atomic)
const register = async ({
  companyName,
  companyCode,
  companyEmail,
  name,
  email,
  password,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const existingUser = await User.findOne({ email: requireString(email, "email", { maxLength: 254 }) });
    if (existingUser) throw new ApiError(409, "Email already registered");

    const [company] = await Company.create(
      [{ name: companyName, code: companyCode?.toUpperCase(), email: companyEmail }],
      { session }
    );

    // 2. Create Head Office branch
    const [branch] = await Branch.create(
      [
        {
          companyId: company._id,
          name: "Head Office",
          code: "HO",
          isHeadOffice: true,
          isActive: true,
        },
      ],
      { session }
    );

    const [user] = await User.create(
      [
        {
          companyId: company._id,
          branchId: branch._id,
          name,
          email,
          password,
          role: "super_admin",
        },
      ],
      { session }
    );

    await session.commitTransaction();

    try {
      await seedDefaultPermissions(company._id);
    } catch (permErr) {
      console.warn("Default permissions seed warning:", permErr.message);
    }

    try {
      await seedDefaultChartOfAccounts(company._id);
    } catch (coaErr) {
      console.warn("Default COA seed warning:", coaErr.message);
    }

    try {
      const fyStartYear = getCurrentFYStartYear();
      await createFinancialYear(company._id, fyStartYear);
    } catch (fyErr) {
      console.warn("FY auto-create warning:", fyErr.message);
      // Don't fail registration if FY creation fails
    }

    const token = generateToken({
      id: user._id,
      companyId: company._id,
      branchId: branch._id,
      role: user.role,
    });

    const permissions = await getEffectivePermissions(company._id, user.role);

    const activeFY = await financialYearModel
      .findOne({ companyId: company._id, isActive: true })
      .select("_id label startDate endDate");

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: company._id,
        branchId: branch._id,
        activeFY: activeFY?._id,
        permissions,
      },
      company,
      branch,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const login = async ({ email, password }) => {
  const safeEmail = requireString(email, "email", { maxLength: 254 });
  if (typeof password !== "string" || !password) {
    throw new ApiError(400, "Password is required");
  }

  const user = await User.findOne({ email: safeEmail })
    .select("+password")
    .populate("branchId", "name code");
  if (!user || !(await user.comparePassword(password)))
    throw new ApiError(401, "Invalid email or password");

  if (!user.isActive) throw new ApiError(403, "Account is deactivated");

  const activeFY = await financialYearModel
    .findOne({
      companyId: user.companyId,
      isActive: true,
    })
    .select("label startDate endDate isActive isClosed");

  const token = generateToken({
    id: user._id,
    companyId: user.companyId,
    branchId: user.branchId._id,
    role: user.role,
  });

  const permissions = await getEffectivePermissions(user.companyId, user.role);

  try {
    await ensureRolePermissions(user.companyId);
  } catch (permErr) {
    console.warn("Role permissions seed warning:", permErr.message);
  }

  try {
    await seedDefaultChartOfAccounts(user.companyId);
  } catch (coaErr) {
    console.warn("Default COA seed warning:", coaErr.message);
  }

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId._id,
      activeFY: activeFY?._id,
      permissions,
    },
  };
};

export default { register, login };
