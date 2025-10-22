import express from "express";
import multer from "multer";
import path from "path";
import db from "../../db.js";
import { authMiddleware } from "../../middlewares/auth.js";
import { PHOTOS_DIR } from "../../config/uploads.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PHOTOS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const fileFilter = (_req, file, cb) => {
  const ok = /image\/(jpeg|png|webp|gif)/.test(file.mimetype);
  cb(ok ? null : new Error("invalid_file_type"), ok);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 8 * 1024 * 1024 } });

router.post("/me/photos", authMiddleware, upload.array("photos", 10), (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ ok: false, error: "no_files" });
    const rows = files.map((f) => ({
      user_id: req.user.uid,
      path: `/uploads/photos/${path.basename(f.path)}`,
    }));
    const stmt = db.prepare(`INSERT INTO photos (user_id, path) VALUES (@user_id, @path)`);
    const insert = db.transaction((items) => items.forEach((it) => stmt.run(it)));
    insert(rows);
    res.json({ ok: true, added: rows.length });
  } catch (e) {
    console.error("/me/photos:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/users/:id/photos", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 100);
    const rows = db
      .prepare(
        `SELECT id, path, album, created_at FROM photos WHERE user_id=? AND IFNULL(is_private,0)=0 ORDER BY id DESC LIMIT ?`
      )
      .all(id, limit);
    res.json({ ok: true, photos: rows });
  } catch (e) {
    console.error("GET /users/:id/photos:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.delete("/me/photos/:id", authMiddleware, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const photo = db.prepare("SELECT * FROM photos WHERE id=?").get(id);
    if (!photo || photo.user_id !== req.user.uid) return res.status(404).json({ ok: false, error: "not_found" });
    db.prepare("DELETE FROM photos WHERE id=?").run(id);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /me/photos/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

