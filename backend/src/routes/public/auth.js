import express from "express";
import db from "../../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import {
  APP_URL,
  JWT_SECRET,
  SAME_SITE,
  COOKIE_SECURE,
} from "../../config.js";
import { sendMail } from "../../services/mailService.js";
import { nowISO, addHours } from "../../utils/datetime.js";
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByNick,
  setUserPassword,
  setUserStatus,
} from "../../repositories/usersRepository.js";
import {
  createToken,
  getToken,
  markTokenUsed,
} from "../../repositories/tokensRepository.js";

const router = express.Router();

// Simple in-memory throttle for resend-confirmation
const resendBuckets = new Map(); // key: email, value: { lastAt: number, day: string, count: number }
const RESEND_MIN_INTERVAL_MS = 60 * 1000; // 60s
const RESEND_DAILY_LIMIT = 5;

// Simple in-memory throttle for register/login
const rl = {
  register: new Map(),
  login: new Map(),
};
const RL_WINDOW_MS = 60 * 1000; // 1 minute
const RL_MAX = 20; // max attempts per minute per IP/email
function allow(map, key) {
  const now = Date.now();
  const b = map.get(key) || { start: now, count: 0 };
  if (now - b.start > RL_WINDOW_MS) {
    b.start = now;
    b.count = 0;
  }
  b.count += 1;
  map.set(key, b);
  return b.count <= RL_MAX;
}

router.post("/register", async (req, res) => {
  try {
    if (!allow(rl.register, req.ip)) return res.status(429).json({ error: "rate_limited" });
    const { email, password, nick, gender, dob, male_dob, female_dob, city, age, male_age, female_age } =
      req.body;

    if (!email || !password || !nick || !gender || !city) {
      return res.status(400).json({ error: "missing_fields" });
    }

    if (getUserByEmail(email)) {
      return res.status(400).json({ error: "email_exists" });
    }

    if (getUserByNick(nick)) {
      return res.status(400).json({ error: "nick_exists" });
    }

    // Age validation (allow age fields as fallback if DOB is not provided)
    const isPair = gender === "pair";
    const toInt = (v) => (v === undefined || v === null ? NaN : parseInt(v, 10));
    if (!isPair) {
      if (dob) {
        const years = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
        if (isNaN(years) || years < 18) return res.status(400).json({ error: "age_restriction" });
      } else if (!isNaN(toInt(age))) {
        if (toInt(age) < 18) return res.status(400).json({ error: "age_restriction" });
      }
    } else {
      if (male_dob && female_dob) {
        const ym = Math.floor((Date.now() - new Date(male_dob).getTime()) / 31557600000);
        const yf = Math.floor((Date.now() - new Date(female_dob).getTime()) / 31557600000);
        if (isNaN(ym) || ym < 18 || isNaN(yf) || yf < 18)
          return res.status(400).json({ error: "age_restriction" });
      } else if (!isNaN(toInt(male_age)) && !isNaN(toInt(female_age))) {
        if (toInt(male_age) < 18 || toInt(female_age) < 18)
          return res.status(400).json({ error: "age_restriction" });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = {
      email,
      password_hash,
      nick,
      gender,
      dob: isPair ? null : dob || null,
      male_dob: isPair ? male_dob || null : null,
      female_dob: isPair ? female_dob || null : null,
      city,
      status: "draft",
      created_at: nowISO(),
      updated_at: nowISO(),
    };

    const info = createUser(user);
    const userId = info.lastInsertRowid;

    const token = uuidv4();
    createToken({
      user_id: userId,
      token,
      purpose: "confirm_email",
      expires_at: addHours(24),
      created_at: nowISO(),
    });

    const confirmLink = `${APP_URL}/auth/confirm?token=${token}`;
    await sendMail({
      to: email,
      subject: "Подтвердите email для TwinSide",
      html: `
        <h2>Подтвердите почту</h2>
        <p>Нажмите, чтобы подтвердить: <a href="${confirmLink}">${confirmLink}</a></p>
        <p>Ссылка активна 24 часа.</p>
      `,
    });

    res.json({ ok: true, next: "/auth/check-email" });
  } catch (error) {
    console.error("register:", error);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/resend-confirmation", async (req, res) => {
  const { email } = req.body;
  const user = getUserByEmail(email);
  if (!user || user.status !== "draft") {
    return res.json({ ok: true });
  }

  // throttle by email
  try {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const bucket = resendBuckets.get(email) || { lastAt: 0, day: today, count: 0 };
    if (bucket.day !== today) {
      bucket.day = today;
      bucket.count = 0;
    }
    if (now - bucket.lastAt < RESEND_MIN_INTERVAL_MS || bucket.count >= RESEND_DAILY_LIMIT) {
      return res.json({ ok: true, limited: true });
    }
    bucket.lastAt = now;
    bucket.count += 1;
    resendBuckets.set(email, bucket);
  } catch {}

  const token = uuidv4();
  createToken({
    user_id: user.id,
    token,
    purpose: "confirm_email",
    expires_at: addHours(24),
    created_at: nowISO(),
  });

  const link = `${APP_URL}/auth/confirm?token=${token}`;
  try {
    await sendMail({
      to: email,
      subject: "Подтвердите email для TwinSide (повторно)",
      html: `<p>Подтвердите почту: <a href="${link}">${link}</a></p>`,
    });
  } catch (error) {
    console.error("resend-confirmation:", error);
  }

  res.json({ ok: true });
});

router.get("/confirm", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("missing token");

  const row = getToken(token, "confirm_email");
  if (!row) return res.status(400).send("invalid token");
  if (row.used_at) return res.status(400).send("token used");
  if (new Date(row.expires_at) < new Date())
    return res.status(400).send("token expired");

  const user = getUserById(row.user_id);
  if (!user) return res.status(400).send("user not found");

  setUserStatus({ id: user.id, status: "email_confirmed", updated_at: nowISO() });
  markTokenUsed({ id: row.id, used_at: nowISO() });

  res.send(
    "Email подтверждён. Теперь заполните анкету. Можно закрыть это окно и войти в приложение."
  );
});

router.post("/login", async (req, res) => {
  if (!allow(rl.login, req.ip)) return res.status(429).json({ error: "rate_limited" });
  const { email, password } = req.body;
  const user = getUserByEmail(email);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  if (user.status === "draft") {
    return res.status(403).json({ error: "email_not_confirmed" });
  }

  const token = jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res
    .cookie("auth", token, {
      httpOnly: true,
      sameSite: SAME_SITE,
      secure: COOKIE_SECURE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({ ok: true, status: user.status });

  try {
    db.prepare("UPDATE users SET last_active=datetime('now'), updated_at=datetime('now') WHERE id=?").run(
      user.id
    );
  } catch {}
});

router.post("/forgot", async (req, res) => {
  const { email } = req.body;
  const user = getUserByEmail(email);
  if (!user) return res.json({ ok: true });

  const token = uuidv4();
  createToken({
    user_id: user.id,
    token,
    purpose: "reset_password",
    expires_at: addHours(0.5),
    created_at: nowISO(),
  });

  const link = `${APP_URL}/auth/reset?token=${token}`;
  try {
    await sendMail({
      to: email,
      subject: "Сброс пароля — TwinSide",
      html: `<p>Сбросить пароль: <a href="${link}">${link}</a> (действует 30 минут)</p>`,
    });
  } catch (error) {
    console.error("forgot:", error);
  }

  res.json({ ok: true });
});

router.post("/reset", async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const row = getToken(token, "reset_password");
  if (!row) return res.status(400).json({ error: "invalid_token" });
  if (row.used_at) return res.status(400).json({ error: "token_used" });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: "token_expired" });
  }

  const user = getUserById(row.user_id);
  if (!user) return res.status(400).json({ error: "user_not_found" });

  const password_hash = await bcrypt.hash(new_password, 10);
  setUserPassword({ id: user.id, password_hash, updated_at: nowISO() });
  markTokenUsed({ id: row.id, used_at: nowISO() });

  res.json({ ok: true });
});

router.get("/impersonate", (req, res) => {
  const { token, next } = req.query;
  try {
    const data = jwt.verify(token, JWT_SECRET);
    const authToken = jwt.sign({ uid: data.uid }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("auth", authToken, {
      httpOnly: true,
      sameSite: SAME_SITE,
      secure: COOKIE_SECURE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect(next || "/");
  } catch (error) {
    console.error("Имперсонация:", error);
    res.status(400).send("Invalid impersonation token");
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("auth", {
    httpOnly: true,
    sameSite: SAME_SITE,
    secure: COOKIE_SECURE,
  });
  res.json({ ok: true });
});

export default router;
