import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import * as svc from "./expense.service.js";

const ctx = (req) => ({
  companyId: req.companyId,
  branchId: req.branchId,
  financialYearId: req.fyId,
  userId: req.user?.id,
});

export const createExpense = asyncHandler(async (req, res) => {
  const data = await svc.createExpense(ctx(req), req.body);
  res.status(201).json(new ApiResponse(201, data, "Expense created"));
});

export const updateExpense = asyncHandler(async (req, res) => {
  const data = await svc.updateExpense(ctx(req), req.params.id, req.body);
  res.json(new ApiResponse(200, data, "Expense updated"));
});

export const deleteExpense = asyncHandler(async (req, res) => {
  await svc.deleteExpense(ctx(req), req.params.id);
  res.json(new ApiResponse(200, null, "Expense cancelled"));
});

export const getExpense = asyncHandler(async (req, res) => {
  const data = await svc.getExpense(ctx(req), req.params.id);
  res.json(new ApiResponse(200, data));
});

export const listExpenses = asyncHandler(async (req, res) => {
  const data = await svc.listExpenses(ctx(req), req.query);
  res.json(new ApiResponse(200, data));
});
