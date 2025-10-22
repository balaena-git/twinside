import express from "express";
import db from "../../db.js";
import { authMiddleware } from "../../middlewares/auth.js";

const router = express.Router();

// List accepted friends for me
router.get("/friends", authMiddleware, (req, res) => {
  try {
    const uid = req.user.uid;
    const rows = db.prepare(`
      SELECT u.id, u.nick, u.city, u.gender, u.avatar_path, u.premium
      FROM users u
      WHERE u.id IN (
        SELECT CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END AS fid
        FROM friends f
        WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status='accepted'
      )
    `).all(uid, uid, uid);
    res.json({ ok: true, friends: rows.map(r => ({ id:r.id, nick:r.nick, city:r.city, gender:r.gender, avatar:r.avatar_path, premium:!!r.premium })) });
  } catch (e) {
    console.error("GET /friends:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Incoming requests to me
router.get("/friends/requests", authMiddleware, (req, res) => {
  try {
    const uid = req.user.uid;
    const rows = db.prepare(`
      SELECT f.id as request_id, u.id, u.nick, u.city, u.gender, u.avatar_path
      FROM friends f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.status='pending'
      ORDER BY f.created_at DESC
    `).all(uid);
    res.json({ ok: true, incoming: rows });
  } catch (e) {
    console.error("GET /friends/requests:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Send request or accept reciprocal
router.post("/friends/:id", authMiddleware, (req, res) => {
  try {
    const me = req.user.uid;
    const other = parseInt(req.params.id, 10);
    if (!Number.isInteger(other) || other === me) return res.status(400).json({ ok:false, error:"invalid_id"});

    const reciprocal = db.prepare(`SELECT id FROM friends WHERE user_id=? AND friend_id=? AND status='pending'`).get(other, me);
    if (reciprocal) {
      db.prepare(`UPDATE friends SET status='accepted', updated_at=datetime('now') WHERE id=?`).run(reciprocal.id);
      return res.json({ ok: true, accepted: true });
    }

    // ensure not exists
    const exists = db.prepare(`SELECT id FROM friends WHERE user_id=? AND friend_id=?`).get(me, other);
    if (!exists) {
      db.prepare(`INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')`).run(me, other);
    }
    res.json({ ok: true, requested: true });
  } catch (e) {
    console.error("POST /friends/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Remove friendship or cancel request
router.delete("/friends/:id", authMiddleware, (req, res) => {
  try {
    const me = req.user.uid;
    const other = parseInt(req.params.id, 10);
    if (!Number.isInteger(other) || other === me) return res.status(400).json({ ok:false, error:"invalid_id"});
    db.prepare(`DELETE FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)`).run(me, other, other, me);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /friends/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

