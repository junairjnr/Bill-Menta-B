import { getAccountByCode } from "../chartOfAccount/chartOfAccount.service.js";
import { COA } from "../chartOfAccount/defaultAccounts.js";
import { createJournalEntry, reverseJournalEntry, getJournalByReference } from "./journal.service.js";
import ApiError from "../../../utils/ApiError.js";

const round2 = (n) => Number(Number(n).toFixed(2));

const line = (account, { debit = 0, credit = 0, customerId, vendorId, narration } = {}) => ({
  accountId: account._id,
  accountCode: account.code,
  accountName: account.name,
  debit: round2(debit),
  credit: round2(credit),
  customerId,
  vendorId,
  narration,
});

const cashOrBankAccount = async (companyId, paymentMode, session) => {
  const isBank =
    paymentMode === "bank" ||
    paymentMode === "bank_transfer" ||
    paymentMode === "upi" ||
    paymentMode === "cheque" ||
    paymentMode === "card";
  return getAccountByCode(companyId, isBank ? COA.BANK : COA.CASH, session);
};

const appendPaymentLines = async ({
  lines,
  companyId,
  paymentLines,
  side,
  narrationPrefix,
  session,
}) => {
  for (const payment of paymentLines) {
    const amount = round2(payment.amount);
    if (amount <= 0) continue;

    const account = await cashOrBankAccount(companyId, payment.paymentMode, session);
    lines.push(
      line(account, {
        [side]: amount,
        narration: `${narrationPrefix} (${payment.paymentMode})`,
      })
    );
  }
};

const appendRoundOffLine = async (lines, companyId, roundOff, narration, session) => {
  const amount = round2(roundOff);
  if (Math.abs(amount) < 0.01) return;

  const roundOffAcc = await getAccountByCode(companyId, COA.ROUND_OFF, session);
  if (amount > 0) {
    lines.push(line(roundOffAcc, { credit: amount, narration }));
    return;
  }

  lines.push(line(roundOffAcc, { debit: Math.abs(amount), narration }));
};

/**
 * Sales Invoice posting:
 * Dr Customer (grandTotal)
 * Cr Sales (netAmount)
 * Cr GST Payable (totalTax)
 * Dr COGS / Cr Inventory (per item avgCost * qty)
 */
export const postSalesInvoice = async (
  {
    companyId,
    branchId,
    financialYearId,
    warehouseId,
    invoice,
    items,
    userId,
  },
  session
) => {
  const existing = await getJournalByReference(companyId, "SalesInvoice", invoice._id);
  if (existing) return existing;

  const [ar, sales, gst, cogs, inventory, cash, expenseAcc] = await Promise.all([
    getAccountByCode(companyId, COA.ACCOUNTS_RECEIVABLE, session),
    getAccountByCode(companyId, COA.SALES, session),
    getAccountByCode(companyId, COA.GST_PAYABLE, session),
    getAccountByCode(companyId, COA.COGS, session),
    getAccountByCode(companyId, COA.INVENTORY, session),
    getAccountByCode(companyId, COA.CASH, session),
    getAccountByCode(companyId, COA.EXPENSE, session),
  ]);

  const lines = [];
  const grandTotal = round2(invoice.grandTotal);
  const paidAmount = round2(invoice.paidAmount ?? 0);
  const balanceAmount = round2(
    invoice.balanceAmount ?? Math.max(0, grandTotal - paidAmount)
  );
  const cashDiscountAmt = round2(invoice.cashDiscountAmt || 0);
  const netAmount = round2(invoice.netAmount);
  const totalTax = round2(invoice.totalTax);
  const billTotal = round2(invoice.billTotal ?? grandTotal + cashDiscountAmt);
  const roundOff = round2(invoice.roundOff ?? billTotal - netAmount - totalTax);
  const isCreditSale = invoice.saleMode === "credit";
  const paymentLines = (invoice.payments || []).filter((p) => round2(p.amount) > 0);
  const hasSplitPayments = paymentLines.length > 0;

  if (isCreditSale) {
    if (hasSplitPayments) {
      await appendPaymentLines({
        lines,
        companyId,
        paymentLines,
        side: "debit",
        narrationPrefix: `Advance received ${invoice.invoiceNo}`,
        session,
      });
    } else if (paidAmount > 0) {
      lines.push(
        line(cash, {
          debit: paidAmount,
          narration: `Advance received ${invoice.invoiceNo}`,
        })
      );
    }
    if (balanceAmount > 0) {
      lines.push(
        line(ar, {
          debit: balanceAmount,
          customerId: invoice.customerId,
          narration: `Sales ${invoice.invoiceNo}`,
        })
      );
    }
  } else if (hasSplitPayments) {
    await appendPaymentLines({
      lines,
      companyId,
      paymentLines,
      side: "debit",
      narrationPrefix: `Sales ${invoice.invoiceNo}`,
      session,
    });
    if (balanceAmount > 0) {
      lines.push(
        line(ar, {
          debit: balanceAmount,
          customerId: invoice.customerId,
          narration: `Sales ${invoice.invoiceNo}`,
        })
      );
    }
  } else if (paidAmount >= grandTotal - 0.009) {
    lines.push(
      line(cash, {
        debit: grandTotal,
        narration: `Sales ${invoice.invoiceNo}`,
      })
    );
  } else if (paidAmount > 0) {
    lines.push(
      line(cash, {
        debit: paidAmount,
        narration: `Cash received ${invoice.invoiceNo}`,
      }),
      line(ar, {
        debit: balanceAmount,
        customerId: invoice.customerId,
        narration: `Sales ${invoice.invoiceNo}`,
      })
    );
  } else {
    lines.push(
      line(ar, {
        debit: grandTotal,
        customerId: invoice.customerId,
        narration: `Sales ${invoice.invoiceNo}`,
      })
    );
  }

  lines.push(
    line(sales, { credit: netAmount, narration: `Sales ${invoice.invoiceNo}` }),
  );

  if (totalTax > 0) {
    lines.push(line(gst, { credit: totalTax, narration: `GST on ${invoice.invoiceNo}` }));
  }

  await appendRoundOffLine(
    lines,
    companyId,
    roundOff,
    `Round off ${invoice.invoiceNo}`,
    session
  );

  if (cashDiscountAmt > 0) {
    lines.push(
      line(expenseAcc, {
        debit: cashDiscountAmt,
        narration: `Cash discount ${invoice.invoiceNo}`,
      })
    );
  }

  let totalCogs = 0;
  for (const row of items) {
    const cogsAmount = round2((row.avgCost ?? 0) * row.qty);
    if (cogsAmount > 0) totalCogs += cogsAmount;
  }

  if (totalCogs > 0) {
    lines.push(
      line(cogs, { debit: round2(totalCogs), narration: `COGS ${invoice.invoiceNo}` }),
      line(inventory, { credit: round2(totalCogs), narration: `Inventory out ${invoice.invoiceNo}` })
    );
  }

  return createJournalEntry(
    {
      companyId,
      branchId,
      financialYearId,
      entryDate: invoice.invoiceDate,
      referenceType: "SalesInvoice",
      referenceId: invoice._id,
      referenceNo: invoice.invoiceNo,
      narration: `Sales invoice ${invoice.invoiceNo}`,
      lines,
      userId,
    },
    session
  );
};

/**
 * Purchase Invoice posting:
 * Dr Inventory (netAmount)
 * Dr GST Input (totalTax)
 * Cr Vendor (grandTotal)
 */
export const postPurchaseInvoice = async (
  { companyId, branchId, financialYearId, invoice, userId },
  session
) => {
  const existing = await getJournalByReference(companyId, "PurchaseInvoice", invoice._id);
  if (existing) return existing;

  const [inventory, gstInput, ap, cash, expenseAcc] = await Promise.all([
    getAccountByCode(companyId, COA.INVENTORY, session),
    getAccountByCode(companyId, COA.GST_INPUT, session),
    getAccountByCode(companyId, COA.ACCOUNTS_PAYABLE, session),
    getAccountByCode(companyId, COA.CASH, session),
    getAccountByCode(companyId, COA.EXPENSE, session),
  ]);

  const netAmount = round2(invoice.netAmount);
  const totalTax = round2(invoice.totalTax);
  const cashDiscountAmt = round2(invoice.cashDiscountAmt || 0);
  const grandTotal = round2(invoice.grandTotal);
  const billTotal = round2(invoice.billTotal ?? grandTotal + cashDiscountAmt);
  const paidAmount = round2(invoice.paidAmount ?? 0);
  const balanceAmount = round2(
    invoice.balanceAmount ?? Math.max(0, grandTotal - paidAmount)
  );
  const roundOff = round2(invoice.roundOff ?? billTotal - netAmount - totalTax);
  const paymentLines = (invoice.payments || []).filter((p) => round2(p.amount) > 0);
  const hasSplitPayments = paymentLines.length > 0;

  const lines = [
    line(inventory, {
      debit: netAmount,
      narration: `Purchase ${invoice.invoiceNo}`,
    }),
    line(gstInput, {
      debit: totalTax,
      narration: `Input GST ${invoice.invoiceNo}`,
    }),
  ];

  if (hasSplitPayments) {
    await appendPaymentLines({
      lines,
      companyId,
      paymentLines,
      side: "credit",
      narrationPrefix: `Payment ${invoice.invoiceNo}`,
      session,
    });
    if (balanceAmount > 0) {
      lines.push(
        line(ap, {
          credit: balanceAmount,
          vendorId: invoice.vendorId,
          narration: `Purchase ${invoice.invoiceNo}`,
        })
      );
    }
  } else if (paidAmount > 0) {
    lines.push(
      line(cash, {
        credit: paidAmount,
        narration: `Payment ${invoice.invoiceNo}`,
      })
    );
    if (balanceAmount > 0) {
      lines.push(
        line(ap, {
          credit: balanceAmount,
          vendorId: invoice.vendorId,
          narration: `Purchase ${invoice.invoiceNo}`,
        })
      );
    }
  } else {
    lines.push(
      line(ap, {
        credit: grandTotal,
        vendorId: invoice.vendorId,
        narration: `Purchase ${invoice.invoiceNo}`,
      })
    );
  }

  await appendRoundOffLine(
    lines,
    companyId,
    -roundOff,
    `Round off ${invoice.invoiceNo}`,
    session
  );

  if (cashDiscountAmt > 0) {
    lines.push(
      line(expenseAcc, {
        credit: cashDiscountAmt,
        narration: `Cash discount ${invoice.invoiceNo}`,
      })
    );
  }

  return createJournalEntry(
    {
      companyId,
      branchId,
      financialYearId,
      entryDate: invoice.purchaseDate,
      referenceType: "PurchaseInvoice",
      referenceId: invoice._id,
      referenceNo: invoice.invoiceNo,
      narration: `Purchase invoice ${invoice.invoiceNo}`,
      lines,
      userId,
    },
    session
  );
};

/**
 * Receipt posting:
 * Dr Cash/Bank
 * Cr Customer (Accounts Receivable)
 */
export const postReceipt = async (
  { companyId, branchId, financialYearId, voucher, userId },
  session
) => {
  const existing = await getJournalByReference(companyId, "ReceiptPayment", voucher._id);
  if (existing) return existing;

  const [cashBank, ar] = await Promise.all([
    cashOrBankAccount(companyId, voucher.paymentMode, session),
    getAccountByCode(companyId, COA.ACCOUNTS_RECEIVABLE, session),
  ]);

  const amount = round2(voucher.totalAmount);
  const lines = [
    line(cashBank, { debit: amount, narration: `Receipt ${voucher.voucherNo}` }),
    line(ar, {
      credit: amount,
      customerId: voucher.partyId,
      narration: `Receipt ${voucher.voucherNo}`,
    }),
  ];

  return createJournalEntry(
    {
      companyId,
      branchId,
      financialYearId,
      entryDate: voucher.date,
      referenceType: "ReceiptPayment",
      referenceId: voucher._id,
      referenceNo: voucher.voucherNo,
      narration: `Customer receipt ${voucher.voucherNo}`,
      lines,
      userId,
    },
    session
  );
};

/**
 * Vendor Payment posting:
 * Dr Vendor (Accounts Payable)
 * Cr Cash/Bank
 */
export const postVendorPayment = async (
  { companyId, branchId, financialYearId, voucher, userId },
  session
) => {
  const existing = await getJournalByReference(companyId, "ReceiptPayment", voucher._id);
  if (existing) return existing;

  const [ap, cashBank] = await Promise.all([
    getAccountByCode(companyId, COA.ACCOUNTS_PAYABLE, session),
    cashOrBankAccount(companyId, voucher.paymentMode, session),
  ]);

  const amount = round2(voucher.totalAmount);
  const lines = [
    line(ap, {
      debit: amount,
      vendorId: voucher.partyId,
      narration: `Payment ${voucher.voucherNo}`,
    }),
    line(cashBank, { credit: amount, narration: `Payment ${voucher.voucherNo}` }),
  ];

  return createJournalEntry(
    {
      companyId,
      branchId,
      financialYearId,
      entryDate: voucher.date,
      referenceType: "ReceiptPayment",
      referenceId: voucher._id,
      referenceNo: voucher.voucherNo,
      narration: `Vendor payment ${voucher.voucherNo}`,
      lines,
      userId,
    },
    session
  );
};

/**
 * Expense posting:
 * Dr Operating Expenses
 * Cr Cash/Bank
 */
export const postExpense = async (
  { companyId, branchId, financialYearId, expense, userId },
  session
) => {
  const existing = await getJournalByReference(companyId, "Expense", expense._id);
  if (existing) return existing;

  const [expenseAcc, cashBank] = await Promise.all([
    getAccountByCode(companyId, COA.EXPENSE, session),
    cashOrBankAccount(companyId, expense.paymentMode, session),
  ]);

  const amount = round2(expense.amount);
  const lines = [
    line(expenseAcc, {
      debit: amount,
      narration: `${expense.category}: ${expense.title}`,
    }),
    line(cashBank, {
      credit: amount,
      narration: `Expense ${expense.expenseNo}`,
    }),
  ];

  return createJournalEntry(
    {
      companyId,
      branchId,
      financialYearId,
      entryDate: expense.date,
      referenceType: "Expense",
      referenceId: expense._id,
      referenceNo: expense.expenseNo,
      narration: `Expense ${expense.expenseNo} - ${expense.title}`,
      lines,
      userId,
    },
    session
  );
};

export const reverseDocumentJournal = async (
  { companyId, branchId, financialYearId, referenceType, referenceId, entryDate, userId },
  session
) => {
  const original = await getJournalByReference(companyId, referenceType, referenceId);
  if (!original) return null;

  return reverseJournalEntry(
    {
      companyId,
      branchId,
      financialYearId,
      journalId: original._id,
      entryDate,
      userId,
    },
    session
  );
};

export const ensureCOAExists = async (companyId, session) => {
  const { getAccountByCode: getAcc } = await import("../chartOfAccount/chartOfAccount.service.js");
  try {
    await getAcc(companyId, COA.SALES, session);
  } catch {
    throw new ApiError(
      500,
      "Chart of accounts not initialized. Contact admin to seed default accounts."
    );
  }
};
