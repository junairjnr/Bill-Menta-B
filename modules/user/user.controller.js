import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import userService from "./user.service.js";

export const listUsers = asyncHandler(async (req, res) => {
  const data = await userService.getCompanyUsers(
    req.companyId,
    req.branchId,
    req.user.role
  );
  res.json(new ApiResponse(200, data));
});

export const getUser = asyncHandler(async (req, res) => {
  const data = await userService.getUserById(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data));
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, branchId } = req.body;

  if (!password || typeof password !== "string" || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  const data = await userService.createUser({
    companyId: req.companyId,
    branchId: branchId || req.branchId,
    createdBy: req.user.id,
    name,
    email,
    role: role || "viewer",
    password,
    actorRole: req.user.role,
  });

  res.status(201).json(new ApiResponse(201, data, "User created"));
});

export const updateUser = asyncHandler(async (req, res) => {
  const data = await userService.updateUser(
    req.companyId,
    req.params.id,
    req.body,
    req.user
  );
  res.json(new ApiResponse(200, data, "User updated"));
});

export const deactivateUser = asyncHandler(async (req, res) => {
  await userService.deactivateUser(req.companyId, req.params.id, req.user);
  res.json(new ApiResponse(200, null, "User deactivated"));
});
