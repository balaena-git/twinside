import express from "express";
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

router.post("/register", async (req, res) => {
  try {
    const { email, password, nick, gender, dob, male_dob, female_dob, city } =
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

    const password_hash = await bcrypt.hash(password, 10);
    const isPair = gender === "pair";
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
  const { token } = req.query;
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
    res.redirect("/");
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
