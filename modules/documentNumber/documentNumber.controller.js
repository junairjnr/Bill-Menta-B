import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { getNextDocumentNumber } from "./documentNumber.service.js";

export const previewNextNumber = asyncHandler(async (req, res) => {
  const { documentType, salesType, salesInvoiceId } = req.query;

  const data = await getNextDocumentNumber(
    req.companyId,
    req.fyId,
    documentType,
    { salesType, salesInvoiceId }
  );

  res.json(new ApiResponse(200, data));
});

export default { previewNextNumber };
