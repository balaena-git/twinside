// === imports ===
import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import cors from 'cors';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import adminRoutes from './routes/admin.js';
import db from './db.js';

// ленивые миграции недостающих колонок
try {
  const cols = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);
  const add = (sql) => db.exec(sql);

  if (!cols.includes('about'))        add(`ALTER TABLE users ADD COLUMN about TEXT;`);
  if (!cols.includes('looking_for'))  add(`ALTER TABLE users ADD COLUMN looking_for TEXT;`);
  if (!cols.includes('interests'))    add(`ALTER TABLE users ADD COLUMN interests TEXT;`);
  if (!cols.includes('avatar_path'))  add(`ALTER TABLE users ADD COLUMN avatar_path TEXT;`);
  if (!cols.includes('verify_path'))  add(`ALTER TABLE users ADD COLUMN verify_path TEXT;`);
  if (!cols.includes('premium'))      add(`ALTER TABLE users ADD COLUMN premium INTEGER DEFAULT 0;`);
  if (!cols.includes('balance'))      add(`ALTER TABLE users ADD COLUMN balance INTEGER DEFAULT 0;`);
  if (!cols.includes('last_active'))  add(`ALTER TABLE users ADD COLUMN last_active TEXT;`);
} catch(e) {
  console.error('DB migration error:', e);
}


dotenv.config();

// === app setup ===
const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// создаём папки под загрузки, если их нет
fs.mkdirSync(path.join(__dirname, '..', 'uploads', 'avatars'), { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'uploads', 'verify'), { recursive: true });

// === Гарантируем, что нужные папки для загрузок существуют ===
const UPLOADS = path.join(__dirname, '..', 'uploads');
const AVATARS = path.join(UPLOADS, 'avatars');
const VERIFY  = path.join(UPLOADS, 'verify');
[UPLOADS, AVATARS, VERIFY].forEach(p => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});


app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
import session from "express-session";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "twinside_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // если HTTPS — поставим true
      maxAge: 24 * 60 * 60 * 1000 // сутки
    }
  })
);

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use("/api/admin", adminRoutes);

// === Multer (загрузка файлов) ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVerify = file.fieldname === 'verify_photo';
    const dir = path.join(__dirname, '..', 'uploads', isVerify ? 'verify' : 'avatars');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = Date.now() + '-' + Math.random().toString(36).slice(2) + ext;
    cb(null, safe);
  }
});
const fileFilter = (req, file, cb) => {
  const ok = /image\/(jpeg|png|webp|gif)/.test(file.mimetype);
  cb(ok ? null : new Error('invalid_file_type'), ok);
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});


// === Email (Nodemailer Ethereal — для локала) ===
let cachedTransporter = null;
async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  cachedTransporter = transporter;
  console.log('Ethereal email:', testAccount.user);
  console.log('Ethereal pass :', testAccount.pass);
  return transporter;
}
async function sendMail({ to, subject, html }) {
  const t = await getTransporter();
  const info = await t.sendMail({ from: 'TwinSide <no-reply@twinside.local>', to, subject, html });
  console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
}

// === Helpers ===
const nowISO = () => new Date().toISOString();
const addHours = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();

function authMiddleware(req, res, next) {
  const token = req.cookies?.auth;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

// === SQL statements ===
const insertUser = db.prepare(`
  INSERT INTO users (email, password_hash, nick, gender, dob, male_dob, female_dob, city, status, created_at, updated_at)
  VALUES (@email, @password_hash, @nick, @gender, @dob, @male_dob, @female_dob, @city, @status, @created_at, @updated_at)
`);
const updateProfileData = db.prepare(`
  UPDATE users
  SET about = @about,
      looking_for = @looking_for,
      interests = @interests,
      avatar_path = @avatar_path,
      verify_path = @verify_path,
      status = @status,
      updated_at = @updated_at
  WHERE id = @id
`);
const findUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);
const findUserById = db.prepare(`SELECT * FROM users WHERE id = ?`);
const findUserByNick = db.prepare(`SELECT * FROM users WHERE nick = ?`);
const updateUserStatus = db.prepare(`UPDATE users SET status = @status, updated_at = @updated_at WHERE id = @id`);
const updateUserPassword = db.prepare(`UPDATE users SET password_hash = @password_hash, updated_at = @updated_at WHERE id = @id`);

const insertToken = db.prepare(`
  INSERT INTO email_tokens (user_id, token, purpose, expires_at, used_at, created_at)
  VALUES (@user_id, @token, @purpose, @expires_at, NULL, @created_at)
`);
const findToken = db.prepare(`SELECT * FROM email_tokens WHERE token = ? AND purpose = ?`);
const setTokenUsed = db.prepare(`UPDATE email_tokens SET used_at = @used_at WHERE id = @id`);

// === ROUTES ===

// health
app.get('/health', (_, res) => res.json({ ok: true }));

// 1) Регистрация
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, nick, gender, dob, male_dob, female_dob, city } = req.body;

    // базовые проверки
    if (!email || !password || !nick || !gender || !city) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    if (findUserByEmail.get(email)) return res.status(400).json({ error: 'email_exists' });
    if (findUserByNick.get(nick)) return res.status(400).json({ error: 'nick_exists' });

    // пароли
    const password_hash = await bcrypt.hash(password, 10);

    // одиночка → dob; пара → male_dob/female_dob
    const isPair = gender === 'pair';
    const user = {
      email,
      password_hash,
      nick,
      gender,
      dob: isPair ? null : (dob || null),
      male_dob: isPair ? (male_dob || null) : null,
      female_dob: isPair ? (female_dob || null) : null,
      city,
      status: 'draft',
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    const info = insertUser.run(user);
    const user_id = info.lastInsertRowid;

    // создаём токен подтверждения email
    const token = uuidv4();
    insertToken.run({
      user_id,
      token,
      purpose: 'confirm_email',
      expires_at: addHours(24),
      created_at: nowISO(),
    });

    // письмо
    const confirmLink = `${APP_URL}/auth/confirm?token=${token}`;
    await sendMail({
      to: email,
      subject: 'Подтвердите email для TwinSide',
      html: `
        <h2>Подтвердите почту</h2>
        <p>Нажмите, чтобы подтвердить: <a href="${confirmLink}">${confirmLink}</a></p>
        <p>Ссылка активна 24 часа.</p>
      `,
    });

    res.json({ ok: true, next: '/auth/check-email' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 2) Повторная отправка письма
app.post('/auth/resend-confirmation', (req, res) => {
  const { email } = req.body;
  const user = findUserByEmail.get(email);
  if (!user) return res.json({ ok: true }); // одинаковый ответ (не раскрываем наличие email)
  if (user.status !== 'draft') return res.json({ ok: true });

  const token = uuidv4();
  insertToken.run({
    user_id: user.id,
    token,
    purpose: 'confirm_email',
    expires_at: addHours(24),
    created_at: nowISO(),
  });

  const link = `${APP_URL}/auth/confirm?token=${token}`;
  sendMail({
    to: email,
    subject: 'Подтвердите email для TwinSide (повторно)',
    html: `<p>Подтвердите почту: <a href="${link}">${link}</a></p>`,
  }).catch(console.error);

  res.json({ ok: true });
});

// 3) Подтверждение email
app.get('/auth/confirm', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('missing token');

  const row = findToken.get(token, 'confirm_email');
  if (!row) return res.status(400).send('invalid token');

  if (row.used_at) return res.status(400).send('token used');
  if (new Date(row.expires_at) < new Date()) return res.status(400).send('token expired');

  const user = findUserById.get(row.user_id);
  if (!user) return res.status(400).send('user not found');

  // статусы: draft -> email_confirmed
  updateUserStatus.run({ id: user.id, status: 'email_confirmed', updated_at: nowISO() });
  setTokenUsed.run({ id: row.id, used_at: nowISO() });

  // редирект на страничку «почта подтверждена» (пока текстом)
  res.send('Email подтверждён. Теперь заполните анкету. Можно закрыть это окно и войти в приложение.');
});

// 4) Логин
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail.get(email);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  // если почта не подтверждена — гейт
  if (user.status === 'draft') {
    return res.status(403).json({ error: 'email_not_confirmed' });
  }

  const token = jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('auth', token, { httpOnly: true, sameSite: 'lax' }).json({ ok: true, status: user.status });
});

// 5) Забыли пароль
app.post('/auth/forgot', (req, res) => {
  const { email } = req.body;
  const user = findUserByEmail.get(email);
  // одинаковый ответ для существующего/несуществующего
  if (!user) return res.json({ ok: true });

  const token = uuidv4();
  insertToken.run({
    user_id: user.id,
    token,
    purpose: 'reset_password',
    expires_at: addHours(0.5), // 30 минут
    created_at: nowISO(),
  });

  const link = `${APP_URL}/auth/reset?token=${token}`;
  sendMail({
    to: email,
    subject: 'Сброс пароля — TwinSide',
    html: `<p>Сбросить пароль: <a href="${link}">${link}</a> (действует 30 минут)</p>`,
  }).catch(console.error);

  res.json({ ok: true });
});

// 6) Сброс пароля
app.post('/auth/reset', async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ error: 'missing_fields' });

  const row = findToken.get(token, 'reset_password');
  if (!row) return res.status(400).json({ error: 'invalid_token' });
  if (row.used_at) return res.status(400).json({ error: 'token_used' });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'token_expired' });

  const user = findUserById.get(row.user_id);
  if (!user) return res.status(400).json({ error: 'user_not_found' });

  const password_hash = await bcrypt.hash(new_password, 10);
  updateUserPassword.run({ id: user.id, password_hash, updated_at: nowISO() });
  setTokenUsed.run({ id: row.id, used_at: nowISO() });

  res.json({ ok: true });
});

// 7) Проверка статуса (для фронта)
app.get('/me/status', authMiddleware, (req, res) => {
  const user = findUserById.get(req.user.uid);
  if (!user) return res.json({
  ok: true,
  id: user.id,
  nick: user.nick,
  email: user.email,
  status: user.status,
  avatar_path: user.avatar_path,
  reject_reason: user.reject_reason || null
});

});

app.get("/auth/impersonate", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("missing token");
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.cookie("auth", token, { httpOnly: true, sameSite: "lax" });
    res.redirect("/"); // редирект в приложение
  } catch {
    res.status(400).send("expired or invalid token");
  }
});



// 8) Заполнение анкеты
app.post('/profile/setup',
  authMiddleware,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'verify_photo', maxCount: 1 }
  ]),
  (req, res) => {
    try {
      const user = findUserById.get(req.user.uid);
      if (!user) return res.status(404).json({ error: 'not_found' });

      // Только после подтверждения почты можно отправлять анкету
      if (user.status !== 'email_confirmed') {
        return res.status(403).json({ error: 'email_not_confirmed_or_already_sent' });
      }

      const avatarFile = req.files?.avatar?.[0];
      const verifyFile = req.files?.verify_photo?.[0];
      if (!avatarFile || !verifyFile) {
        return res.status(400).json({ error: 'files_required' });
      }

      const about = (req.body.about || '').toString().slice(0, 300);
      const looking_for = (req.body.looking_for || '').toString(); // CSV: woman,man,...
      const interests = (req.body.interests || '').toString();     // CSV: Музыка,Кино,...

      // Сохраняем относительные пути (для фронта /uploads/...)
      const avatar_path = `/uploads/avatars/${path.basename(avatarFile.path)}`;
      const verify_path = `/uploads/verify/${path.basename(verifyFile.path)}`;

      updateProfileData.run({
        id: user.id,
        about,
        looking_for,
        interests,
        avatar_path,
        verify_path,
        status: 'profile_pending',
        updated_at: new Date().toISOString()
      });

      return res.json({ ok: true, status: 'profile_pending' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'server_error' });
    }
  }
);

// === ADMIN ===
app.get('/admin/pending', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;

    // считаем общее количество
    const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE status = 'profile_pending'`).get().c;
    const pages = Math.max(1, Math.ceil(total / limit));

    const rows = db.prepare(`
      SELECT id, nick, email, city, about, avatar_path, verify_path, created_at
      FROM users
      WHERE status = 'profile_pending'
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({ ok: true, page, pages, total, users: rows });
  } catch (e) {
    console.error('Ошибка /admin/pending:', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// === ADMIN USERS ===

// список пользователей с поиском
app.get('/admin/users', (req, res) => {
  const search = (req.query.search || '').trim().toLowerCase();
  const rows = search
    ? db.prepare(`
        SELECT id, nick, email, city, status, balance,
               COALESCE(banned, 0) as banned,
               COALESCE(premium, 0) as premium
        FROM users
        WHERE LOWER(email) LIKE ? OR LOWER(nick) LIKE ?
        ORDER BY id DESC
      `).all(`%${search}%`, `%${search}%`)
    : db.prepare(`
        SELECT id, nick, email, city, status, balance,
               COALESCE(banned, 0) as banned,
               COALESCE(premium, 0) as premium
        FROM users ORDER BY id DESC LIMIT 100
      `).all();
  res.json({ ok: true, users: rows });
});
// === ADMIN USERS ===



// обновление данных пользователя (бан, премиум, баланс)
app.patch('/admin/user/:id', express.json(), (req, res) => {
  const id = parseInt(req.params.id);
  const { banned, premium, balance } = req.body;
  const user = db.prepare(`SELECT * FROM users WHERE id=?`).get(id);
  if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

  if (banned !== undefined)
    db.prepare(`UPDATE users SET banned=? WHERE id=?`).run(banned, id);
  if (premium !== undefined)
    db.prepare(`UPDATE users SET premium=? WHERE id=?`).run(premium, id);
  if (balance !== undefined && !isNaN(balance))
    db.prepare(`UPDATE users SET balance=? WHERE id=?`).run(balance, id);

  res.json({ ok: true });
});



// одобрить анкету
app.post('/admin/approve/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare('UPDATE users SET status="approved", reject_reason=NULL WHERE id=?').run(id);
  return res.json({ ok: true });
});

// отклонить анкету
app.post('/admin/reject/:id', express.json(), (req, res) => {
  const id = parseInt(req.params.id);
  const reason = (req.body.reason || 'Без указания причины').slice(0, 300);
  db.prepare('UPDATE users SET status="rejected", reject_reason=? WHERE id=?').run(reason, id);
  return res.json({ ok: true });
});


// 9) Проверка статуса текущего пользователя
app.get('/me/status', authMiddleware, (req, res) => {
  try {
    const user = findUserById.get(req.user.uid);
    if (!user) return res.json({ ok: false, error: 'not_found' });
    return res.json({
      ok: true,
      id: user.id,
      nick: user.nick,
      email: user.email,
      status: user.status,
      avatar_path: user.avatar_path
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// === Имперсонация (автоматический вход под пользователем) ===
app.get("/auth/impersonate", (req, res) => {
  const { token } = req.query;
  try {
    const data = jwt.verify(token, JWT_SECRET);
    const authToken = jwt.sign({ uid: data.uid }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("auth", authToken, { httpOnly: true, sameSite: "lax" });
    res.redirect("/"); // после входа открывает сайт как пользователь
  } catch (e) {
    console.error("Имперсонация:", e);
    res.status(400).send("Invalid impersonation token");
  }
});


// 10) Logout (очистка cookie)
app.post('/auth/logout', (req, res) => {
  res.clearCookie('auth');
  return res.json({ ok: true });
});

app.listen(PORT, () => console.log(`TwinSide API running on ${APP_URL}`));