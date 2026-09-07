import JournalEntry from "./journalEntry.model.js";
import ApiError from "../../../utils/ApiError.js";
import { getNextJournalNo as nextJournalNo } from "../../documentNumber/documentNumber.service.js";

const round2 = (n) => Number(Number(n).toFixed(2));

export const generateJournalNo = nextJournalNo;

const validateBalance = (lines) => {
  const totalDebit = round2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (l.credit || 0), 0));

  if (Math.abs(totalDebit - totalCredit) > 0.009) {
    throw new ApiError(
      400,
      `Journal not balanced: Dr ${totalDebit} ≠ Cr ${totalCredit}`
    );
  }
  if (totalDebit === 0) throw new ApiError(400, "Journal entry has zero amount");

  return { totalDebit, totalCredit };
};

export const createJournalEntry = async (
  {
    companyId,
    branchId,
    financialYearId,
    entryDate,
    referenceType,
    referenceId,
    referenceNo,
    narration,
    lines,
    userId,
    isReversal = false,
    originalJournalId,
  },
  session = null
) => {
  const { totalDebit, totalCredit } = validateBalance(lines);
  const journalNo = await generateJournalNo(companyId, financialYearId, session);
  const opts = session ? { session } : {};

  const [entry] = await JournalEntry.create(
    [
      {
        companyId,
        branchId,
        financialYearId,
        journalNo,
        entryDate: new Date(entryDate),
        referenceType,
        referenceId,
        referenceNo,
        narration,
        lines,
        totalDebit,
        totalCredit,
        isReversal,
        originalJournalId,
        status: "posted",
        createdBy: userId,
        updatedBy: userId,
      },
    ],
    opts
  );

  return entry;
};

export const reverseJournalEntry = async (
  { companyId, branchId, financialYearId, journalId, entryDate, userId },
  session = null
) => {
  const original = await JournalEntry.findOne({
    _id: journalId,
    companyId,
    status: "posted",
  }).session(session);

  if (!original) throw new ApiError(404, "Journal entry not found or already reversed");

  const reversedLines = original.lines.map((line) => ({
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    debit: line.credit,
    credit: line.debit,
    customerId: line.customerId,
    vendorId: line.vendorId,
    narration: `Reversal of ${original.journalNo}`,
  }));

  const reversal = await createJournalEntry(
    {
      companyId,
      branchId,
      financialYearId,
      entryDate: entryDate || new Date(),
      referenceType: "Reversal",
      referenceId: original._id,
      referenceNo: original.journalNo,
      narration: `Reversal of ${original.journalNo}`,
      lines: reversedLines,
      userId,
      isReversal: true,
      originalJournalId: original._id,
    },
    session
  );

  original.status = "reversed";
  original.reversedJournalId = reversal._id;
  original.updatedBy = userId;
  await original.save(session ? { session } : {});

  return reversal;
};

export const getJournalByReference = async (companyId, referenceType, referenceId) =>
  JournalEntry.findOne({ companyId, referenceType, referenceId, status: "posted" }).lean();

export const listJournalEntries = async ({
  companyId,
  branchId,
  financialYearId,
  referenceType,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
}) => {
  const filter = { companyId, branchId, financialYearId, status: "posted" };
  if (referenceType) filter.referenceType = referenceType;

  if (dateFrom || dateTo) {
    filter.entryDate = {};
    if (dateFrom) filter.entryDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.entryDate.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    JournalEntry.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    JournalEntry.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)) || 1,
  };
};

export const getOneJournalEntry = async (companyId, id) => {
  const entry = await JournalEntry.findOne({ _id: id, companyId }).lean();
  if (!entry) throw new ApiError(404, "Journal entry not found");
  return entry;
};
