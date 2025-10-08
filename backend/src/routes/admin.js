import express from "express";
import db from "../db.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// === Middleware логов ===
router.use((req, res, next) => {
  console.log("📡 Admin API hit:", req.method, req.url);
  next();
});

// === Авторизация ===
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASS) {
    req.session.admin = { email };
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: "Неверный логин или пароль" });
});

router.get("/check-session", (req, res) => {
  if (req.session?.admin) return res.json({ ok: true });
  res.json({ ok: false });
});


// === DASHBOARD ===
router.get("/dashboard", (req, res) => {
  try {
    const exists = (name) =>
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

    const totalUsers = exists("users")
      ? db.prepare(`SELECT COUNT(*) as c FROM users`).get().c
      : 0;
    const active = db.prepare(`SELECT COUNT(*) as c FROM users WHERE status='approved'`).get()
      .c;
    const pending = db.prepare(
      `SELECT COUNT(*) as c FROM users WHERE status='profile_pending'`
    ).get().c;
    const rejected = db.prepare(
      `SELECT COUNT(*) as c FROM users WHERE status='rejected'`
    ).get().c;
    const totalBalance = db
      .prepare(`SELECT IFNULL(SUM(balance),0) as total FROM users`)
      .get().total;
    const promos = exists("promos")
      ? db.prepare(`SELECT COUNT(*) as c FROM promos WHERE active=1`).get().c
      : 0;
    const complaints = exists("complaints")
      ? db.prepare(`SELECT COUNT(*) as c FROM complaints`).get().c
      : 0;

    res.json({
      ok: true,
      users: { total: totalUsers, active, pending, rejected },
      economy: { totalBalance },
      promos,
      complaints,
    });
  } catch (e) {
    console.error("Ошибка дашборда:", e);
    res.status(500).json({ ok: false, error: "Ошибка загрузки дашборда" });
  }
});


// === АНКЕТЫ НА МОДЕРАЦИИ ===
router.get("/pending", (req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT id, nick, email, gender, city, created_at, about, avatar_path, verify_path
         FROM users WHERE status='profile_pending' ORDER BY created_at DESC`
      )
      .all();
    res.json({ ok: true, users: rows });
  } catch (e) {
    console.error("Ошибка /api/admin/pending:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});


// === ПОЛЬЗОВАТЕЛИ ===

// Список пользователей
router.get("/users", (req, res) => {
  try {
    const cols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
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
        `SELECT id, nick, email, city, gender, status, balance, premium, is_fake, banned, created_at
         FROM users ${whereSQL} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
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


// === Создание фейк-пользователя ===
// === СОЗДАНИЕ ФЕЙКОВ ===
router.post("/fake", (req, res) => {
  try {
    const {
      nick,
      gender = "woman",
      city = "Киев",
      about = "Фейковый профиль для тестов",
      avatar_path = null
    } = req.body;

    if (!nick) {
      return res.status(400).json({ ok: false, error: "missing_nick" });
    }

    const created_at = new Date().toISOString();
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
      created_at,
      updated_at: created_at
    };

    const stmt = db.prepare(`
      INSERT INTO users (
        email, password_hash, nick, gender, city, about, avatar_path, verify_path,
        status, reject_reason, balance, premium, is_fake, created_at, updated_at
      )
      VALUES (@email, @password_hash, @nick, @gender, @city, @about, @avatar_path, @verify_path,
              @status, @reject_reason, @balance, @premium, @is_fake, @created_at, @updated_at)
    `);

    stmt.run(user);

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/fake:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});


// === Обновление данных пользователя (бан, баланс, премиум и т.п.) ===
router.patch("/user/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { banned, premium, balance } = req.body;

    if (banned !== undefined)
      db.prepare("UPDATE users SET banned=? WHERE id=?").run(banned ? 1 : 0, id);

    if (premium !== undefined)
      db.prepare("UPDATE users SET premium=? WHERE id=?").run(premium ? 1 : 0, id);

    if (balance !== undefined)
      db.prepare("UPDATE users SET balance=? WHERE id=?").run(balance, id);

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/user/:id PATCH:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});


// === Удаление фейка ===
router.delete("/user/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare("DELETE FROM users WHERE id=? AND is_fake=1").run(id);
    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/user/:id DELETE:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === МОДЕРАЦИЯ АНКЕТ ===

// 📋 Получить список анкет со статусом "profile_pending"
router.get("/pending", (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1"), 1);
    const limit = Math.min(parseInt(req.query.limit || "6"), 50);
    const offset = (page - 1) * limit;

    const total = db
      .prepare(`SELECT COUNT(*) as c FROM users WHERE status='profile_pending'`)
      .get().c;

    const users = db
      .prepare(`
        SELECT 
          id, nick, email, gender, city, about, avatar_path, verify_path,
          status, created_at
        FROM users
        WHERE status='profile_pending'
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `)
      .all();

    res.json({
      ok: true,
      users,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (e) {
    console.error("Ошибка /api/admin/pending:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});


// ✅ Одобрить анкету (перевод в статус approved)
router.post("/approve/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const stmt = db.prepare(`
      UPDATE users
      SET status='approved', reject_reason=NULL, updated_at=datetime('now')
      WHERE id=?
    `);
    stmt.run(id);
    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/approve/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});


// ❌ Отклонить анкету (указать причину)
router.post("/reject/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const stmt = db.prepare(`
      UPDATE users
      SET status='rejected',
          reject_reason=?,
          updated_at=datetime('now')
      WHERE id=?
    `);
    stmt.run(reason || "Без указания причины", id);
    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/reject/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});


// === LOGOUT ===
router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Ошибка logout:", err);
        return res.status(500).json({ ok: false, error: "logout_failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  } else res.json({ ok: true });
});


export default router;
