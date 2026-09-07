import CustomRole from "./customRole.model.js";
import User from "../user/user.model.js";
import ApiError from "../../utils/ApiError.js";
import {
  DEFAULT_ROLE_PERMISSIONS,
  MANAGED_ROLES,
  ROLE_META,
  isSystemRole,
  slugifyRoleName,
} from "./permissions.constants.js";
import { normalizePermissions, mapToObject } from "./permissionUtils.js";

const buildUniqueSlug = async (companyId, name, excludeId = null) => {
  const base = slugifyRoleName(name);
  if (!base) throw new ApiError(400, "Role name is required");

  let slug = base;
  let suffix = 1;

  while (true) {
    const filter = { companyId, slug };
    if (excludeId) filter._id = { $ne: excludeId };
    const exists = await CustomRole.findOne(filter).select("_id");
    if (!exists && !MANAGED_ROLES.includes(slug)) break;
    slug = `${base}_${suffix++}`;
  }

  return slug;
};

export const listRoles = async (companyId) => {
  const customRoles = await CustomRole.find({ companyId, isActive: true })
    .sort({ name: 1 })
    .lean();

  const systemRoles = MANAGED_ROLES.map((role) => ({
    id: role,
    slug: role,
    name: ROLE_META[role]?.label || role,
    description: ROLE_META[role]?.description || "",
    isSystem: true,
    basedOn: null,
  }));

  const custom = customRoles.map((role) => ({
    id: role._id.toString(),
    slug: role.slug,
    name: role.name,
    description: role.description,
    isSystem: false,
    basedOn: role.basedOn || null,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }));

  return { systemRoles, customRoles: custom };
};

export const getCustomRoleBySlug = async (companyId, slug) => {
  const role = await CustomRole.findOne({ companyId, slug, isActive: true }).lean();
  if (!role) throw new ApiError(404, "Custom role not found");
  return role;
};

export const createCustomRole = async (companyId, userId, payload) => {
  const { name, description, basedOn, permissions } = payload;
  if (!name?.trim()) throw new ApiError(400, "Role name is required");

  const slug = await buildUniqueSlug(companyId, name);
  const template = basedOn && DEFAULT_ROLE_PERMISSIONS[basedOn]
    ? DEFAULT_ROLE_PERMISSIONS[basedOn]
    : DEFAULT_ROLE_PERMISSIONS.viewer;

  const normalized = normalizePermissions(permissions || {}, template);

  const role = await CustomRole.create({
    companyId,
    name: name.trim(),
    slug,
    description: description?.trim() || "",
    basedOn: basedOn && isSystemRole(basedOn) ? basedOn : null,
    permissions: normalized,
    createdBy: userId,
  });

  return {
    id: role._id.toString(),
    slug: role.slug,
    name: role.name,
    description: role.description,
    isSystem: false,
    basedOn: role.basedOn,
    permissions: normalizePermissions(mapToObject(role.permissions)),
  };
};

export const updateCustomRole = async (companyId, roleId, payload) => {
  const role = await CustomRole.findOne({ _id: roleId, companyId, isActive: true });
  if (!role) throw new ApiError(404, "Custom role not found");

  const { name, description, permissions } = payload;

  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, "Role name is required");
    role.name = name.trim();
    role.slug = await buildUniqueSlug(companyId, name, role._id);
  }

  if (description !== undefined) role.description = description.trim();
  if (permissions !== undefined) {
    role.permissions = normalizePermissions(permissions, mapToObject(role.permissions));
  }

  await role.save();

  return {
    id: role._id.toString(),
    slug: role.slug,
    name: role.name,
    description: role.description,
    isSystem: false,
    basedOn: role.basedOn,
    permissions: normalizePermissions(mapToObject(role.permissions)),
  };
};

export const deleteCustomRole = async (companyId, roleId) => {
  const role = await CustomRole.findOne({ _id: roleId, companyId, isActive: true });
  if (!role) throw new ApiError(404, "Custom role not found");

  const assignedCount = await User.countDocuments({
    companyId,
    role: role.slug,
    isActive: true,
  });
  if (assignedCount > 0) {
    throw new ApiError(400, "Cannot delete role while users are assigned to it");
  }

  role.isActive = false;
  await role.save();
};

export const getCustomRolePermissions = async (companyId, slug) => {
  const role = await CustomRole.findOne({ companyId, slug, isActive: true }).lean();
  if (!role) return null;
  return normalizePermissions(mapToObject(role.permissions));
};
