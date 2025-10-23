import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import adminRoutes from "./routes/admin.js";
import publicRoutes from "./routes/public/index.js";
import db from "./db.js";
import {
  PORT,
  APP_URL,
  SESSION_SECRET,
  COOKIE_SECURE,
  SAME_SITE,
  BACKEND_ROOT,
  UPLOADS_ROOT,
  CORS_ORIGIN,
} from "./config.js";
import "./config/uploads.js";

try {
  const cols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
  const add = (sql) => db.exec(sql);

  if (!cols.includes("about")) add(`ALTER TABLE users ADD COLUMN about TEXT;`);
  if (!cols.includes("looking_for"))
    add(`ALTER TABLE users ADD COLUMN looking_for TEXT;`);
  if (!cols.includes("interests"))
    add(`ALTER TABLE users ADD COLUMN interests TEXT;`);
  if (!cols.includes("avatar_path"))
    add(`ALTER TABLE users ADD COLUMN avatar_path TEXT;`);
  if (!cols.includes("verify_path"))
    add(`ALTER TABLE users ADD COLUMN verify_path TEXT;`);
  if (!cols.includes("premium"))
    add(`ALTER TABLE users ADD COLUMN premium INTEGER DEFAULT 0;`);
  if (!cols.includes("balance"))
    add(`ALTER TABLE users ADD COLUMN balance INTEGER DEFAULT 0;`);
  if (!cols.includes("last_active"))
    add(`ALTER TABLE users ADD COLUMN last_active TEXT;`);
  if (!cols.includes("premium_until"))
    add(`ALTER TABLE users ADD COLUMN premium_until TEXT;`);
  if (!cols.includes("banned"))
    add(`ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0;`);
  if (!cols.includes("is_fake"))
    add(`ALTER TABLE users ADD COLUMN is_fake INTEGER DEFAULT 0;`);
} catch (e) {
  console.error("DB migration error:", e);
}

try {
  const hasPostsTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='posts'"
  ).get();
  if (!hasPostsTable) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL DEFAULT 'post',
        text TEXT,
        attachments TEXT,
        poll TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
    `);
  }
} catch (e) {
  console.error("Posts table migration error:", e);
}

try {
  const postCols = db.prepare("PRAGMA table_info(posts)").all().map((c) => c.name);
  if (!postCols.includes("parent_id")) {
    db.exec(
      "ALTER TABLE posts ADD COLUMN parent_id INTEGER REFERENCES posts(id) ON DELETE CASCADE"
    );
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id)");
} catch (e) {
  console.error("Posts parent column migration error:", e);
}

try {
  const hasPostLikes = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='post_likes'"
  ).get();
  if (!hasPostLikes) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS post_likes (
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(post_id, user_id),
        FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);
    `);
  }
} catch (e) {
  console.error("Post likes table migration error:", e);
}

try {
  const hasPostComments = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='post_comments'"
  ).get();
  if (!hasPostComments) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_comments_user ON post_comments(user_id);
    `);
  }
} catch (e) {
  console.error("Post comments table migration error:", e);
}

try {
  const commentCols = db
    .prepare("PRAGMA table_info(post_comments)")
    .all()
    .map((c) => c.name);
  if (!commentCols.includes("parent_id")) {
    db.exec(
      "ALTER TABLE post_comments ADD COLUMN parent_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE"
    );
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_post_comments_user ON post_comments(user_id)");
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_id)"
  );
} catch (e) {
  console.error("Post comments parent column migration error:", e);
}

const app = express();

const corsOrigins = CORS_ORIGIN ? CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean) : true;
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: SAME_SITE,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Serve only public-safe upload folders. Do not expose verify images.
app.use("/uploads/avatars", express.static(path.join(UPLOADS_ROOT, "avatars")));
app.use("/uploads/support", express.static(path.join(UPLOADS_ROOT, "support")));
app.use("/uploads/ads", express.static(path.join(UPLOADS_ROOT, "ads")));
app.use("/uploads/photos", express.static(path.join(UPLOADS_ROOT, "photos")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/admin", adminRoutes);
// Debug middleware to confirm hits on /api/admin
app.use('/api/admin', (req, _res, next) => {
  console.log('[api/admin] hit', req.method, req.url);
  next();
});
app.use(publicRoutes);

const FRONTEND_ROOT = path.join(BACKEND_ROOT, "..", "frontend");
const PUBLIC_ROOT = path.join(FRONTEND_ROOT, "public");

app.use("/assets", express.static(path.join(FRONTEND_ROOT, "assets")));
app.use("/components", express.static(path.join(FRONTEND_ROOT, "components")));
app.use("/js", express.static(path.join(FRONTEND_ROOT, "js")));
app.use("/admin", express.static(path.join(FRONTEND_ROOT, "admin")));
app.use(express.static(PUBLIC_ROOT));
app.use(express.static(FRONTEND_ROOT));

// Favicon at the root to avoid 404s
app.get('/favicon.ico', (_req, res) =>
  res.sendFile(path.join(FRONTEND_ROOT, 'assets', 'icons', 'favicon.ico'))
);

const servePublicHtml = (slug) => path.join(PUBLIC_ROOT, `${slug}.html`);

const publicSlugs = [
  "auth",
  "support",
  "privacy",
  "terms",
  "pending",
  "profile-setup",
  "check-email",
  "rejected",
  "reset-password",
  "activation",
  "feed",
  "app",
];

publicSlugs.forEach((slug) => {
  app.get(`/public/${slug}`, (_req, res) => res.sendFile(servePublicHtml(slug)));
  app.get(`/public/${slug}/`, (_req, res) => res.sendFile(servePublicHtml(slug)));
  app.get(`/${slug}`, (_req, res) => res.redirect(`/public/${slug}`));
});

const servePublicIndex = (_req, res) =>
  res.sendFile(path.join(PUBLIC_ROOT, "index.html"));

app.get("/public", servePublicIndex);
app.get("/public/", servePublicIndex);

app.get("/admin", (_req, res) =>
  res.sendFile(path.join(FRONTEND_ROOT, "admin", "admin.html"))
);

// Allow /admin/<page> to resolve to /frontend/admin/<page>.html
app.get("/admin/:page", (req, res) => {
  const page = (req.params.page || "").replace(/[^a-z0-9\-]/gi, "");
  if (!page) return res.status(404).send("Not found");
  res.sendFile(path.join(FRONTEND_ROOT, "admin", `${page}.html`));
});

// App shell pages (authenticated area like VK)
app.get("/app", (_req, res) =>
  res.redirect("/app/feed")
);
app.get("/app/:page", (req, res) => {
  const page = (req.params.page || "").replace(/[^a-z0-9\-]/gi, "");
  if (!page) return res.status(404).send("Not found");
  res.sendFile(path.join(FRONTEND_ROOT, "app", `${page}.html`));
});

app.listen(PORT, () => console.log(`TwinSide API running on ${APP_URL}`));
