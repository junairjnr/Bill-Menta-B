import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import * as warehouseService from "./warehouse.service.js";
import { getWarehouseStock, getStockLedger } from "../stock/stock.services.js";

const getAll = asyncHandler(async (req, res) => {
  const { branchId, ...rest } = req.query;
  const data = await warehouseService.getAll(req.companyId, {
    branchId: branchId || req.branchId,
    ...rest,
  });
  res.json(new ApiResponse(200, data));
});

const getOne = asyncHandler(async (req, res) => {
  const data = await warehouseService.getOne(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data));
});

const create = asyncHandler(async (req, res) => {
  const { branchId, ...rest } = req.body;
  const data = await warehouseService.createWarehouse(
    req.companyId,
    branchId || req.branchId,
    rest
  );
  res.status(201).json(new ApiResponse(201, data, "Warehouse created"));
});

const update = asyncHandler(async (req, res) => {
  const data = await warehouseService.updateWarehouse(
    req.companyId,
    req.params.id,
    req.body
  );
  res.json(new ApiResponse(200, data, "Warehouse updated"));
});

const deactivate = asyncHandler(async (req, res) => {
  await warehouseService.deactivateWarehouse(req.companyId, req.params.id);
  res.json(new ApiResponse(200, null, "Warehouse deactivated"));
});

const deleteWarehouse = asyncHandler(async (req, res) => {
  await warehouseService.deleteWarehouse(req.companyId, req.params.id);
  res.json(new ApiResponse(200, null, "Warehouse deleted"));
});

// Get stock in a warehouse
const getStock = asyncHandler(async (req, res) => {
  const data = await getWarehouseStock({
    companyId: req.companyId,
    warehouseId: req.params.id,
    financialYearId: req.fyId,
  });
  res.json(new ApiResponse(200, data));
});

// Get stock ledger for a warehouse
const getLedger = asyncHandler(async (req, res) => {
  const { itemId, page, limit } = req.query;
  const data = await getStockLedger({
    companyId: req.companyId,
    warehouseId: req.params.id,
    financialYearId: req.fyId,
    itemId,
    page: Number(page) || 1,
    limit: Number(limit) || 50,
  });
  res.json(new ApiResponse(200, data));
});

export default {
  getAll,
  getOne,
  create,
  update,
  deactivate,
  getStock,
  getLedger,
  deleteWarehouse,
};
