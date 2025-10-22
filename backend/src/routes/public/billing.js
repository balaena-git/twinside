import express from "express";
import db from "../../db.js";
import { authMiddleware } from "../../middlewares/auth.js";

const router = express.Router();

// User requests a withdraw. Commission 20% applied: net payout amount stored.
router.post("/billing/withdraw", authMiddleware, (req, res) => {
  try {
    const raw = parseInt(req.body.amount, 10);
    if (!Number.isInteger(raw) || raw <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_amount" });
    }
    const user = db.prepare("SELECT id, balance FROM users WHERE id=?").get(req.user.uid);
    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

    // Commission 20%
    const net = Math.floor(raw * 0.8);
    if (net <= 0) return res.status(400).json({ ok: false, error: "too_small" });
    if (user.balance < raw) return res.status(400).json({ ok: false, error: "insufficient_balance" });

    db.prepare(
      `INSERT INTO withdraws (user_id, amount, status) VALUES (?, ?, 'pending')`
    ).run(user.id, net);

    // Do not deduct now; balance is reduced when admin approves in /api/admin/withdraw/:id
    res.json({ ok: true, amount: net, commission: raw - net });
  } catch (e) {
    console.error("/billing/withdraw:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

