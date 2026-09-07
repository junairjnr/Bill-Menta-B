import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import * as settingsService from "./settings.service.js";
import * as customRoleService from "./customRole.service.js";

export const getMyPermissions = asyncHandler(async (req, res) => {
  const permissions = await settingsService.getEffectivePermissions(
    req.companyId,
    req.user.role
  );
  res.json(new ApiResponse(200, permissions));
});

export const getRolePermissions = asyncHandler(async (req, res) => {
  const data = await settingsService.getAllRolePermissions(req.companyId);
  res.json(new ApiResponse(200, data));
});

export const updateRolePermissions = asyncHandler(async (req, res) => {
  const data = await settingsService.updateRolePermissions(
    req.companyId,
    req.params.role,
    req.body.views
  );
  res.json(new ApiResponse(200, data, "Role permissions updated"));
});

export const getCompanySettings = asyncHandler(async (req, res) => {
  const data = await settingsService.getCompanySettings(req.companyId);
  res.json(new ApiResponse(200, data));
});

export const updateCompanySettings = asyncHandler(async (req, res) => {
  const data = await settingsService.updateCompanySettings(req.companyId, req.body);
  res.json(new ApiResponse(200, data, "Company updated"));
});

export const listRoles = asyncHandler(async (req, res) => {
  const data = await customRoleService.listRoles(req.companyId);
  res.json(new ApiResponse(200, data));
});

export const createRole = asyncHandler(async (req, res) => {
  const data = await customRoleService.createCustomRole(
    req.companyId,
    req.user.id,
    req.body
  );
  res.status(201).json(new ApiResponse(201, data, "Role created"));
});

export const updateRole = asyncHandler(async (req, res) => {
  const data = await customRoleService.updateCustomRole(
    req.companyId,
    req.params.id,
    req.body
  );
  res.json(new ApiResponse(200, data, "Role updated"));
});

export const deleteRole = asyncHandler(async (req, res) => {
  await customRoleService.deleteCustomRole(req.companyId, req.params.id);
  res.json(new ApiResponse(200, null, "Role deleted"));
});
