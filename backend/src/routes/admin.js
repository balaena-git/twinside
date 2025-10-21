import express from "express";
import db from "../db.js";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Авто-создание таблиц для финансов ===
db.exec(`
  CREATE TABLE IF NOT EXISTS withdraws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount INTEGER,
    status TEXT DEFAULT 'pending',
    tx_hash TEXT,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    amount INTEGER,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);


// === Хранилище для фейковых аватаров ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "..", "uploads", "avatars");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + ext);
  }
});
const upload = multer({ storage });

// === Middleware логов ===
router.use((req, res, next) => {
  console.log("📡 Admin API hit:", req.method, req.url);
  next();
});

// === Список заявок на вывод ===
router.get("/withdraws", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT w.*, u.email, u.nick
      FROM withdraws w
      LEFT JOIN users u ON u.id = w.user_id
      ORDER BY w.id DESC
    `).all();
    res.json({ ok: true, withdraws: rows });
  } catch (e) {
    console.error("Ошибка /api/admin/withdraws:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === Подтверждение / отклонение вывода ===
router.patch("/withdraw/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { tx_hash, reject, reason } = req.body;

    const w = db.prepare("SELECT * FROM withdraws WHERE id = ?").get(id);
    if (!w) return res.status(404).json({ ok: false, error: "not_found" });

    const newStatus = reject ? "rejected" : "done";

    db.prepare(`
      UPDATE withdraws SET
        status = ?,
        tx_hash = ?,
        reason = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, tx_hash || null, reason || null, id);

    if (!reject) {
      // списываем баланс пользователя
      db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?")
        .run(w.amount, w.user_id);

      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, description)
        VALUES (?, 'withdraw', ?, 'Вывод подтверждён')
      `).run(w.user_id, -w.amount);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/withdraw/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === Ручное начисление ===
router.post("/manual-credit", (req, res) => {
  try {
    const { email, amount, description } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

    db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
      .run(amount, user.id);

    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES (?, 'manual', ?, ?)
    `).run(user.id, amount, description || "Ручное начисление");

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/manual-credit:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === Выдать премиум ===
router.post("/premium", (req, res) => {
  try {
    const { user_id, days = 30 } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id);
    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

    const now = new Date();
    const base = user.premium_until ? new Date(user.premium_until) : now;
    const newDate = new Date(base.getTime() + days * 86400000);

    db.prepare("UPDATE users SET premium = 1, premium_until = ? WHERE id = ?")
      .run(newDate.toISOString(), user_id);

    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES (?, 'premium', 0, 'Продлён премиум на ${days} дней')
    `).run(user_id);

    res.json({ ok: true, until: newDate.toISOString() });
  } catch (e) {
    console.error("Ошибка /api/admin/premium:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
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

// === Проверка авторизации админа ===
router.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/check-session') return next();
  if (!req.session?.admin) return res.status(401).json({ ok: false, error: 'admin_unauthorized' });
  next();
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

// === Анкеты на модерации с пагинацией и нормализованными путями фото ===
router.get("/pending", (req, res) => {
  try {
    // безопасность: только для активной сессии админа
    if (!req.session?.admin) return res.status(401).json({ ok: false, error: "unauthorized" });

    // параметры пагинации
    const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 100);
    const offset = (page - 1) * limit;

    // убедимся, что нужные колонки есть
    const cols = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);
    const need = ['about','avatar_path','verify_path'];
    const missing = need.filter(n => !cols.includes(n));
    if (missing.length) {
      // если вдруг миграции не сработали в index.js — дублируем здесь
      if (!cols.includes('about'))       db.exec(`ALTER TABLE users ADD COLUMN about TEXT;`);
      if (!cols.includes('avatar_path')) db.exec(`ALTER TABLE users ADD COLUMN avatar_path TEXT;`);
      if (!cols.includes('verify_path')) db.exec(`ALTER TABLE users ADD COLUMN verify_path TEXT;`);
    }

    const total = db.prepare(`
      SELECT COUNT(*) AS c
      FROM users
      WHERE status = 'profile_pending'
    `).get().c;

    const rows = db.prepare(`
      SELECT
        id, nick, email, gender, city, about,
        avatar_path, verify_path, status, created_at
      FROM users
      WHERE status = 'profile_pending'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    // нормализуем URL'ы (всегда начинаются с /uploads/...)
    const toUrl = (p, folder) => {
      if (!p) return null;
      if (p.startsWith('/uploads/')) return p;
      const name = p.split('/').pop();
      return `/uploads/${folder}/${name}`;
    };

    const users = rows.map(u => ({
      ...u,
      avatar_url: toUrl(u.avatar_path, 'avatars'),
      verify_url: toUrl(u.verify_path, 'verify'),
    }));

    res.json({
      ok: true,
      users,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      total
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

// === Создание фейкового пользователя ===
// === Создание фейкового пользователя с аватаром ===
router.post("/users/fake", upload.single("avatar"), (req, res) => {
  try {
    const { nick, email, gender = "woman", city = "", about = "" } = req.body;
    if (!nick) return res.status(400).json({ ok: false, error: "nick_required" });

    const now = new Date().toISOString();
    const fakeEmail = email || `${nick.toLowerCase()}@fake.local`;

    // хэш пароля "FakePass123" (для всех фейков одинаковый)
    const fakeHash = "$2b$10$H3q9W8aY7Jk4sYVfR2qU1u4eZ3rX2m8kqJr7Bv8sYtQxZ0pCStx1G";

    // путь к аватару, если был загружен
    let avatarPath = null;
    if (req.file) {
      avatarPath = `/uploads/avatars/${req.file.filename}`;
    }

    const info = db.prepare(`
      INSERT INTO users (email, password_hash, nick, gender, city, about, avatar_path, status, is_fake, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, ?)
    `).run(fakeEmail, fakeHash, nick, gender, city, about.slice(0, 300), avatarPath, now, now);

    res.json({ ok: true, id: info.lastInsertRowid, avatar: avatarPath });
  } catch (e) {
    console.error("Ошибка /api/admin/users/fake:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});


// === Имперсонация (войти как пользователь) ===
router.post("/impersonate/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = db.prepare("SELECT id, email FROM users WHERE id=?").get(id);
    if (!user) return res.status(404).json({ ok: false, error: "not_found" });

    const token = jwt.sign({ uid: user.id, email: user.email, imp: true }, JWT_SECRET, { expiresIn: "5m" });
    res.json({ ok: true, token });
  } catch (e) {
    console.error("Ошибка impersonate:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === История транзакций ===
router.get("/transactions", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        t.id,
        t.user_id,
        u.email,
        t.type,
        t.amount,
        t.description,
        t.created_at
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      ORDER BY t.id DESC
      LIMIT 200
    `).all();

    res.json({ ok: true, list: rows });
  } catch (e) {
    console.error("Ошибка /api/admin/transactions:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === Финансовая сводка ===
router.get("/stats/finance", (req, res) => {
  try {
    // Проверяем наличие таблиц
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(t => t.name);
    const exists = (name) => tables.includes(name);

    const totalUsers = exists("users") 
      ? db.prepare("SELECT COUNT(*) as c FROM users").get().c : 0;

    const totalBalance = exists("users") 
      ? db.prepare("SELECT IFNULL(SUM(balance),0) as sum FROM users").get().sum : 0;

    const totalWithdrawn = exists("withdraws") 
      ? db.prepare("SELECT IFNULL(SUM(amount),0) as sum FROM withdraws WHERE status='done'").get().sum : 0;

    const pendingWithdraws = exists("withdraws") 
      ? db.prepare("SELECT COUNT(*) as c FROM withdraws WHERE status='pending'").get().c : 0;

    const totalTransactions = exists("transactions") 
      ? db.prepare("SELECT COUNT(*) as c FROM transactions").get().c : 0;

    const totalPremiums = exists("users") 
      ? db.prepare("SELECT COUNT(*) as c FROM users WHERE premium=1").get().c : 0;

    const income24h = exists("transactions")
      ? db.prepare("SELECT IFNULL(SUM(amount),0) as sum FROM transactions WHERE created_at >= datetime('now','-1 day')").get().sum
      : 0;

    res.json({
      ok: true,
      stats: {
        users: totalUsers,
        balance: totalBalance,
        withdrawn: totalWithdrawn,
        pending_withdraws: pendingWithdraws,
        tx_count: totalTransactions,
        premium_users: totalPremiums,
        income_24h: income24h
      }
    });
  } catch (e) {
    console.error("Ошибка /api/admin/stats/finance:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === 💬 SUPPORT SYSTEM ===

// Создаём таблицы при первом запуске
db.exec(`
CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sender TEXT NOT NULL CHECK(sender IN ('user','admin')),
  message TEXT,
  file_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_read INTEGER DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_threads (
  user_id INTEGER PRIMARY KEY,
  pinned INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- active | resolved
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// === 1️⃣ Список чатов ===
router.get("/support", (req, res) => {
  try {
    const threads = db.prepare(`
      SELECT 
        u.id AS user_id,
        u.nick,
        u.email,
        u.city,
        u.gender,
        u.status AS user_status,
        u.balance,
        u.premium,
        u.avatar_path,
        IFNULL(MAX(m.created_at), u.created_at) AS last_time,
        IFNULL(SUBSTR(MAX(m.message), 1, 60), '—') AS last_message,
        COUNT(CASE WHEN m.is_read = 0 AND m.sender='user' THEN 1 END) AS unread_count,
        IFNULL(t.pinned, 0) AS pinned,
        IFNULL(t.status, 'active') AS status
      FROM users u
      LEFT JOIN support_messages m ON u.id = m.user_id
      LEFT JOIN support_threads t ON u.id = t.user_id
      WHERE EXISTS (SELECT 1 FROM support_messages sm WHERE sm.user_id = u.id)
      GROUP BY u.id
      ORDER BY t.pinned DESC, last_time DESC
    `).all();

    res.json({ ok: true, threads });
  } catch (e) {
    console.error("Ошибка /api/admin/support:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === 2️⃣ Сообщения конкретного пользователя ===
router.get("/support/thread/:id/messages", (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const msgs = db.prepare(`
      SELECT sender, message AS text, file_path AS image_url, created_at
      FROM support_messages
      WHERE user_id = ?
      ORDER BY created_at ASC
    `).all(userId);

    db.prepare("UPDATE support_messages SET is_read=1 WHERE user_id=? AND sender='user'").run(userId);

    res.json({ ok: true, messages: msgs });
  } catch (e) {
    console.error("Ошибка /api/admin/support/thread/:id/messages:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === 3️⃣ Отправка текстового сообщения ===
router.post("/support/thread/:id/message", (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const text = (req.body.text || "").trim();
    if (!text) return res.json({ ok: false, error: "empty_message" });

    db.prepare(`
      INSERT INTO support_messages (user_id, sender, message, created_at)
      VALUES (?, 'admin', ?, datetime('now'))
    `).run(userId, text);

    // Обновляем/создаём запись в support_threads
    db.prepare(`
      INSERT INTO support_threads (user_id, status)
      VALUES (?, 'active')
      ON CONFLICT(user_id) DO UPDATE SET status='active'
    `).run(userId);

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /support/thread/:id/message:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === 4️⃣ Загрузка файла ===
router.post("/support/thread/:id/upload", upload.single("file"), (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const text = req.body.text || "";
    const filePath = req.file ? `/uploads/support/${req.file.filename}` : null;

    db.prepare(`
      INSERT INTO support_messages (user_id, sender, message, file_path, created_at)
      VALUES (?, 'admin', ?, ?, datetime('now'))
    `).run(userId, text, filePath);

    db.prepare(`
      INSERT INTO support_threads (user_id, status)
      VALUES (?, 'active')
      ON CONFLICT(user_id) DO UPDATE SET status='active'
    `).run(userId);

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /support/thread/:id/upload:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === 5️⃣ Изменить статус или PIN ===
router.patch("/support/thread/:id", (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { pinned, status } = req.body;

    if (pinned !== undefined) {
      db.prepare(`
        INSERT INTO support_threads (user_id, pinned)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET pinned=excluded.pinned
      `).run(userId, pinned ? 1 : 0);
    }

    if (status) {
      db.prepare(`
        INSERT INTO support_threads (user_id, status)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET status=excluded.status
      `).run(userId, status);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /support/thread/:id [PATCH]:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === 6️⃣ Удалить чат ===
router.delete("/support/:id", (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    db.prepare("DELETE FROM support_messages WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM support_threads WHERE user_id = ?").run(userId);
    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/support/:id [DELETE]:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === Алиас для совместимости с фронтендом ===
router.get("/support/threads", (req, res) => {
  try {
    const threads = db.prepare(`
      SELECT   
        u.id AS user_id,  
        u.nick,  
        u.email,  
        u.city,  
        u.gender,  
        u.status AS user_status,  
        u.balance,  
        u.premium,  
        u.avatar_path,  
        IFNULL(MAX(m.created_at), u.created_at) AS last_time,  
        IFNULL(SUBSTR(MAX(m.message), 1, 60), '—') AS last_message,  
        COUNT(CASE WHEN m.is_read = 0 AND m.sender='user' THEN 1 END) AS unread_count,  
        IFNULL(t.pinned, 0) AS pinned,  
        IFNULL(t.status, 'active') AS status  
      FROM users u  
      LEFT JOIN support_messages m ON u.id = m.user_id  
      LEFT JOIN support_threads t ON u.id = t.user_id  
      WHERE EXISTS (SELECT 1 FROM support_messages sm WHERE sm.user_id = u.id)  
      GROUP BY u.id  
      ORDER BY t.pinned DESC, last_time DESC  
    `).all();

    res.json({ ok: true, threads });
  } catch (e) {
    console.error("Ошибка /api/admin/support/threads:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});


// === Имперсонация (вход под пользователем) ===
router.post("/impersonate/:id", (req, res) => {
  if (!req.session?.admin)
    return res.status(403).json({ ok: false, error: "forbidden" });

  const userId = parseInt(req.params.id);
  const token = jwt.sign(
    { uid: userId, mode: "impersonate" },
    process.env.JWT_SECRET,
    { expiresIn: "5m" }
  );

  res.json({ ok: true, token });
});


export default router;
