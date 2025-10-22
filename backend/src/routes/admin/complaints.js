import express from "express";
import db from "../../db.js";

const router = express.Router();

const baseSelect = `
  SELECT c.id, c.user_id, c.target_id, c.reason, c.status, c.created_at,
         u.nick AS user_nick, u.email AS user_email,
         t.nick AS target_nick, t.email AS target_email
  FROM complaints c
  LEFT JOIN users u ON u.id = c.user_id
  LEFT JOIN users t ON t.id = c.target_id
`;

router.get("/complaints", (req, res) => {
  try {
    const status = String(req.query.status || "new");
    const where = [];
    const params = [];
    if (status && status !== "all") {
      where.push("c.status = ?");
      params.push(status);
    }
    const sql = `${baseSelect} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY c.id DESC LIMIT 200`;
    const rows = db.prepare(sql).all(...params);
    res.json({ ok: true, list: rows });
  } catch (e) {
    console.error("/api/admin/complaints:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

function logAdminAction({ admin, userId, action, reason = null }) {
  try {
    db.prepare(`INSERT INTO admin_logs (admin_email, user_id, action, reason) VALUES (?,?,?,?)`).run(admin || null, userId, action, reason);
  } catch {}
}

router.patch("/complaints/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const action = String(req.body.action || "");
    const note = req.body.note ? String(req.body.note).slice(0, 500) : null;
    const complaint = db.prepare("SELECT * FROM complaints WHERE id=?").get(id);
    if (!complaint) return res.status(404).json({ ok: false, error: "not_found" });

    let status = "ignored";
    if (action === "warn") status = "warned";
    if (action === "ban") status = "banned";

    db.prepare(
      `UPDATE complaints SET status=?, admin_note=?, handled_at=datetime('now') WHERE id=?`
    ).run(status, note, id);

    if (action === "ban") {
      db.prepare("UPDATE users SET banned=1 WHERE id=?").run(complaint.target_id);
      logAdminAction({ admin: req.session?.admin?.email, userId: complaint.target_id, action: "ban", reason: note || complaint.reason });
    }

    if (action === "warn") {
      logAdminAction({ admin: req.session?.admin?.email, userId: complaint.target_id, action: "warn", reason: note || complaint.reason });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/complaints/:id:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;

