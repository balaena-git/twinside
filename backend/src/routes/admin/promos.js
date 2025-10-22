import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/promos", (_req, res) => {
  try {
    const list = db
      .prepare(
        `SELECT p.*, (SELECT COUNT(*) FROM promo_redemptions r WHERE r.promo_id = p.id) AS redeemed
         FROM promos p ORDER BY p.id DESC`
      )
      .all();
    res.json({ ok: true, list });
  } catch (e) {
    console.error("/api/admin/promos:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/promos", (req, res) => {
  try {
    const { code, value, active = 1, max_redemptions = null, per_user_limit = 1, expires_at = null } = req.body;
    const normalized = String(code || "").trim().toUpperCase();
    if (!/^[-A-Z0-9_]{3,32}$/.test(normalized)) {
      return res.status(400).json({ ok: false, error: "invalid_code" });
    }
    const amount = parseInt(value, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_value" });
    }

    const stmt = db.prepare(`
      INSERT INTO promos (code, value, active, max_redemptions, per_user_limit, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      normalized,
      amount,
      active ? 1 : 0,
      max_redemptions !== null ? parseInt(max_redemptions, 10) : null,
      per_user_limit !== null ? parseInt(per_user_limit, 10) : null,
      expires_at || null
    );
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    console.error("POST /api/admin/promos:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.patch("/promos/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare("SELECT * FROM promos WHERE id=?").get(id);
    if (!row) return res.status(404).json({ ok: false, error: "not_found" });

    const up = {
      code: req.body.code !== undefined ? String(req.body.code).trim().toUpperCase() : row.code,
      value: req.body.value !== undefined ? parseInt(req.body.value, 10) : row.value,
      active: req.body.active !== undefined ? (req.body.active ? 1 : 0) : row.active,
      max_redemptions:
        req.body.max_redemptions !== undefined && req.body.max_redemptions !== null
          ? parseInt(req.body.max_redemptions, 10)
          : row.max_redemptions,
      per_user_limit:
        req.body.per_user_limit !== undefined && req.body.per_user_limit !== null
          ? parseInt(req.body.per_user_limit, 10)
          : row.per_user_limit,
      expires_at: req.body.expires_at !== undefined ? req.body.expires_at || null : row.expires_at,
      id,
    };

    if (!/^[-A-Z0-9_]{3,32}$/.test(up.code)) {
      return res.status(400).json({ ok: false, error: "invalid_code" });
    }
    if (!Number.isInteger(up.value) || up.value <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_value" });
    }

    db.prepare(
      `UPDATE promos SET code=@code, value=@value, active=@active, max_redemptions=@max_redemptions, per_user_limit=@per_user_limit, expires_at=@expires_at WHERE id=@id`
    ).run(up);

    res.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/promos/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.delete("/promos/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare("DELETE FROM promos WHERE id=?").run(id);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/promos/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
