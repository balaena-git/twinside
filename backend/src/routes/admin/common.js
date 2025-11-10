import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { UPLOADS_ROOT } from "../../config.js";

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const randomFileName = (originalName = "") => {
  const ext = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
};

const createStorage = (dir) =>
  multer.diskStorage({
    destination: (_, __, cb) => cb(null, dir),
    filename: (_, file, cb) => cb(null, randomFileName(file.originalname)),
  });

export function createUploaders() {
  const avatarsDir = path.join(UPLOADS_ROOT, "avatars");
  const supportDir = path.join(UPLOADS_ROOT, "support");
  [avatarsDir, supportDir].forEach(ensureDir);

  return {
    avatarUpload: multer({ storage: createStorage(avatarsDir) }),
    supportUpload: multer({ storage: createStorage(supportDir) }),
  };
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
