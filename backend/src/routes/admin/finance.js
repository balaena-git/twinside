import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/withdraws", (req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT w.*, u.email, u.nick
        FROM withdraws w
        LEFT JOIN users u ON u.id = w.user_id
        ORDER BY w.id DESC
      `
      )
      .all();
    res.json({ ok: true, withdraws: rows });
  } catch (e) {
    console.error("Ошибка /api/admin/withdraws:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.patch("/withdraw/:id", (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }

    const { tx_hash, reject, reason } = req.body;
    const withdraw = db.prepare("SELECT * FROM withdraws WHERE id = ?").get(id);
    if (!withdraw) return res.status(404).json({ ok: false, error: "not_found" });

    const newStatus = reject ? "rejected" : "done";
    const normalizedHash = typeof tx_hash === "string" ? tx_hash.trim() : null;
    const normalizedReason = typeof reason === "string" ? reason.trim() : null;

    db.prepare(
      `
      UPDATE withdraws SET
        status = ?,
        tx_hash = ?,
        reason = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `
    ).run(newStatus, normalizedHash || null, normalizedReason || null, id);

    if (!reject) {
      const amount = Number(withdraw.amount) || 0;
      db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(
        amount,
        withdraw.user_id
      );

      db.prepare(
        `
        INSERT INTO transactions (user_id, type, amount, description)
        VALUES (?, 'withdraw', ?, 'Вывод подтверждён')
      `
      ).run(withdraw.user_id, -amount);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/withdraw/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/manual-credit", (req, res) => {
  try {
    const { email, amount, description } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

    const value = Number(amount);
    if (!Number.isFinite(value)) {
      return res.status(400).json({ ok: false, error: "invalid_amount" });
    }

    const rounded = Math.trunc(value);
    db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(
      rounded,
      user.id
    );

    db.prepare(
      `
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES (?, 'manual', ?, ?)
    `
    ).run(user.id, rounded, (description || "Ручное начисление").slice(0, 200));

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка /api/admin/manual-credit:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/premium", (req, res) => {
  try {
    const userId = Number.parseInt(req.body.user_id, 10);
    const days = Number.parseInt(req.body.days ?? 30, 10);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ ok: false, error: "invalid_user_id" });
    }
    if (!Number.isInteger(days) || days <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_days" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

    const now = new Date();
    const base = user.premium_until ? new Date(user.premium_until) : now;
    const newDate = new Date(base.getTime() + days * 86400000);

    db.prepare("UPDATE users SET premium = 1, premium_until = ? WHERE id = ?").run(
      newDate.toISOString(),
      userId
    );

    db.prepare(
      `
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES (?, 'premium', 0, 'Продлён премиум на ${days} дней')
    `
    ).run(userId);

    res.json({ ok: true, until: newDate.toISOString() });
  } catch (e) {
    console.error("Ошибка /api/admin/premium:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/transactions", (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "200", 10), 1), 500);
    const offset = (page - 1) * limit;
    const type = (req.query.type || '').trim();
    const email = (req.query.email || '').trim();

    const where = [];
    const params = [];
    if (type) { where.push("t.type = ?"); params.push(type); }
    if (email) { where.push("u.email = ?"); params.push(email); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as c FROM transactions t LEFT JOIN users u ON u.id=t.user_id ${whereSQL}`).get(...params).c;
    const rows = db
      .prepare(
        `
        SELECT t.id, t.user_id, u.email, t.type, t.amount, t.description, t.created_at
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        ${whereSQL}
        ORDER BY t.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      )
      .all(...params);

    res.json({ ok: true, list: rows, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } });
  } catch (e) {
    console.error("Ошибка /api/admin/transactions:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/transactions.csv", (req, res) => {
  try {
    const type = (req.query.type || '').trim();
    const email = (req.query.email || '').trim();
    const where = [];
    const params = [];
    if (type) { where.push("t.type = ?"); params.push(type); }
    if (email) { where.push("u.email = ?"); params.push(email); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT t.id, u.email, t.type, t.amount, t.description, t.created_at
      FROM transactions t LEFT JOIN users u ON u.id=t.user_id
      ${whereSQL}
      ORDER BY t.id DESC
    `).all(...params);
    const header = 'id,email,type,amount,description,created_at\n';
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replaceAll('"', '""');
      return `"${s}"`;
    };
    const csv = header + rows.map(r => [r.id, r.email||'', r.type||'', r.amount||0, r.description||'', r.created_at||''].map(esc).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(csv);
  } catch (e) {
    console.error("/api/admin/transactions.csv:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/stats/finance", (req, res) => {
  try {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all()
      .map((t) => t.name);
    const exists = (name) => tables.includes(name);

    const totalUsers = exists("users")
      ? db.prepare("SELECT COUNT(*) as c FROM users").get().c
      : 0;
    const totalBalance = exists("users")
      ? db.prepare("SELECT IFNULL(SUM(balance),0) as sum FROM users").get().sum
      : 0;
    const totalWithdrawn = exists("withdraws")
      ? db
          .prepare(
            "SELECT IFNULL(SUM(amount),0) as sum FROM withdraws WHERE status='done'"
          )
          .get().sum
      : 0;
    const pendingWithdraws = exists("withdraws")
      ? db
          .prepare(
            "SELECT COUNT(*) as c FROM withdraws WHERE status='pending'"
          )
          .get().c
      : 0;
    const totalTransactions = exists("transactions")
      ? db.prepare("SELECT COUNT(*) as c FROM transactions").get().c
      : 0;
    const totalPremiums = exists("users")
      ? db.prepare("SELECT COUNT(*) as c FROM users WHERE premium=1").get().c
      : 0;
    const income24h = exists("transactions")
      ? db
          .prepare(
            "SELECT IFNULL(SUM(amount),0) as sum FROM transactions WHERE created_at >= datetime('now','-1 day')"
          )
          .get().sum
      : 0;

    res.json({
      ok: true,
      stats: {
        users: totalUsers,
        balance: totalBalance,
        withdrawn: totalWithdrawn,
        pending_withdraws: pendingWithdraws,
        tx_count: totalTransactions,
        premium_users: totalPremiums,
        income_24h: income24h,
      },
    });
  } catch (e) {
    console.error("Ошибка /api/admin/stats/finance:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
