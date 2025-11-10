import express from "express";
import jwt from "jsonwebtoken";
import db from "../../db.js";

export function registerPublicAuthRoutes(router, { adminEmail, adminPass }) {
  router.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (
      adminEmail &&
      adminPass &&
      email === adminEmail &&
      password === adminPass
    ) {
      req.session.admin = { email };
      return res.json({ ok: true });
    }

    res.status(401).json({ ok: false, error: "Неверный логин или пароль" });
  });

  router.get("/check-session", (req, res) => {
    if (req.session?.admin) return res.json({ ok: true });
    res.json({ ok: false });
  });
}

export function createProtectedAuthRouter({ jwtSecret }) {
  const router = express.Router();

  router.post("/logout", (req, res) => {
    if (!req.session) return res.json({ ok: true });

    req.session.destroy((err) => {
      if (err) {
        console.error("Ошибка logout:", err);
        return res.status(500).json({ ok: false, error: "logout_failed" });
      }

      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  router.post("/impersonate/:id", (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ ok: false, error: "invalid_user_id" });
      }

      if (!jwtSecret) {
        console.error("Impersonation error: JWT secret is not configured.");
        return res
          .status(500)
          .json({ ok: false, error: "impersonation_disabled" });
      }

      const user = db.prepare("SELECT id, email FROM users WHERE id=?").get(id);
      if (!user) return res.status(404).json({ ok: false, error: "not_found" });

      const token = jwt.sign(
        { uid: user.id, email: user.email, mode: "impersonate" },
        jwtSecret,
        { expiresIn: "5m" }
      );

      res.json({ ok: true, token });
    } catch (e) {
      console.error("Ошибка impersonate:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  return router;
}
