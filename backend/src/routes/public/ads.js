import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/ads", (req, res) => {
  try {
    const position = String(req.query.position || "");
    const rows = db
      .prepare(
        `SELECT id, image_path, href, position FROM ads WHERE active=1 AND (?='' OR position=?) ORDER BY id DESC`
      )
      .all(position, position);
    res.json({ ok: true, list: rows });
  } catch (e) {
    console.error("GET /ads:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/ads/click/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare("UPDATE ads SET clicks = clicks + 1 WHERE id=?").run(id);
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /ads/click/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

