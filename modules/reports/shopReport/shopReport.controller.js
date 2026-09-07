import ApiResponse from "../../../utils/ApiResponse.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import { getShopReport } from "./shopReport.service.js";

export const shopReport = asyncHandler(async (req, res) => {
  const { partyType, partyId, customerId, vendorId, dateFrom, dateTo, page, limit } =
    req.query;

  const data = await getShopReport({
    companyId: req.companyId,
    financialYearId: req.fyId,
    partyType,
    partyId: partyId || customerId || vendorId,
    dateFrom,
    dateTo,
    page,
    limit,
  });

  res.json(new ApiResponse(200, data));
});
