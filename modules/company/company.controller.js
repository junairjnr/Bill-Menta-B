import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import companyService from "./company.service.js";

const assertOwnCompany = (req, companyId) => {
  if (req.user?.role === "super_admin") return;
  if (String(companyId) !== String(req.companyId)) {
    throw new ApiError(403, "Forbidden - cannot access another company");
  }
};

const getCompanyDetails = asyncHandler(async (req, res) => {
  assertOwnCompany(req, req.params.id);
  const data = await companyService.getCompanyDetails(req.params.id);
  res.json(new ApiResponse(200, data));
});

const getAllCompanies = asyncHandler(async (req, res) => {
  const data = await companyService.getAllCompanies();
  res.json(new ApiResponse(200, data));
});

const updateCompanyDetails = asyncHandler(async (req, res) => {
  assertOwnCompany(req, req.params.id);
  const data = await companyService.updateCompanyDetails(req.params.id, req.body);
  res.json(new ApiResponse(200, data, "Company updated"));
});

export default { getCompanyDetails, getAllCompanies, updateCompanyDetails };
