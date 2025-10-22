import express from "express";
import { authMiddleware } from "../../middlewares/auth.js";
import { getUserById } from "../../repositories/usersRepository.js";
import db from "../../db.js";

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
      premium: !!user.premium,
    });
  } catch (error) {
    console.error("/me/status:", error);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

// Overview with enriched info for "My Page"
router.get("/overview", authMiddleware, (req, res) => {
  try {
    const u = getUserById(req.user.uid);
    if (!u) return res.status(404).json({ ok: false, error: "not_found" });

    const friendsCount = db
      .prepare(
        `SELECT COUNT(*) as c FROM friends WHERE (user_id=? OR friend_id=?) AND status='accepted'`
      )
      .get(u.id, u.id).c;
    const photosCount = db
      .prepare(`SELECT COUNT(*) as c FROM photos WHERE user_id=?`)
      .get(u.id).c;

    const calcAge = (iso) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      const diff = Date.now() - d.getTime();
      return Math.floor(diff / 31557600000);
    };

    const age = calcAge(u.dob);
    const maleAge = calcAge(u.male_dob);
    const femaleAge = calcAge(u.female_dob);

    res.json({
      ok: true,
      profile: {
        id: u.id,
        email: u.email,
        nick: u.nick,
        city: u.city,
        gender: u.gender,
        looking_for: u.looking_for || '',
        age,
        pair_ages: u.gender === 'pair' ? { male: maleAge, female: femaleAge } : null,
        about: u.about || '',
        interests: u.interests || '',
        avatar: u.avatar_path || null,
        status: u.status,
        last_active: u.last_active || null,
        premium: !!u.premium,
        premium_until: u.premium_until || null,
        counters: {
          friends: friendsCount,
          posts: 0,
          photos: photosCount || 0,
        },
      },
    });
  } catch (error) {
    console.error("/me/overview:", error);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});
