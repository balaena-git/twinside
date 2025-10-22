import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/dashboard", (req, res) => {
  try {
    const exists = (name) =>
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(name);

    const totalUsers = exists("users")
      ? db.prepare("SELECT COUNT(*) as c FROM users").get().c
      : 0;
    const active = db
      .prepare("SELECT COUNT(*) as c FROM users WHERE status='approved'")
      .get().c;
    const pending = db
      .prepare(
        "SELECT COUNT(*) as c FROM users WHERE status='profile_pending'"
      )
      .get().c;
    const rejected = db
      .prepare("SELECT COUNT(*) as c FROM users WHERE status='rejected'")
      .get().c;
    const totalBalance = db
      .prepare("SELECT IFNULL(SUM(balance),0) as total FROM users")
      .get().total;
    const promos = exists("promos")
      ? db.prepare("SELECT COUNT(*) as c FROM promos WHERE active=1").get().c
      : 0;
    const complaints = exists("complaints")
      ? db.prepare("SELECT COUNT(*) as c FROM complaints").get().c
      : 0;

    res.json({
      ok: true,
      users: { total: totalUsers, active, pending, rejected },
      economy: { totalBalance },
      promos,
      complaints,
    });
  } catch (e) {
    console.error("Ошибка дашборда:", e);
    res.status(500).json({ ok: false, error: "Ошибка загрузки дашборда" });
  }
});

export default router;
