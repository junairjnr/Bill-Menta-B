import RolePermission from "./rolePermission.model.js";
import Company from "../company/company.model.js";
import ApiError from "../../utils/ApiError.js";
import { getCustomRolePermissions } from "./customRole.service.js";
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  MANAGED_ROLES,
  PERMISSION_ACTIONS,
  PERMISSION_SECTIONS,
  ROLE_META,
  SUPER_ADMIN_SETTINGS,
  VIEW_PERMISSIONS,
  isSystemRole,
} from "./permissions.constants.js";
import { normalizePermissions, mapToObject } from "./permissionUtils.js";

export const seedDefaultPermissions = async (companyId) => {
  await ensureRolePermissions(companyId);
};

export const ensureRolePermissions = async (companyId) => {
  const existing = await RolePermission.find({ companyId }).select("role").lean();
  const existingRoles = new Set(existing.map((doc) => doc.role));
  const missing = MANAGED_ROLES.filter((role) => !existingRoles.has(role));

  if (!missing.length) return;

  const docs = missing.map((role) => ({
    companyId,
    role,
    views: normalizePermissions(DEFAULT_ROLE_PERMISSIONS[role]),
  }));

  await RolePermission.insertMany(docs, { ordered: false }).catch((err) => {
    if (err?.code !== 11000) throw err;
  });
};

export const getEffectivePermissions = async (companyId, role) => {
  if (role === "super_admin") {
    return {
      ...Object.fromEntries(ALL_PERMISSION_KEYS.map((key) => [key, true])),
      ...SUPER_ADMIN_SETTINGS,
      role,
      isSuperAdmin: true,
    };
  }

  if (isSystemRole(role)) {
    const doc = await RolePermission.findOne({ companyId, role }).lean();
    const fallback = DEFAULT_ROLE_PERMISSIONS[role] || {};
    const views = normalizePermissions(mapToObject(doc?.views), fallback);

    return {
      ...views,
      role,
      isSuperAdmin: false,
    };
  }

  const customViews = await getCustomRolePermissions(companyId, role);
  if (customViews) {
    return {
      ...customViews,
      role,
      isSuperAdmin: false,
      isCustomRole: true,
    };
  }

  return {
    ...normalizePermissions({}, DEFAULT_ROLE_PERMISSIONS.viewer),
    role,
    isSuperAdmin: false,
  };
};

export const getPermissionCatalog = () => ({
  roles: MANAGED_ROLES,
  roleMeta: ROLE_META,
  actions: PERMISSION_ACTIONS,
  sections: PERMISSION_SECTIONS,
  permissions: VIEW_PERMISSIONS,
});

export const getAllRolePermissions = async (companyId) => {
  const docs = await RolePermission.find({ companyId }).lean();
  const byRole = Object.fromEntries(
    MANAGED_ROLES.map((role) => {
      const doc = docs.find((d) => d.role === role);
      const fallback = DEFAULT_ROLE_PERMISSIONS[role] || {};
      return [role, normalizePermissions(mapToObject(doc?.views), fallback)];
    })
  );

  return {
    ...getPermissionCatalog(),
    permissionsByRole: byRole,
  };
};

export const updateRolePermissions = async (companyId, role, views) => {
  if (!MANAGED_ROLES.includes(role)) {
    throw new ApiError(400, "Invalid role");
  }

  const normalized = normalizePermissions(views, DEFAULT_ROLE_PERMISSIONS[role] || {});
  const doc = await RolePermission.findOneAndUpdate(
    { companyId, role },
    { views: normalized },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  return {
    role,
    views: normalizePermissions(mapToObject(doc.views)),
  };
};

export const getCompanySettings = async (companyId) => {
  const company = await Company.findById(companyId).select("-__v");
  if (!company) throw new ApiError(404, "Company not found");
  return company;
};

export const updateCompanySettings = async (companyId, payload) => {
  const company = await Company.findById(companyId);
  if (!company) throw new ApiError(404, "Company not found");

  const { name, code, email, phone, address, logo, plan, gstin, terms } = payload;

  if (name && name !== company.name) {
    const exists = await Company.findOne({ name, _id: { $ne: companyId } });
    if (exists) throw new ApiError(409, "Company name already exists");
    company.name = name;
  }

  if (code && code.toUpperCase() !== company.code) {
    const exists = await Company.findOne({
      code: code.toUpperCase(),
      _id: { $ne: companyId },
    });
    if (exists) throw new ApiError(409, "Company code already exists");
    company.code = code.toUpperCase();
  }

  if (email !== undefined) company.email = email;
  if (phone !== undefined) company.phone = phone;
  if (address !== undefined) company.address = address;
  if (logo !== undefined) company.logo = logo;
  if (plan !== undefined) company.plan = plan;
  if (gstin !== undefined) company.gstin = gstin;
  if (terms !== undefined) company.terms = terms;

  await company.save();
  return company;
};

export const canView = (permissions, key) => {
  if (!permissions) return false;
  if (permissions.isSuperAdmin) return true;
  const viewKey = actionKey(key, "view");
  if (permissions[viewKey] !== undefined) return Boolean(permissions[viewKey]);
  return Boolean(permissions[key]);
};

export const canAction = (permissions, key, action) => {
  if (!permissions) return false;
  if (permissions.isSuperAdmin) return true;
  const fullKey = actionKey(key, action);
  if (permissions[fullKey] !== undefined) return Boolean(permissions[fullKey]);
  if (action === "view" && permissions[key] !== undefined) {
    return Boolean(permissions[key]);
  }
  return false;
};
