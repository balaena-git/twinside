import express from "express";
import path from "path";
import db from "../../db.js";
import { UPLOADS_ROOT } from "../../config.js";

export default function createUsersRouter({ avatarUpload }) {
  const router = express.Router();

  router.get("/users", (req, res) => {
    try {
      const cols = db
        .prepare(`PRAGMA table_info(users)`)
        .all()
        .map((c) => c.name);
      if (!cols.includes("is_fake"))
        db.exec(`ALTER TABLE users ADD COLUMN is_fake INTEGER DEFAULT 0;`);
      if (!cols.includes("premium"))
        db.exec(`ALTER TABLE users ADD COLUMN premium INTEGER DEFAULT 0;`);
      if (!cols.includes("banned"))
        db.exec(`ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0;`);

      const search = (req.query.search || "").trim().toLowerCase();
      const type = (req.query.type || "all").toLowerCase();
      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const limit = 20;
      const offset = (page - 1) * limit;

      const where = [];
      const params = [];
      if (search) {
        where.push("(LOWER(nick) LIKE ? OR LOWER(email) LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }
      if (type === "fake") where.push("is_fake=1");
      if (type === "real") where.push("is_fake=0");

      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const total = db
        .prepare(`SELECT COUNT(*) as c FROM users ${whereSQL}`)
        .get(...params).c;
      const rows = db
        .prepare(
          `
          SELECT id, nick, email, city, gender, status, balance, premium, is_fake, banned, created_at
          FROM users ${whereSQL} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}
        `
        )
        .all(...params);

      res.json({
        ok: true,
        users: rows,
        pagination: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
          limit,
        },
      });
    } catch (e) {
      console.error("Ошибка /api/admin/users:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.post("/fake", (req, res) => {
    try {
      const {
        nick,
        gender = "woman",
        city = "Киев",
        about = "Фейковый профиль для тестов",
        avatar_path = null,
      } = req.body;

      if (!nick) {
        return res.status(400).json({ ok: false, error: "missing_nick" });
      }

      const createdAt = new Date().toISOString();
      const user = {
        email: `${nick.toLowerCase()}@fake.twinside.local`,
        password_hash: "FAKE_USER",
        nick,
        gender,
        city,
        about,
        avatar_path,
        verify_path: null,
        status: "approved",
        reject_reason: null,
        balance: 0,
        premium: 0,
        is_fake: 1,
        created_at: createdAt,
        updated_at: createdAt,
      };

      db.prepare(
        `
        INSERT INTO users (
          email, password_hash, nick, gender, city, about, avatar_path, verify_path,
          status, reject_reason, balance, premium, is_fake, created_at, updated_at
        )
        VALUES (
          @email, @password_hash, @nick, @gender, @city, @about, @avatar_path, @verify_path,
          @status, @reject_reason, @balance, @premium, @is_fake, @created_at, @updated_at
        )
      `
      ).run(user);

      res.json({ ok: true });
    } catch (e) {
      console.error("Ошибка /api/admin/fake:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.patch("/user/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { banned, premium, balance } = req.body;

      if (banned !== undefined) {
        db.prepare("UPDATE users SET banned=? WHERE id=?").run(banned ? 1 : 0, id);
      }

      if (premium !== undefined) {
        db.prepare("UPDATE users SET premium=? WHERE id=?").run(premium ? 1 : 0, id);
      }

      if (balance !== undefined) {
        db.prepare("UPDATE users SET balance=? WHERE id=?").run(balance, id);
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("Ошибка /api/admin/user/:id PATCH:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.delete("/user/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      db.prepare("DELETE FROM users WHERE id=? AND is_fake=1").run(id);
      res.json({ ok: true });
    } catch (e) {
      console.error("Ошибка /api/admin/user/:id DELETE:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // Serve verify photo securely for admins only
  router.get("/user/:id/verify", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const row = db
        .prepare("SELECT verify_path FROM users WHERE id=?")
        .get(id);
      if (!row || !row.verify_path) return res.status(404).send("not_found");

      // Normalize to a file inside uploads/verify
      const fileName = path.basename(row.verify_path);
      const absPath = path.join(UPLOADS_ROOT, "verify", fileName);
      return res.sendFile(absPath);
    } catch (e) {
      console.error("Ошибка выдачи verify фото:", e);
      return res.status(500).send("server_error");
    }
  });

  router.post("/users/fake", avatarUpload.single("avatar"), (req, res) => {
    try {
      const { nick, email, gender = "woman", city = "", about = "" } = req.body;
      if (!nick) return res.status(400).json({ ok: false, error: "nick_required" });

      const now = new Date().toISOString();
      const fakeEmail = email || `${nick.toLowerCase()}@fake.local`;
      const fakeHash =
        "$2b$10$H3q9W8aY7Jk4sYVfR2qU1u4eZ3rX2m8kqJr7Bv8sYtQxZ0pCStx1G";

      const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : null;

      const info = db
        .prepare(
          `
          INSERT INTO users (
            email, password_hash, nick, gender, city, about, avatar_path, status, is_fake, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, ?)
        `
        )
        .run(
          fakeEmail,
          fakeHash,
          nick,
          gender,
          city,
          about.slice(0, 300),
          avatarPath,
          now,
          now
        );

      res.json({ ok: true, id: info.lastInsertRowid, avatar: avatarPath });
    } catch (e) {
      console.error("Ошибка /api/admin/users/fake:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  return router;
}
