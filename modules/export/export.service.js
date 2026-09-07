import customerModel from "../masters/customer/customer.model.js";
import itemModel from "../masters/item/item.model.js";
import Warehouse from "../warehouse/warehouse.model.js";
import * as salesService from "../sales/salesInvoice/salesInvoice.service.js";
import * as purchaseService from "../purchase/purchaseInvoice/purchaseInvoice.services.js";
import * as receiptService from "../receipt-payment/receiptPayment.service.js";
import * as expenseService from "../expense/expense.service.js";
import * as journalService from "../accounting/journal/journal.service.js";
import * as reportsService from "../accounting/reports/financialReports.service.js";
import * as coaService from "../accounting/chartOfAccount/chartOfAccount.service.js";
import { getReportConfig } from "./export.config.js";
import { fetchOperationalReportRows } from "./exportReportData.js";
import { resolveSelectedColumns } from "./exportColumnResolver.js";

const scope = (ctx) => ({
  companyId: ctx.companyId,
  branchId: ctx.branchId,
  financialYearId: ctx.financialYearId,
  dateFrom: ctx.query?.dateFrom,
  dateTo: ctx.query?.dateTo,
});

const fetchRows = async (reportType, ctx) => {
  const { companyId, query = {} } = ctx;

  switch (reportType) {
    case "customers": {
      const filter = { companyId };
      if (query.type) filter.type = query.type;
      return customerModel
        .find(filter)
        .select("name email phone gstin customerType address type")
        .sort({ name: 1 })
        .lean();
    }
    case "products":
      return itemModel
        .find({ companyId })
        .select("name code hsnCode price taxPercent uomId categoryId")
        .populate([{ path: "categoryId", select: "name" }, { path: "uomId", select: "name" }])
        .sort({ name: 1 })
        .lean();
    case "warehouses":
      return Warehouse.find({ companyId }).sort({ name: 1 }).lean();
    case "sales": {
      const result = await salesService.getAllSalesInvoices({
        companyId,
        branchId: ctx.branchId,
        financialYearId: ctx.financialYearId,
        page: 1,
        limit: 10000,
        ...query,
      });
      return result.data || result;
    }
    case "purchase": {
      const result = await purchaseService.getAllPurchaseInvoices({
        companyId,
        branchId: ctx.branchId,
        financialYearId: ctx.financialYearId,
        page: 1,
        limit: 10000,
        ...query,
      });
      return result.data || result;
    }
    case "receipts": {
      const result = await receiptService.getAllVouchers({
        companyId,
        branchId: ctx.branchId,
        financialYearId: ctx.financialYearId,
        voucherType: "receipt",
        partyId: query.partyId || query.customerId,
        page: 1,
        limit: 10000,
        ...query,
      });
      return result.data || result;
    }
    case "payments": {
      const result = await receiptService.getAllVouchers({
        companyId,
        branchId: ctx.branchId,
        financialYearId: ctx.financialYearId,
        voucherType: "payment",
        partyId: query.partyId || query.vendorId,
        page: 1,
        limit: 10000,
        ...query,
      });
      return result.data || result;
    }
    case "expenses": {
      const result = await expenseService.listExpenses(
        {
          companyId,
          branchId: ctx.branchId,
          financialYearId: ctx.financialYearId,
        },
        { page: 1, limit: 10000, ...query }
      );
      return result.data || result;
    }
    case "journals": {
      const result = await journalService.listJournalEntries({
        companyId,
        branchId: ctx.branchId,
        financialYearId: ctx.financialYearId,
        page: 1,
        limit: 10000,
        ...query,
      });
      return result.data || result;
    }
    case "trial-balance": {
      const data = await reportsService.getTrialBalance(scope(ctx));
      return data.rows || [];
    }
    case "customer-balances":
      return reportsService.getAllPartyBalances(scope(ctx), "customer");
    case "chart-of-accounts":
      return coaService.listAccounts(companyId, query);
    case "profit-loss": {
      const data = await reportsService.getProfitAndLoss(scope(ctx));
      return [
        ...(data.income || []).map((r) => ({ ...r, section: "Income" })),
        ...(data.expenses || []).map((r) => ({ ...r, section: "Expenses" })),
      ];
    }
    case "balance-sheet": {
      const data = await reportsService.getBalanceSheet(scope(ctx));
      return [
        ...(data.assets || []).map((r) => ({ ...r, section: "Assets" })),
        ...(data.liabilities || []).map((r) => ({ ...r, section: "Liabilities" })),
        ...(data.equity || []).map((r) => ({ ...r, section: "Equity" })),
      ];
    }
    default: {
      const operational = await fetchOperationalReportRows(reportType, ctx);
      if (operational !== undefined) return operational;
      return null;
    }
  }
};

export const exportReport = async (reportType, ctx, selectedColumns) => {
  const config = getReportConfig(reportType);
  if (!config) return null;

  const rows = await fetchRows(reportType, ctx);
  if (rows === null) return null;

  const selected = resolveSelectedColumns(config, selectedColumns);

  return {
    rows,
    columns: selected,
    filename: config.filename,
    sheetName: config.sheetName,
  };
};
