import express from "express";
import { authMiddleware } from "../../middlewares/auth.js";
import { getUserById } from "../../repositories/usersRepository.js";

const router = express.Router();

router.get("/status", authMiddleware, (req, res) => {
  try {
    const user = getUserById(req.user.uid);
    if (!user) return res.json({ ok: false, error: "not_found" });

    res.json({
      ok: true,
      id: user.id,
      nick: user.nick,
      email: user.email,
      status: user.status,
      avatar_path: user.avatar_path,
    });
  } catch (error) {
    console.error("/me/status:", error);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
