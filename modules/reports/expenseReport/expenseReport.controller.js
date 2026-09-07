import mongoose from "mongoose";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import Expense from "../../expense/expense.model.js";

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return value;
};

export const expenseReport = asyncHandler(async (req, res) => {
  const { category, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  const filter = {
    companyId: toObjectId(req.companyId),
    branchId: toObjectId(req.branchId),
    financialYearId: toObjectId(req.fyId),
    isActive: true,
    status: { $ne: "cancelled" },
  };

  if (category) filter.category = category;
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

  const [rows, total, summaryRows] = await Promise.all([
    Expense.find(filter)
      .select("expenseNo date category title amount paymentMode referenceNo status")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalPages = Math.ceil(total / Number(limit)) || 1;
  const summary = summaryRows[0] || { totalAmount: 0, count: 0 };

  res.json(
    new ApiResponse(200, {
      rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages,
      hasNext: Number(page) < totalPages,
      summary: {
        totalAmount: Number((summary.totalAmount ?? 0).toFixed(2)),
        count: summary.count ?? total,
      },
    })
  );
});
