import Expense from "./expense.model.js";
import ApiError from "../../utils/ApiError.js";
import { withTransaction, sessionOpts } from "../../utils/withTransaction.js";
import { postExpense, reverseDocumentJournal } from "../accounting/journal/posting.service.js";
import { getNextExpenseNo } from "../documentNumber/documentNumber.service.js";
import { regexContains } from "../../utils/escapeRegex.js";
import { optionalSearchString } from "../../utils/sanitizeInput.js";

const baseFilter = ({ companyId, branchId, financialYearId }) => ({
  companyId,
  branchId,
  financialYearId,
  isActive: true,
  status: { $ne: "cancelled" },
});

export const createExpense = async (ctx, body) => {
  return withTransaction(async (session) => {
    const expenseNo = await getNextExpenseNo(ctx.companyId, ctx.financialYearId);

    const [expense] = await Expense.create(
      [
        {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          financialYearId: ctx.financialYearId,
          expenseNo,
          date: body.date,
          category: body.category,
          title: body.title,
          amount: Number(body.amount),
          paymentMode: body.paymentMode || "cash",
          bankAccountId: body.bankAccountId || undefined,
          referenceNo: body.referenceNo,
          notes: body.notes,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      ],
      sessionOpts(session)
    );

    await postExpense(
      {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        financialYearId: ctx.financialYearId,
        expense,
        userId: ctx.userId,
      },
      session
    );

    return expense;
  });
};

export const updateExpense = async (ctx, id, body) => {
  const doc = await Expense.findOne({
    _id: id,
    ...baseFilter(ctx),
  });

  if (!doc) throw new ApiError(404, "Expense not found");

  if (body.date !== undefined) doc.date = body.date;
  if (body.category !== undefined) doc.category = body.category;
  if (body.title !== undefined) doc.title = body.title;
  if (body.amount !== undefined) doc.amount = Number(body.amount);
  if (body.paymentMode !== undefined) doc.paymentMode = body.paymentMode;
  if (body.bankAccountId !== undefined) doc.bankAccountId = body.bankAccountId || undefined;
  if (body.referenceNo !== undefined) doc.referenceNo = body.referenceNo;
  if (body.notes !== undefined) doc.notes = body.notes;
  doc.updatedBy = ctx.userId;

  await doc.save();
  return doc;
};

export const deleteExpense = async (ctx, id) => {
  return withTransaction(async (session) => {
    const doc = await Expense.findOne({
      _id: id,
      ...baseFilter(ctx),
    }).session(session);

    if (!doc) throw new ApiError(404, "Expense not found");

    await reverseDocumentJournal(
      {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        financialYearId: ctx.financialYearId,
        referenceType: "Expense",
        referenceId: doc._id,
        entryDate: new Date(),
        userId: ctx.userId,
      },
      session
    );

    doc.status = "cancelled";
    doc.isActive = false;
    doc.updatedBy = ctx.userId;
    await doc.save({ session });
    return doc;
  });
};

export const getExpense = async (ctx, id) => {
  const doc = await Expense.findOne({
    _id: id,
    companyId: ctx.companyId,
    financialYearId: ctx.financialYearId,
    isActive: { $ne: false },
  }).lean();

  if (!doc) throw new ApiError(404, "Expense not found");
  return doc;
};

export const listExpenses = async (ctx, query) => {
  const { category, paymentMode, dateFrom, dateTo, search, page = 1, limit = 20 } = query;
  const filter = baseFilter(ctx);

  if (category) filter.category = category;
  if (paymentMode) filter.paymentMode = paymentMode;
  if (search) {
    const safeSearch = optionalSearchString(search);
    if (safeSearch) {
      filter.$or = [
        { expenseNo: regexContains(safeSearch) },
        { title: regexContains(safeSearch) },
      ];
    }
  }
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Expense.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit)) || 1;

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages,
    hasNext: Number(page) < totalPages,
  };
};
