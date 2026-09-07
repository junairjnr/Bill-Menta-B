import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import { sendExcel } from "../../utils/excelExport.js";
import { listColumnMeta, getReportConfig } from "./export.config.js";
import { exportReport } from "./export.service.js";

export const getColumns = asyncHandler(async (req, res) => {
  const meta = listColumnMeta(req.params.reportType);
  if (!meta) throw new ApiError(404, "Export report type not found");
  res.json(new ApiResponse(200, meta));
});

export const downloadExcel = asyncHandler(async (req, res) => {
  const { reportType } = req.params;
  const config = getReportConfig(reportType);
  if (!config) throw new ApiError(404, "Export report type not found");

  const { columns = [] } = req.body || {};
  const result = await exportReport(
    reportType,
    {
      companyId: req.companyId,
      branchId: req.branchId,
      financialYearId: req.fyId,
      query: req.query,
    },
    columns
  );

  if (!result) throw new ApiError(404, "Export report type not found");
  if (!result.columns.length) throw new ApiError(400, "Select at least one column");

  await sendExcel(res, result.rows, result.columns, result.filename, result.sheetName);
});

export default { getColumns, downloadExcel };
