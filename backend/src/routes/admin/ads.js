import express from "express";
import path from "path";
import db from "../../db.js";
import { UPLOADS_ROOT } from "../../config.js";

export default function createAdsRouter({ adsUpload }) {
  const router = express.Router();

  router.get("/ads", (_req, res) => {
    try {
      const rows = db
        .prepare(
          `SELECT id, image_path, href, position, active, views, clicks, created_at FROM ads ORDER BY id DESC`
        )
        .all();
      res.json({ ok: true, list: rows });
    } catch (e) {
      console.error("/api/admin/ads:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.post("/ads", adsUpload.single("image"), (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ ok: false, error: "image_required" });
      const image_path = `/uploads/ads/${path.basename(file.path)}`;
      const { href = "", position = "global", active = 1 } = req.body;

      const info = db
        .prepare(
          `INSERT INTO ads (image_path, href, position, active) VALUES (?, ?, ?, ?)`
        )
        .run(image_path, String(href), String(position), active ? 1 : 0);

      res.json({ ok: true, id: info.lastInsertRowid, image_path });
    } catch (e) {
      console.error("POST /api/admin/ads:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.patch("/ads/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const row = db.prepare("SELECT * FROM ads WHERE id=?").get(id);
      if (!row) return res.status(404).json({ ok: false, error: "not_found" });
      const up = {
        href: req.body.href !== undefined ? String(req.body.href) : row.href,
        position: req.body.position !== undefined ? String(req.body.position) : row.position,
        active: req.body.active !== undefined ? (req.body.active ? 1 : 0) : row.active,
        id,
      };
      db.prepare(
        `UPDATE ads SET href=@href, position=@position, active=@active, updated_at=datetime('now') WHERE id=@id`
      ).run(up);
      res.json({ ok: true });
    } catch (e) {
      console.error("PATCH /api/admin/ads/:id:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.delete("/ads/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const row = db.prepare("SELECT image_path FROM ads WHERE id=?").get(id);
      db.prepare("DELETE FROM ads WHERE id=?").run(id);
      // file cleanup is optional; keep files for audit/caching simplicity
      res.json({ ok: true });
    } catch (e) {
      console.error("DELETE /api/admin/ads/:id:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  return router;
}

