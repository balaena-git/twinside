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
} catch (e) {
  console.error("DB migration error:", e);
}

const app = express();

app.use(cors({ origin: true, credentials: true }));
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

app.use("/uploads", express.static(UPLOADS_ROOT));

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

app.listen(PORT, () => console.log(`TwinSide API running on ${APP_URL}`));
