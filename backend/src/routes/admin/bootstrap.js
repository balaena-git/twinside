import db from "../../db.js";

// Ensure accounting tables exist before first use.
export function ensureFinanceTables() {
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
}

// Ensure support tables exist to keep chat API consistent.
export function ensureSupportTables() {
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
      status TEXT DEFAULT 'active',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}
