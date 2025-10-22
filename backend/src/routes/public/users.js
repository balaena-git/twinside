import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/users/:id/profile", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "invalid_id" });
    const u = db.prepare(`
      SELECT id, nick, city, gender, about, interests, looking_for, last_active, avatar_path, premium
      FROM users WHERE id=? AND IFNULL(banned,0)=0
    `).get(id);
    if (!u) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, profile: {
      id: u.id,
      nick: u.nick,
      city: u.city,
      gender: u.gender,
      looking_for: u.looking_for || '',
      last_active: u.last_active || null,
      about: u.about || '',
      interests: u.interests || '',
      avatar: u.avatar_path || null,
      premium: !!u.premium,
    }});
  } catch (e) {
    console.error("/users/:id/profile:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

// Friends preview for profile
router.get("/users/:id/friends-preview", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rows = db.prepare(`
      SELECT u.id, u.nick, u.city, u.avatar_path, u.premium
      FROM users u
      WHERE u.id IN (
        SELECT CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END AS fid
        FROM friends f WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status='accepted'
      )
      ORDER BY u.id DESC
      LIMIT 8
    `).all(id, id, id);
    res.json({ ok: true, friends: rows.map(r=>({ id:r.id, nick:r.nick, city:r.city, avatar:r.avatar_path, premium:!!r.premium })) });
  } catch (e) {
    console.error("/users/:id/friends-preview:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});
