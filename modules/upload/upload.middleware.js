import multer from "multer";
import path from "path";
import crypto from "crypto";
import ApiError from "../../utils/ApiError.js";
import { ALLOWED_MIME_TYPES, ensureUploadDir } from "./upload.utils.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    try {
      const dir = ensureUploadDir(req.companyId);
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : "";
    const stored = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`;
    cb(null, stored);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new ApiError(400, "Only PDF and image files are allowed"));
  }
  cb(null, true);
}

export const uploadPurchaseDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
}).single("file");
