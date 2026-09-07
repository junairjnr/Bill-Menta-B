import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import branchServices from "./branch.services.js";

const getAll = asyncHandler(async (req, res) => {
  const data = await branchServices.getAll(req.companyId);
  res.json(new ApiResponse(200, data));
});

const getOne = asyncHandler(async (req, res) => {
  const data = await branchServices.getOne(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data));
});

const create = asyncHandler(async (req, res) => {
  const data = await branchServices.createBranch(req.companyId, req.body);
  res
    .status(201)
    .json(new ApiResponse(201, data, "Branch created successfully"));
});

const update = asyncHandler(async (req, res) => {
  const data = await branchServices.update(
    req.companyId,
    req.params.id,
    req.body
  );
  res.json(new ApiResponse(200, data, "Branch updated successfully"));
});

const deactivate = asyncHandler(async (req, res) => {
  await branchServices.deactivate(req.companyId, req.params.id);
  res.json(new ApiResponse(200, null, "Branch deactivated"));
});
const remove = asyncHandler(async (req, res) => {
  await branchServices.remove(req.companyId, req.params.id);
  res.json(new ApiResponse(200, null, "Branch removed"));
});

export default { getAll, getOne, create, update, deactivate, remove };
