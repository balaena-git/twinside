import jwt from "jsonwebtoken";
import { JWT_SECRET, SAME_SITE, COOKIE_SECURE } from "../config.js";

export function authMiddleware(req, res, next) {
  const token = req.cookies?.auth;
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie("auth", {
      httpOnly: true,
      sameSite: SAME_SITE,
      secure: COOKIE_SECURE,
    });
    res.status(401).json({ error: "invalid_token" });
  }
}
