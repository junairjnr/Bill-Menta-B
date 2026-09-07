import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import * as coaService from "./chartOfAccount/chartOfAccount.service.js";
import * as journalService from "./journal/journal.service.js";
import * as manualJournalService from "./journal/manualJournal.service.js";
import * as reportsService from "./reports/financialReports.service.js";

const scope = (req) => ({
  companyId: req.companyId,
  branchId: req.branchId,
  financialYearId: req.fyId,
  dateFrom: req.query.dateFrom,
  dateTo: req.query.dateTo,
});

export const listAccounts = asyncHandler(async (req, res) => {
  const data = await coaService.listAccounts(req.companyId, req.query);
  res.json(new ApiResponse(200, data));
});

export const createAccount = asyncHandler(async (req, res) => {
  const data = await coaService.createAccount(req.companyId, req.body);
  res.status(201).json(new ApiResponse(201, data, "Account created"));
});

export const updateAccount = asyncHandler(async (req, res) => {
  const data = await coaService.updateAccount(req.companyId, req.params.id, req.body);
  res.json(new ApiResponse(200, data, "Account updated"));
});

export const listJournals = asyncHandler(async (req, res) => {
  const { referenceType, dateFrom, dateTo, page, limit } = req.query;
  const data = await journalService.listJournalEntries({
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
    referenceType,
    dateFrom,
    dateTo,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  });
  res.json(new ApiResponse(200, data));
});

export const getJournal = asyncHandler(async (req, res) => {
  const data = await journalService.getOneJournalEntry(req.companyId, req.params.id);
  res.json(new ApiResponse(200, data));
});

export const createJournal = asyncHandler(async (req, res) => {
  const data = await manualJournalService.createManualJournal({
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
    entryDate: req.body.entryDate,
    referenceNo: req.body.referenceNo,
    narration: req.body.narration,
    lines: req.body.lines,
    userId: req.user?.id,
  });
  res.status(201).json(new ApiResponse(201, data, "Journal entry created"));
});

export const reverseJournal = asyncHandler(async (req, res) => {
  const data = await journalService.reverseJournalEntry({
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
    journalId: req.params.id,
    entryDate: req.body.entryDate,
    userId: req.user?.id,
  });
  res.json(new ApiResponse(200, data, "Journal reversed"));
});

export const trialBalance = asyncHandler(async (req, res) => {
  const data = await reportsService.getTrialBalance(scope(req));
  res.json(new ApiResponse(200, data));
});

export const profitAndLoss = asyncHandler(async (req, res) => {
  const data = await reportsService.getProfitAndLoss(scope(req));
  res.json(new ApiResponse(200, data));
});

export const balanceSheet = asyncHandler(async (req, res) => {
  const data = await reportsService.getBalanceSheet(scope(req));
  res.json(new ApiResponse(200, data));
});

export const subLedger = asyncHandler(async (req, res) => {
  const { partyId, partyType } = req.query;
  const data = await reportsService.getSubLedger({
    ...scope(req),
    partyId,
    partyType: partyType || "customer",
  });
  res.json(new ApiResponse(200, data));
});

export const customerBalance = asyncHandler(async (req, res) => {
  const data = await reportsService.getCustomerBalance(scope(req), req.params.id);
  res.json(new ApiResponse(200, data));
});

export const vendorBalance = asyncHandler(async (req, res) => {
  const data = await reportsService.getVendorBalance(scope(req), req.params.id);
  res.json(new ApiResponse(200, data));
});

export const generalLedger = asyncHandler(async (req, res) => {
  const data = await reportsService.getGeneralLedger({
    ...scope(req),
    accountCode: req.params.accountCode,
  });
  res.json(new ApiResponse(200, data));
});

export const customerBalances = asyncHandler(async (req, res) => {
  const data = await reportsService.getAllPartyBalances(scope(req), "customer");
  res.json(new ApiResponse(200, data));
});

export const vendorBalances = asyncHandler(async (req, res) => {
  const data = await reportsService.getAllPartyBalances(scope(req), "vendor");
  res.json(new ApiResponse(200, data));
});

export const seedCOA = asyncHandler(async (req, res) => {
  const result = await coaService.seedDefaultChartOfAccounts(req.companyId);
  const data = await coaService.listAccounts(req.companyId);
  const message = result.seeded
    ? `Default chart of accounts seeded (${result.count} accounts)`
    : `Chart of accounts already exists (${result.count} accounts)`;
  res.json(new ApiResponse(200, { ...result, accounts: data }, message));
});

export default {
  listAccounts,
  createAccount,
  updateAccount,
  listJournals,
  getJournal,
  createJournal,
  reverseJournal,
  trialBalance,
  profitAndLoss,
  balanceSheet,
  subLedger,
  customerBalance,
  vendorBalance,
  generalLedger,
  customerBalances,
  vendorBalances,
  seedCOA,
};
