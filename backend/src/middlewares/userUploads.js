import multer from "multer";
import path from "path";
import { AVATARS_DIR, VERIFY_DIR } from "../config/uploads.js";

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const dir = file.fieldname === "verify_photo" ? VERIFY_DIR : AVATARS_DIR;
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (_req, file, cb) => {
  const ok = /image\/(jpeg|png|webp|gif)/.test(file.mimetype);
  cb(ok ? null : new Error("invalid_file_type"), ok);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export default upload;
