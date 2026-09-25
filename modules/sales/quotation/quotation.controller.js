import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import * as quotationService from "./quotation.service.js";

const getAll = asyncHandler(async (req, res) => {
  const { page, limit, search, salesType, status } = req.query;
  const data = await quotationService.getAllQuotations({
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    search,
    salesType,
    status,
  });
  res.json(new ApiResponse(200, data));
});

const getOne = asyncHandler(async (req, res) => {
  const data = await quotationService.getOneQuotation(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data));
});

const create = asyncHandler(async (req, res) => {
  const data = await quotationService.createQuotation({
    ...req.body,
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
    userId: req.user.id,
  });
  res.status(201).json(new ApiResponse(201, data, "Quotation created"));
});

const markConverted = asyncHandler(async (req, res) => {
  const data = await quotationService.markQuotationConverted({
    companyId: req.companyId,
    quotationId: req.params.id,
    salesInvoiceId: req.body.salesInvoiceId,
  });
  res.json(new ApiResponse(200, data, "Quotation marked as converted"));
});

export default { getAll, getOne, create, markConverted };
