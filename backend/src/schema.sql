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
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT UNIQUE NOT NULL,
  value            INTEGER NOT NULL,
  active           INTEGER NOT NULL DEFAULT 1,
  max_redemptions  INTEGER,
  per_user_limit   INTEGER,
  expires_at       TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  promo_id   INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL,
  FOREIGN KEY(promo_id) REFERENCES promos(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  amount      INTEGER NOT NULL,
  type        TEXT NOT NULL,              -- deposit / withdraw / promo / manual / premium
  description TEXT,
  created_at  TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Выводы
CREATE TABLE IF NOT EXISTS withdraws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  amount INTEGER,
  status TEXT DEFAULT 'pending',
  tx_hash TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Реклама
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_path TEXT NOT NULL,
  href TEXT,
  position TEXT,
  active INTEGER DEFAULT 1,
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Посты на стене
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'post',
  text TEXT,
  attachments TEXT,
  poll TEXT,
  parent_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id);

CREATE TABLE IF NOT EXISTS post_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  parent_id INTEGER,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_id) REFERENCES post_comments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_id);
