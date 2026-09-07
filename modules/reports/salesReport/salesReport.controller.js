import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import SalesInvoice from "../../sales/salesInvoice/salesInvoice.model.js";
import {
  getSalesInvoiceTaxTotals,
  withSalesInvoiceTaxTotals,
} from "./salesReport.tax.js";

export const salesReport = asyncHandler(async (req, res) => {
  const {
    dateFrom,
    dateTo,
    customerId,
    salesType,
    warehouseId,
    priceLevelId,
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
    filter.invoiceDate = {};
    if (dateFrom) filter.invoiceDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.invoiceDate.$lte = end;
    }
  }

  if (customerId) filter.customerId = customerId;
  if (salesType) filter.salesType = salesType;
  if (warehouseId) filter.warehouseId = warehouseId;
  if (priceLevelId) filter.priceLevelId = priceLevelId;
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);

  const [rawData, total] = await Promise.all([
    SalesInvoice.find(filter)
      .populate("customerId", "name phone")
      .populate("warehouseId", "name code")
      .populate("priceLevelId", "name taxPercent")
      .select(
        "invoiceNo invoiceDate salesType customerId customerSnapshot warehouseId priceLevelSnapshot items netAmount totalSGST totalCGST totalTax grandTotal status"
      )
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    SalesInvoice.countDocuments(filter),
  ]);

  const data = rawData.map(withSalesInvoiceTaxTotals);

  const allData = await SalesInvoice.find(filter)
    .select("items netAmount totalSGST totalCGST totalTax grandTotal salesType")
    .lean();

  const summary = allData.reduce(
    (acc, row) => {
      const tax = getSalesInvoiceTaxTotals(row);
      acc.totalNetAmount += row.netAmount ?? 0;
      acc.totalSGST += tax.totalSGST;
      acc.totalCGST += tax.totalCGST;
      acc.totalTax += tax.totalTax;
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

  summary.totalInvoices = total;
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
