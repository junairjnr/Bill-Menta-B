import fs from "fs";
import path from "path";

const MAX_ATTACHMENTS = 10;

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function getPurchaseUploadDir(companyId) {
  return path.join(process.cwd(), "uploads", String(companyId), "purchase");
}

export function ensureUploadDir(companyId) {
  const dir = getPurchaseUploadDir(companyId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolvePurchaseUploadFile(companyId, fileName) {
  const safeName = path.basename(String(fileName || ""));
  if (!safeName) return null;

  const dir = path.resolve(getPurchaseUploadDir(companyId));
  const fullPath = path.resolve(dir, safeName);

  if (!fullPath.startsWith(`${dir}${path.sep}`) && fullPath !== dir) {
    return null;
  }

  return fullPath;
}

export function normalizeAttachments(companyId, attachments) {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .slice(0, MAX_ATTACHMENTS)
    .map((item) => {
      if (!item?.fileName) return null;

      const fileName = path.basename(String(item.fileName));
      const fullPath = resolvePurchaseUploadFile(companyId, fileName);
      if (!fullPath || !fs.existsSync(fullPath)) return null;

      return {
        fileName,
        originalName: String(item.originalName || fileName).slice(0, 255),
        mimeType: String(item.mimeType || "application/octet-stream").slice(0, 127),
        size: Number(item.size) || 0,
        uploadedAt: item.uploadedAt ? new Date(item.uploadedAt) : new Date(),
      };
    })
    .filter(Boolean);
}

export function deletePurchaseUploadFile(companyId, fileName) {
  const filePath = resolvePurchaseUploadFile(companyId, fileName);
  if (!filePath || !fs.existsSync(filePath)) return false;

  fs.unlinkSync(filePath);
  return true;
}
