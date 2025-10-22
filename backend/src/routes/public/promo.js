import express from "express";
import db from "../../db.js";
import { authMiddleware } from "../../middlewares/auth.js";

const router = express.Router();

router.post("/promo/apply", authMiddleware, (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ ok: false, error: "invalid_code" });

    const promo = db.prepare("SELECT * FROM promos WHERE code=?").get(code);
    if (!promo) return res.status(404).json({ ok: false, error: "not_found" });
    if (!promo.active) return res.status(400).json({ ok: false, error: "inactive" });
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.status(400).json({ ok: false, error: "expired" });
    }

    const redeemedCount = db
      .prepare("SELECT COUNT(*) as c FROM promo_redemptions WHERE promo_id=?")
      .get(promo.id).c;
    if (promo.max_redemptions && redeemedCount >= promo.max_redemptions) {
      return res.status(400).json({ ok: false, error: "limit_reached" });
    }

    const userCount = db
      .prepare("SELECT COUNT(*) as c FROM promo_redemptions WHERE promo_id=? AND user_id=?")
      .get(promo.id, req.user.uid).c;
    if (promo.per_user_limit && userCount >= promo.per_user_limit) {
      return res.status(400).json({ ok: false, error: "user_limit_reached" });
    }

    const value = parseInt(promo.value, 10) || 0;
    if (value <= 0) return res.status(400).json({ ok: false, error: "invalid_value" });

    db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(value, req.user.uid);
    db.prepare(
      `INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'promo', ?, 'Промокод ${code}')`
    ).run(req.user.uid, value);
    db.prepare("INSERT INTO promo_redemptions (promo_id, user_id) VALUES (?, ?)").run(promo.id, req.user.uid);

    res.json({ ok: true, credited: value });
  } catch (e) {
    console.error("/promo/apply:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

