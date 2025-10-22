import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/feed", (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 50);
    const offset = (page - 1) * limit;
    const city = (req.query.city || "").trim();
    const gender = (req.query.gender || "").trim();

    const where = ["status='approved'", "IFNULL(banned,0)=0"]; 
    const params = [];
    if (city) { where.push("city = ?"); params.push(city); }
    if (gender) { where.push("gender = ?"); params.push(gender); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as c FROM users ${whereSQL}`).get(...params).c;
    const rows = db.prepare(`
      SELECT id, nick, email, city, gender, premium, avatar_path, last_active, created_at
      FROM users
      ${whereSQL}
      ORDER BY premium DESC, last_active DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `).all(...params);

    const users = rows.map(u => ({
      id: u.id,
      nick: u.nick,
      city: u.city,
      gender: u.gender,
      premium: !!u.premium,
      avatar: u.avatar_path || null,
    }));

    res.json({ ok: true, users, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } });
  } catch (e) {
    console.error("/feed:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

