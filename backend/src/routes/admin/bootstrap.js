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

// Ensure admin-related tables (logs etc.) exist.
export function ensureAdminTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_email TEXT,
      user_id INTEGER,
      action TEXT,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Ensure promos tables
export function ensurePromoTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      value INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      max_redemptions INTEGER,
      per_user_limit INTEGER,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(promo_id) REFERENCES promos(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo ON promo_redemptions(promo_id);
    CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id);
  `);
}

// Ensure ads tables
export function ensureAdsTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_path TEXT NOT NULL,
      href TEXT,
      position TEXT DEFAULT 'global',
      active INTEGER DEFAULT 1,
      views INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );
  `);
}

// Ensure complaints table columns for admin handling
export function ensureComplaintsTables() {
  try {
    const cols = db.prepare(`PRAGMA table_info(complaints)`).all().map(c => c.name);
    if (cols.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS complaints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          target_id INTEGER NOT NULL,
          reason TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
    }
    if (!cols.includes('status')) db.exec(`ALTER TABLE complaints ADD COLUMN status TEXT DEFAULT 'new';`);
    if (!cols.includes('admin_note')) db.exec(`ALTER TABLE complaints ADD COLUMN admin_note TEXT;`);
    if (!cols.includes('handled_at')) db.exec(`ALTER TABLE complaints ADD COLUMN handled_at TEXT;`);
  } catch (e) {
    console.warn('ensureComplaintsTables error:', e);
  }
}

// Ensure social tables (friends)
export function ensureSocialTables() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        friend_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        UNIQUE(user_id, friend_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
      CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
    `);
  } catch (e) {
    console.warn('ensureSocialTables error:', e);
  }
}

export function ensurePhotoTables() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        album TEXT,
        is_private INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id);
    `);
  } catch (e) {
    console.warn('ensurePhotoTables error:', e);
  }
}
