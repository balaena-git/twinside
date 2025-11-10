PRAGMA foreign_keys = ON;

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nick          TEXT UNIQUE NOT NULL,
  gender        TEXT NOT NULL,           -- man | woman | pair | trans
  dob           TEXT,                    -- ISO date; для одиночных
  male_dob      TEXT,                    -- для пары
  female_dob    TEXT,                    -- для пары
  city          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft', -- draft | email_confirmed | profile_pending | approved | rejected
  balance       INTEGER NOT NULL DEFAULT 0,    -- 💰 баланс (секскоины)
  premium_until TEXT,                          -- дата истечения премиума
  reject_reason TEXT,                          -- причина отклонения анкеты
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Токены email (подтверждение, сброс пароля)
CREATE TABLE IF NOT EXISTS email_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  purpose     TEXT NOT NULL,           -- confirm_email | reset_password
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Жалобы (на пользователей)
CREATE TABLE IF NOT EXISTS complaints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  target_id   INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Промокоды
CREATE TABLE IF NOT EXISTS promos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT UNIQUE NOT NULL,
  value       INTEGER NOT NULL,           -- сколько секскоинов даёт
  active      INTEGER NOT NULL DEFAULT 1, -- 1 — активен
  created_at  TEXT NOT NULL
);

-- Транзакции (пополнения / вывод)
CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  amount      INTEGER NOT NULL,
  type        TEXT NOT NULL,              -- deposit / withdraw
  created_at  TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
