import asyncHandler  from "../../../utils/asyncHandler.js";
import ApiResponse   from "../../../utils/ApiResponse.js";
import PurchaseInvoice from "../../purchase/purchaseInvoice/purchaseInvoice.model.js";
import {
  getPurchaseInvoiceTaxTotals,
  withPurchaseInvoiceTaxTotals,
} from "./purchaseReport.tax.js";


// ── 2. PURCHASE REPORT ────────────────────────────────────────
export const purchaseReport = asyncHandler(async (req, res) => {
  const {
    dateFrom,
    dateTo,
    vendorId,
    warehouseId,
    status,
    page  = 1,
    limit = 50,
  } = req.query;

  const filter = {
    companyId:       req.companyId,
    branchId:        req.branchId,
    financialYearId: req.fyId,
    isActive:        true,
  };

  // Date range
  if (dateFrom || dateTo) {
    filter.purchaseDate = {};
    if (dateFrom) filter.purchaseDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.purchaseDate.$lte = end;
    }
  }

  if (vendorId)     filter.vendorId     = vendorId;
  if (warehouseId)  filter.warehouseId  = warehouseId;
  if (status)       filter.status       = status;

  const skip = (Number(page) - 1) * Number(limit);

  const [rawData, total] = await Promise.all([
    PurchaseInvoice.find(filter)
      .populate("vendorId",    "name phone")
      .populate("warehouseId", "name code")
      .select("invoiceNo vendorInvoiceNo purchaseDate vendorId vendorSnapshot warehouseId items netAmount totalSGST totalCGST totalTax grandTotal status")
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    PurchaseInvoice.countDocuments(filter),
  ]);

  const data = rawData.map(withPurchaseInvoiceTaxTotals);

  // Summary totals
  const allData = await PurchaseInvoice.find(filter)
    .select("items netAmount totalSGST totalCGST totalTax grandTotal")
    .lean();

  const summary = allData.reduce(
    (acc, row) => {
      const tax = getPurchaseInvoiceTaxTotals(row);
      acc.totalNetAmount += row.netAmount ?? 0;
      acc.totalSGST += tax.totalSGST;
      acc.totalCGST += tax.totalCGST;
      acc.totalTax += tax.totalTax;
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

  summary.totalInvoices = total;
  summary.totalNetAmount = Number(summary.totalNetAmount.toFixed(2));
  summary.totalSGST = Number(summary.totalSGST.toFixed(2));
  summary.totalCGST = Number(summary.totalCGST.toFixed(2));
  summary.totalTax = Number(summary.totalTax.toFixed(2));
  summary.grandTotal = Number(summary.grandTotal.toFixed(2));

  res.json(new ApiResponse(200, {
    data,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    hasNext:    Number(page) < Math.ceil(total / Number(limit)),
    summary,
  }));
});
