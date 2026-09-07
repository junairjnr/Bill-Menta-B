import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import * as purchaseReturnService from "./purchaseReturn.service.js";

const getAll = asyncHandler(async (req, res) => {
  const { page, limit, search, purchaseInvoiceId } = req.query;
  const data = await purchaseReturnService.getAllPurchaseReturns({
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    search,
    purchaseInvoiceId,
  });
  res.json(new ApiResponse(200, data));
});

const getOne = asyncHandler(async (req, res) => {
  const data = await purchaseReturnService.getOnePurchaseReturn(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data));
});

const getReturnableItems = asyncHandler(async (req, res) => {
  const data = await purchaseReturnService.getReturnableItems(
    req.companyId,
    req.params.invoiceId
  );
  res.json(new ApiResponse(200, data));
});

const create = asyncHandler(async (req, res) => {
  const data = await purchaseReturnService.createPurchaseReturn({
    ...req.body,
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
  });
  res.status(201).json(new ApiResponse(201, data, "Purchase return created"));
});

export default { getAll, getOne, getReturnableItems, create };
