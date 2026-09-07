import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse  from "../../utils/ApiResponse.js";
import * as fyService from "./financialYear.services.js";

const getAll = asyncHandler(async (req, res) => {
  const data = await fyService.getAllFY(req.companyId);
  res.json(new ApiResponse(200, data));
});

const getActive = asyncHandler(async (req, res) => {
  const data = await fyService.getActiveFY(req.companyId);
  res.json(new ApiResponse(200, data));
});

const create = asyncHandler(async (req, res) => {
  const { startYear } = req.body;
  if (!startYear) throw new Error("startYear is required");
  const data = await fyService.createFinancialYear(req.companyId, Number(startYear));
  res.status(201).json(new ApiResponse(201, data, "Financial year created"));
});

const switchFY = asyncHandler(async (req, res) => {
  const data = await fyService.switchFY(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data, "Switched to financial year"));
});

const closeFY = asyncHandler(async (req, res) => {
  const data = await fyService.closeFY(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data, "Financial year closed successfully"));
});

const deleteFY = asyncHandler(async (req, res) => {
  await fyService.deleteFY(req.companyId, req.params.id);
  res.json(new ApiResponse(200, null, "Financial year deleted"));
});

export default { getAll, getActive, create, switchFY, closeFY, deleteFY };