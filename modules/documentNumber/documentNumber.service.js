import SalesInvoice from "../sales/salesInvoice/salesInvoice.model.js";
import PurchaseInvoice from "../purchase/purchaseInvoice/purchaseInvoice.model.js";
import SalesReturn from "../sales/salesReturn/salesReturn.model.js";
import PurchaseReturn from "../purchase/purchaseReturn/purchaseReturn.model.js";
import ReceiptPayment from "../receipt-payment/receiptPayment.model.js";
import Expense from "../expense/expense.model.js";
import JournalEntry from "../accounting/journal/journalEntry.model.js";
import FinancialYear from "../financialYear/financialYear.model.js";
import Company from "../company/company.model.js";
import ApiError from "../../utils/ApiError.js";
import { getFYDocumentCode, getDocumentSequence } from "../../utils/fyCode.js";

export const DOCUMENT_TYPES = {
  SALES_INVOICE: "sales_invoice",
  PURCHASE_INVOICE: "purchase_invoice",
  SALES_RETURN: "sales_return",
  PURCHASE_RETURN: "purchase_return",
  RECEIPT: "receipt",
  PAYMENT: "payment",
  EXPENSE: "expense",
  JOURNAL: "journal",
};

const voucherPrefix = (voucherType) => (voucherType === "receipt" ? "RCPT" : "PAY");

/** Sales: PKS/WH/2026-27/01 or PKS/RT/2026-27/01 */
export const getNextSalesInvoiceNo = async (companyId, financialYearId, salesType) => {
  const [fy, company] = await Promise.all([
    FinancialYear.findById(financialYearId),
    Company.findById(companyId).select("code name"),
  ]);
  if (!fy) throw new ApiError(404, "Financial year not found");
  if (!company) throw new ApiError(404, "Company not found");

  const companyCode = company.code?.toUpperCase();
  if (!companyCode) {
    throw new ApiError(
      400,
      "Company code not set. Set company code in company settings before creating invoices."
    );
  }

  const typeCode = salesType === "retail" ? "RT" : "WH";
  const prefix = `${companyCode}/${typeCode}/${fy.label}/`;

  const last = await SalesInvoice.findOne(
    {
      companyId,
      financialYearId,
      salesType,
      invoiceNo: { $regex: `^${prefix.replace(/\//g, "\\/")}` },
    },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } }
  );

  if (!last) return `${prefix}01`;

  const lastNo = parseInt(last.invoiceNo.split("/").pop(), 10) || 0;
  return `${prefix}${String(lastNo + 1).padStart(2, "0")}`;
};

/** Purchase: PKS/PI/2026-27/01 */
export const getNextPurchaseInvoiceNo = async (companyId, financialYearId) => {
  const [fy, company] = await Promise.all([
    FinancialYear.findById(financialYearId),
    Company.findById(companyId).select("code name"),
  ]);
  if (!fy) throw new ApiError(404, "Financial year not found");
  if (!company) throw new ApiError(404, "Company not found");

  const companyCode = company.code?.toUpperCase();
  if (!companyCode) {
    throw new ApiError(
      400,
      "Company code not set. Set company code in company settings before creating invoices."
    );
  }

  const prefix = `${companyCode}/PI/${fy.label}/`;

  const last = await PurchaseInvoice.findOne(
    {
      companyId,
      financialYearId,
      invoiceNo: { $regex: `^${prefix.replace(/\//g, "\\/")}` },
    },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } }
  );

  if (!last) return `${prefix}01`;

  const lastNo = parseInt(last.invoiceNo.split("/").pop(), 10) || 0;
  return `${prefix}${String(lastNo + 1).padStart(2, "0")}`;
};

/** Sales return: PKS/SR-WH/2026-27/01 */
export const getNextSalesReturnNo = async (companyId, financialYearId, salesType) => {
  const [fy, company] = await Promise.all([
    FinancialYear.findById(financialYearId),
    Company.findById(companyId).select("code name"),
  ]);
  if (!fy) throw new ApiError(404, "Financial year not found");
  if (!company) throw new ApiError(404, "Company not found");

  const companyCode = company.code?.toUpperCase();
  if (!companyCode) {
    throw new ApiError(400, "Company code not set. Set company code before creating returns.");
  }

  const typeCode = salesType === "retail" ? "SR-RT" : "SR-WH";
  const prefix = `${companyCode}/${typeCode}/${fy.label}/`;

  const last = await SalesReturn.findOne(
    {
      companyId,
      financialYearId,
      salesType,
      returnNo: { $regex: `^${prefix.replace(/\//g, "\\/")}` },
    },
    { returnNo: 1 },
    { sort: { createdAt: -1 } }
  );

  if (!last) return `${prefix}01`;

  const lastNo = parseInt(last.returnNo.split("/").pop(), 10) || 0;
  return `${prefix}${String(lastNo + 1).padStart(2, "0")}`;
};

/** Purchase return: PKS/PR/2026-27/01 */
export const getNextPurchaseReturnNo = async (companyId, financialYearId) => {
  const [fy, company] = await Promise.all([
    FinancialYear.findById(financialYearId),
    Company.findById(companyId).select("code name"),
  ]);
  if (!fy) throw new ApiError(404, "Financial year not found");
  if (!company) throw new ApiError(404, "Company not found");

  const companyCode = company.code?.toUpperCase();
  if (!companyCode) {
    throw new ApiError(400, "Company code not set. Set company code before creating returns.");
  }

  const prefix = `${companyCode}/PR/${fy.label}/`;

  const last = await PurchaseReturn.findOne(
    {
      companyId,
      financialYearId,
      returnNo: { $regex: `^${prefix.replace(/\//g, "\\/")}` },
    },
    { returnNo: 1 },
    { sort: { createdAt: -1 } }
  );

  if (!last) return `${prefix}01`;

  const lastNo = parseInt(last.returnNo.split("/").pop(), 10) || 0;
  return `${prefix}${String(lastNo + 1).padStart(2, "0")}`;
};

/** Receipt / Payment: RCPT-2026-2027-0001 or PAY-2026-2027-0001 */
export const getNextVoucherNo = async (companyId, financialYearId, voucherType) => {
  const fy = await FinancialYear.findById(financialYearId);
  if (!fy) throw new ApiError(404, "Financial year not found");

  const prefix = `${voucherPrefix(voucherType)}-${getFYDocumentCode(fy.label)}`;

  const last = await ReceiptPayment.findOne(
    { companyId, financialYearId, voucherType },
    { voucherNo: 1 },
    { sort: { createdAt: -1 } }
  );

  if (!last) return `${prefix}-0001`;

  const lastNo = getDocumentSequence(last.voucherNo);
  return `${prefix}-${String(lastNo + 1).padStart(4, "0")}`;
};

/** Expense: EXP-2026-2027-0001 */
export const getNextExpenseNo = async (companyId, financialYearId) => {
  const fy = await FinancialYear.findById(financialYearId);
  if (!fy) throw new ApiError(404, "Financial year not found");

  const prefix = `EXP-${getFYDocumentCode(fy.label)}`;
  const last = await Expense.findOne(
    { companyId, financialYearId },
    { expenseNo: 1 },
    { sort: { createdAt: -1 } }
  );

  if (!last) return `${prefix}-0001`;

  const lastNo = getDocumentSequence(last.expenseNo);
  return `${prefix}-${String(lastNo + 1).padStart(4, "0")}`;
};

/** Journal: JE-2026-2027-0001 */
export const getNextJournalNo = async (companyId, financialYearId, session = null) => {
  const fy = await FinancialYear.findById(financialYearId).session(session);
  if (!fy) throw new ApiError(404, "Financial year not found");

  const prefix = `JE-${getFYDocumentCode(fy.label)}`;
  const last = await JournalEntry.findOne(
    { companyId, financialYearId },
    { journalNo: 1 },
    { sort: { createdAt: -1 } }
  ).session(session);

  if (!last) return `${prefix}-0001`;

  const lastNo = getDocumentSequence(last.journalNo);
  return `${prefix}-${String(lastNo + 1).padStart(4, "0")}`;
};

export const getNextDocumentNumber = async (
  companyId,
  financialYearId,
  documentType,
  { salesType, salesInvoiceId } = {}
) => {
  switch (documentType) {
    case DOCUMENT_TYPES.SALES_INVOICE: {
      if (!salesType) throw new ApiError(400, "salesType is required (retail or wholesale)");
      const nextNumber = await getNextSalesInvoiceNo(companyId, financialYearId, salesType);
      return { documentType, nextNumber, salesType };
    }
    case DOCUMENT_TYPES.PURCHASE_INVOICE: {
      const nextNumber = await getNextPurchaseInvoiceNo(companyId, financialYearId);
      return { documentType, nextNumber };
    }
    case DOCUMENT_TYPES.SALES_RETURN: {
      let resolvedSalesType = salesType;
      if (!resolvedSalesType && salesInvoiceId) {
        const invoice = await SalesInvoice.findOne({
          _id: salesInvoiceId,
          companyId,
          financialYearId,
        }).select("salesType");
        if (!invoice) throw new ApiError(404, "Sales invoice not found");
        resolvedSalesType = invoice.salesType;
      }
      if (!resolvedSalesType) {
        throw new ApiError(400, "salesType or salesInvoiceId is required for sales return number");
      }
      const nextNumber = await getNextSalesReturnNo(
        companyId,
        financialYearId,
        resolvedSalesType
      );
      return { documentType, nextNumber, salesType: resolvedSalesType };
    }
    case DOCUMENT_TYPES.PURCHASE_RETURN: {
      const nextNumber = await getNextPurchaseReturnNo(companyId, financialYearId);
      return { documentType, nextNumber };
    }
    case DOCUMENT_TYPES.RECEIPT: {
      const nextNumber = await getNextVoucherNo(companyId, financialYearId, "receipt");
      return { documentType, nextNumber };
    }
    case DOCUMENT_TYPES.PAYMENT: {
      const nextNumber = await getNextVoucherNo(companyId, financialYearId, "payment");
      return { documentType, nextNumber };
    }
    case DOCUMENT_TYPES.EXPENSE: {
      const nextNumber = await getNextExpenseNo(companyId, financialYearId);
      return { documentType, nextNumber };
    }
    case DOCUMENT_TYPES.JOURNAL: {
      const nextNumber = await getNextJournalNo(companyId, financialYearId);
      return { documentType, nextNumber };
    }
    default:
      throw new ApiError(
        400,
        `Invalid documentType. Allowed: ${Object.values(DOCUMENT_TYPES).join(", ")}`
      );
  }
};
