import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { UPLOADS_ROOT } from "../../config.js";

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const randomFileName = (originalName = "") => {
  const ext = path.extname(originalName).toLowerCase();
  const random = crypto.randomBytes(16).toString("hex");
  return `${Date.now()}-${random}${ext}`;
};

const createStorage = (dir) =>
  multer.diskStorage({
    destination: (_, __, cb) => cb(null, dir),
    filename: (_, file, cb) => cb(null, randomFileName(file.originalname)),
  });

const createFileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.has(file.mimetype)) return cb(null, true);
  const error = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
  error.message = "unsupported_file_type";
  return cb(error);
};

export function createUploaders() {
  const avatarsDir = path.join(UPLOADS_ROOT, "avatars");
  const supportDir = path.join(UPLOADS_ROOT, "support");
  [avatarsDir, supportDir].forEach(ensureDir);

  const avatarUpload = multer({
    storage: createStorage(avatarsDir),
    fileFilter: createFileFilter(IMAGE_MIME_TYPES),
    limits: { fileSize: 2 * 1024 * 1024 },
  });

  const supportUpload = multer({
    storage: createStorage(supportDir),
    fileFilter: createFileFilter(IMAGE_MIME_TYPES),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  return { avatarUpload, supportUpload };
}

export async function runMulter(middleware, req, res) {
  await new Promise((resolve, reject) => {
    middleware(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function respondMulterError(res, err) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ ok: false, error: "file_too_large" });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ ok: false, error: err.message || "invalid_file" });
    }
  }
  return res.status(400).json({ ok: false, error: "upload_failed" });
}

export function logAdminRequest(req, _res, next) {
  console.log("📡 Admin API hit:", req.method, req.originalUrl);
  next();
}

const PUBLIC_PATHS = new Set(["/login", "/check-session"]);

export function adminSessionGuard(req, res, next) {
  if (req.method === "OPTIONS") return next();
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (req.session?.admin) return next();
  return res.status(401).json({ ok: false, error: "admin_unauthorized" });
}

export function ensureValidId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

export const ensureValidUserId = ensureValidId;
