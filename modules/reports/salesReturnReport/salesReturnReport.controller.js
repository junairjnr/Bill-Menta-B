import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import SalesReturn from "../../sales/salesReturn/salesReturn.model.js";

export const salesReturnReport = asyncHandler(async (req, res) => {
  const {
    dateFrom,
    dateTo,
    customerId,
    salesType,
    warehouseId,
    status,
    page = 1,
    limit = 50,
  } = req.query;

  const filter = {
    companyId: req.companyId,
    branchId: req.branchId,
    financialYearId: req.fyId,
    isActive: true,
  };

  if (dateFrom || dateTo) {
    filter.returnDate = {};
    if (dateFrom) filter.returnDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.returnDate.$lte = end;
    }
  }

  if (customerId) filter.customerId = customerId;
  if (salesType) filter.salesType = salesType;
  if (warehouseId) filter.warehouseId = warehouseId;
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);

  const [data, total] = await Promise.all([
    SalesReturn.find(filter)
      .populate("customerId", "name phone")
      .populate("warehouseId", "name code")
      .populate("priceLevelId", "name taxPercent")
      .select(
        "returnNo returnDate returnMode salesType customerId customerSnapshot warehouseId priceLevelSnapshot originalInvoiceNo referenceInvoiceNo netAmount totalSGST totalCGST totalTax grandTotal status"
      )
      .sort({ returnDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    SalesReturn.countDocuments(filter),
  ]);

  const allData = await SalesReturn.find(filter)
    .select("netAmount totalSGST totalCGST totalTax grandTotal salesType")
    .lean();

  const summary = allData.reduce(
    (acc, row) => {
      acc.totalNetAmount += row.netAmount ?? 0;
      acc.totalSGST += row.totalSGST ?? 0;
      acc.totalCGST += row.totalCGST ?? 0;
      acc.totalTax += row.totalTax ?? 0;
      acc.grandTotal += row.grandTotal ?? 0;
      if (row.salesType === "retail") acc.retailCount += 1;
      if (row.salesType === "wholesale") acc.wholesaleCount += 1;
      return acc;
    },
    {
      totalNetAmount: 0,
      totalSGST: 0,
      totalCGST: 0,
      totalTax: 0,
      grandTotal: 0,
      retailCount: 0,
      wholesaleCount: 0,
    }
  );

  summary.totalReturns = total;
  summary.totalNetAmount = Number(summary.totalNetAmount.toFixed(2));
  summary.totalSGST = Number(summary.totalSGST.toFixed(2));
  summary.totalCGST = Number(summary.totalCGST.toFixed(2));
  summary.totalTax = Number(summary.totalTax.toFixed(2));
  summary.grandTotal = Number(summary.grandTotal.toFixed(2));

  res.json(
    new ApiResponse(200, {
      data,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      hasNext: Number(page) < Math.ceil(total / Number(limit)),
      summary,
    })
  );
});
