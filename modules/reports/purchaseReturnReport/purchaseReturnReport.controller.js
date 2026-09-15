import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import PurchaseReturn from "../../purchase/purchaseReturn/purchaseReturn.model.js";

export const purchaseReturnReport = asyncHandler(async (req, res) => {
  const {
    dateFrom,
    dateTo,
    vendorId,
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

  if (vendorId) filter.vendorId = vendorId;
  if (warehouseId) filter.warehouseId = warehouseId;
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);

  const [data, total] = await Promise.all([
    PurchaseReturn.find(filter)
      .populate("vendorId", "name phone")
      .populate("warehouseId", "name code")
      .select(
        "returnNo returnDate vendorId vendorSnapshot warehouseId originalInvoiceNo vendorInvoiceNo netAmount totalSGST totalCGST totalTax grandTotal status"
      )
      .sort({ returnDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    PurchaseReturn.countDocuments(filter),
  ]);

  const allData = await PurchaseReturn.find(filter)
    .select("netAmount totalSGST totalCGST totalTax grandTotal")
    .lean();

  const summary = allData.reduce(
    (acc, row) => {
      acc.totalNetAmount += row.netAmount ?? 0;
      acc.totalSGST += row.totalSGST ?? 0;
      acc.totalCGST += row.totalCGST ?? 0;
      acc.totalTax += row.totalTax ?? 0;
      acc.grandTotal += row.grandTotal ?? 0;
      return acc;
    },
    {
      totalNetAmount: 0,
      totalSGST: 0,
      totalCGST: 0,
      totalTax: 0,
      grandTotal: 0,
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
