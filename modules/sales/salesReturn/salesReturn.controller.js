import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import * as salesReturnService from "./salesReturn.service.js";

const getAll = asyncHandler(async (req, res) => {
  const { page, limit, search, salesType, salesInvoiceId } = req.query;
  const data = await salesReturnService.getAllSalesReturns({
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    search,
    salesType,
    salesInvoiceId,
  });
  res.json(new ApiResponse(200, data));
});

const getOne = asyncHandler(async (req, res) => {
  const data = await salesReturnService.getOneSalesReturn(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data));
});

const getReturnableItems = asyncHandler(async (req, res) => {
  const data = await salesReturnService.getReturnableItems(
    req.companyId,
    req.params.invoiceId
  );
  res.json(new ApiResponse(200, data));
});

const create = asyncHandler(async (req, res) => {
  const data = await salesReturnService.createSalesReturn({
    ...req.body,
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
  });
  res.status(201).json(new ApiResponse(201, data, "Sales return created"));
});

export default { getAll, getOne, getReturnableItems, create };
