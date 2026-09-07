import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse  from "../../../utils/ApiResponse.js";
import * as salesService from "./salesInvoice.service.js";

const getAll = asyncHandler(async (req, res) => {
  const { page, limit, search, salesType } = req.query;
  const data = await salesService.getAllSalesInvoices({
    companyId:       req.companyId,
    branchId:        req.branchId,
    financialYearId: req.fyId,
    page:            Number(page)  || 1,
    limit:           Number(limit) || 20,
    search,
    salesType,
  });
  res.json(new ApiResponse(200, data));
});

const getOne = asyncHandler(async (req, res) => {
  const data = await salesService.getOneSalesInvoice(
    req.companyId, req.params.id
  );
  res.json(new ApiResponse(200, data));
});

const create = asyncHandler(async (req, res) => {
  const data = await salesService.createSalesInvoice({
    ...req.body,
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
    userId: req.user.id,
  });
  res.status(201).json(new ApiResponse(201, data, "Sales invoice created"));
});

export default { getAll, getOne, create };