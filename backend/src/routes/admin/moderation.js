import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/pending", (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "12", 10), 1),
      100
    );
    const offset = (page - 1) * limit;

    const cols = db
      .prepare(`PRAGMA table_info(users)`)
      .all()
      .map((c) => c.name);
    if (!cols.includes("about")) db.exec(`ALTER TABLE users ADD COLUMN about TEXT;`);
    if (!cols.includes("avatar_path"))
      db.exec(`ALTER TABLE users ADD COLUMN avatar_path TEXT;`);
    if (!cols.includes("verify_path"))
      db.exec(`ALTER TABLE users ADD COLUMN verify_path TEXT;`);

    const total = db
      .prepare(
        `
        SELECT COUNT(*) AS c
        FROM users
        WHERE status = 'profile_pending'
      `
      )
      .get().c;

    const rows = db
      .prepare(
        `
        SELECT
          id, nick, email, gender, city, about,
          avatar_path, verify_path, status, created_at
        FROM users
        WHERE status = 'profile_pending'
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `
      )
      .all(limit, offset);

    const toUrl = (p, folder) => {
      if (!p) return null;
      if (p.startsWith("/uploads/")) return p;
      const name = p.split("/").pop();
      return `/uploads/${folder}/${name}`;
    };

    const users = rows.map((user) => ({
      ...user,
      avatar_url: toUrl(user.avatar_path, "avatars"),
      verify_url: toUrl(user.verify_path, "verify"),
    }));

    res.json({
      ok: true,
      users,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
    });
  } catch (e) {
    console.error("Ошибка /api/admin/pending:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/approve/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const stmt = db.prepare(
      `
      UPDATE users
      SET status='approved', reject_reason=NULL, updated_at=datetime('now')
      WHERE id=?
    `
    );
    stmt.run(id);
    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/approve/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/reject/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const stmt = db.prepare(
      `
      UPDATE users
      SET status='rejected',
          reject_reason=?,
          updated_at=datetime('now')
      WHERE id=?
    `
    );
    stmt.run(reason || "Без указания причины", id);
    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/reject/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
