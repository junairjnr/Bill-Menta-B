import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import * as svc from "./receiptPayment.service.js";

const ctx = (req) => ({
  companyId: req.companyId,
  branchId: req.branchId,
  financialYearId: req.fyId,
  userId: req.user?.id,
});

export const createReceipt = asyncHandler(async (req, res) => {
  const data = await svc.createVoucher({
    ...ctx(req),
    voucherType: "receipt",
    date: req.body.date,
    partyId: req.body.customerId ?? req.body.partyId,
    paymentMode: req.body.paymentMode,
    bankAccountId: req.body.bankAccountId,
    referenceNo: req.body.referenceNo,
    totalAmount: req.body.totalAmount,
    allocations: req.body.allocations,
    notes: req.body.notes,
  });
  res.status(201).json(new ApiResponse(201, data, "Receipt created"));
});

export const createPayment = asyncHandler(async (req, res) => {
  const data = await svc.createVoucher({
    ...ctx(req),
    voucherType: "payment",
    date: req.body.date,
    partyId: req.body.vendorId ?? req.body.partyId,
    paymentMode: req.body.paymentMode,
    bankAccountId: req.body.bankAccountId,
    referenceNo: req.body.referenceNo,
    totalAmount: req.body.totalAmount,
    allocations: req.body.allocations,
    notes: req.body.notes,
  });
  res.status(201).json(new ApiResponse(201, data, "Payment created"));
});

export const listReceipts = asyncHandler(async (req, res) => {
  const { partyId, customerId, paymentMode, dateFrom, dateTo, search, page, limit, invoiceId } =
    req.query;

  if (invoiceId) {
    const data = await svc.getVouchersByInvoice({
      companyId: req.companyId,
      invoiceId,
      invoiceType: "sales",
      voucherType: "receipt",
    });
    return res.json(new ApiResponse(200, data));
  }

  const data = await svc.getAllVouchers({
    ...ctx(req),
    voucherType: "receipt",
    partyId: partyId || customerId,
    paymentMode,
    dateFrom,
    dateTo,
    search,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  });
  res.json(new ApiResponse(200, data));
});

export const listPayments = asyncHandler(async (req, res) => {
  const { partyId, vendorId, paymentMode, dateFrom, dateTo, search, page, limit, invoiceId } =
    req.query;

  if (invoiceId) {
    const data = await svc.getVouchersByInvoice({
      companyId: req.companyId,
      invoiceId,
      invoiceType: "purchase",
      voucherType: "payment",
    });
    return res.json(new ApiResponse(200, data));
  }

  const data = await svc.getAllVouchers({
    ...ctx(req),
    voucherType: "payment",
    partyId: partyId || vendorId,
    paymentMode,
    dateFrom,
    dateTo,
    search,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  });
  res.json(new ApiResponse(200, data));
});

export const getReceipt = asyncHandler(async (req, res) => {
  const data = await svc.getOneVoucher(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data));
});

export const getPayment = asyncHandler(async (req, res) => {
  const data = await svc.getOneVoucher(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data));
});

export const deleteReceipt = asyncHandler(async (req, res) => {
  const data = await svc.deleteVoucher(req.companyId, req.params.id, req.user?.id);
  res.json(new ApiResponse(200, data));
});

export const deletePayment = asyncHandler(async (req, res) => {
  const data = await svc.deleteVoucher(req.companyId, req.params.id, req.user?.id);
  res.json(new ApiResponse(200, data));
});

export const customerOutstanding = asyncHandler(async (req, res) => {
  const data = await svc.getOutstandingInvoices({
    companyId: req.companyId,
    financialYearId: req.fyId,
    partyId: req.params.id,
    invoiceType: "sales",
  });
  res.json(new ApiResponse(200, data));
});

export const vendorOutstanding = asyncHandler(async (req, res) => {
  const data = await svc.getOutstandingInvoices({
    companyId: req.companyId,
    financialYearId: req.fyId,
    partyId: req.params.id,
    invoiceType: "purchase",
  });
  res.json(new ApiResponse(200, data));
});
