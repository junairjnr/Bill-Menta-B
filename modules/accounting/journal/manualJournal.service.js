import { getAccountByCode, getAccountMap } from "../chartOfAccount/chartOfAccount.service.js";
import { createJournalEntry, reverseJournalEntry } from "./journal.service.js";
import ApiError from "../../../utils/ApiError.js";

const round2 = (n) => Number(Number(n).toFixed(2));

const buildLineFromAccount = (account, { debit = 0, credit = 0, customerId, vendorId, narration } = {}) => ({
  accountId: account._id,
  accountCode: account.code,
  accountName: account.name,
  debit: round2(debit),
  credit: round2(credit),
  customerId: customerId || undefined,
  vendorId: vendorId || undefined,
  narration,
});

export const createManualJournal = async (
  {
    companyId,
    branchId,
    financialYearId,
    entryDate,
    referenceNo,
    narration,
    lines,
    userId,
  },
  session = null
) => {
  if (!lines?.length || lines.length < 2) {
    throw new ApiError(400, "At least two journal lines are required");
  }

  const accountMap = await getAccountMap(companyId, session);
  const processedLines = [];

  for (const row of lines) {
    const debit = round2(row.debit || 0);
    const credit = round2(row.credit || 0);

    if (debit === 0 && credit === 0) continue;
    if (debit > 0 && credit > 0) {
      throw new ApiError(400, "A line cannot have both debit and credit");
    }

    let account = row.accountId ? Object.values(accountMap).find((a) => String(a._id) === String(row.accountId)) : null;
    if (!account && row.accountCode) account = accountMap[row.accountCode];
    if (!account) throw new ApiError(400, `Account not found: ${row.accountCode || row.accountId}`);

    if (account.subLedger === "customer" && !row.customerId) {
      throw new ApiError(400, `Customer required for account ${account.code}`);
    }
    if (account.subLedger === "vendor" && !row.vendorId) {
      throw new ApiError(400, `Vendor required for account ${account.code}`);
    }

    processedLines.push(
      buildLineFromAccount(account, {
        debit,
        credit,
        customerId: row.customerId,
        vendorId: row.vendorId,
        narration: row.narration,
      })
    );
  }

  if (processedLines.length < 2) {
    throw new ApiError(400, "At least two non-zero journal lines are required");
  }

  return createJournalEntry(
    {
      companyId,
      branchId,
      financialYearId,
      entryDate,
      referenceType: "Manual",
      referenceNo: referenceNo || "",
      narration: narration || "Manual journal entry",
      lines: processedLines,
      userId,
    },
    session
  );
};

export { reverseJournalEntry, createJournalEntry };
