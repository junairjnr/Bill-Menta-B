import fs from "fs";
import path from "path";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";
import PurchaseInvoice from "../purchase/purchaseInvoice/purchaseInvoice.model.js";
import PurchaseReturn from "../purchase/purchaseReturn/purchaseReturn.model.js";
import {
  deletePurchaseUploadFile,
  resolvePurchaseUploadFile,
} from "./upload.utils.js";

async function isPurchaseAttachmentInUse(companyId, fileName) {
  const filter = { companyId, "attachments.fileName": fileName };
  const [invoice, purchaseReturn] = await Promise.all([
    PurchaseInvoice.exists(filter),
    PurchaseReturn.exists(filter),
  ]);
  return Boolean(invoice || purchaseReturn);
}

export const uploadPurchaseFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const data = {
    fileName: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedAt: new Date().toISOString(),
  };

  res.status(201).json(new ApiResponse(201, data, "File uploaded"));
});

export const downloadPurchaseFile = asyncHandler(async (req, res) => {
  const filePath = resolvePurchaseUploadFile(req.companyId, req.params.fileName);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new ApiError(404, "File not found");
  }

  const downloadName = path.basename(req.query.name || req.params.fileName);
  const disposition = req.query.inline === "1" ? "inline" : "attachment";

  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${downloadName.replace(/"/g, "")}"`
  );
  res.sendFile(filePath);
});

export const deletePurchaseFile = asyncHandler(async (req, res) => {
  const fileName = path.basename(String(req.params.fileName || ""));
  if (!fileName) throw new ApiError(400, "File name is required");

  const filePath = resolvePurchaseUploadFile(req.companyId, fileName);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new ApiError(404, "File not found");
  }

  if (await isPurchaseAttachmentInUse(req.companyId, fileName)) {
    throw new ApiError(
      409,
      "This file is linked to a saved record and cannot be removed here"
    );
  }

  deletePurchaseUploadFile(req.companyId, fileName);
  res.json(new ApiResponse(200, { fileName }, "File removed"));
});
