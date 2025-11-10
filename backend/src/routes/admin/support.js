import express from "express";
import db from "../../db.js";

export default function createSupportRouter({ supportUpload }) {
  const router = express.Router();

  router.get("/support", (req, res) => {
    try {
      const threads = db
        .prepare(
          `
          SELECT 
            u.id AS user_id,
            u.nick,
            u.email,
            u.city,
            u.gender,
            u.status AS user_status,
            u.balance,
            u.premium,
            u.avatar_path,
            IFNULL(MAX(m.created_at), u.created_at) AS last_time,
            IFNULL(SUBSTR(MAX(m.message), 1, 60), '—') AS last_message,
            COUNT(CASE WHEN m.is_read = 0 AND m.sender='user' THEN 1 END) AS unread_count,
            IFNULL(t.pinned, 0) AS pinned,
            IFNULL(t.status, 'active') AS status
          FROM users u
          LEFT JOIN support_messages m ON u.id = m.user_id
          LEFT JOIN support_threads t ON u.id = t.user_id
          WHERE EXISTS (SELECT 1 FROM support_messages sm WHERE sm.user_id = u.id)
          GROUP BY u.id
          ORDER BY t.pinned DESC, last_time DESC
        `
        )
        .all();

      res.json({ ok: true, threads });
    } catch (e) {
      console.error("Ошибка /api/admin/support:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.get("/support/thread/:id/messages", (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const messages = db
        .prepare(
          `
          SELECT sender, message AS text, file_path AS image_url, created_at
          FROM support_messages
          WHERE user_id = ?
          ORDER BY created_at ASC
        `
        )
        .all(userId);

      db.prepare(
        "UPDATE support_messages SET is_read=1 WHERE user_id=? AND sender='user'"
      ).run(userId);

      res.json({ ok: true, messages });
    } catch (e) {
      console.error("Ошибка /api/admin/support/thread/:id/messages:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.post("/support/thread/:id/message", (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const text = (req.body.text || "").trim();
      if (!text) return res.json({ ok: false, error: "empty_message" });

      db.prepare(
        `
        INSERT INTO support_messages (user_id, sender, message, created_at)
        VALUES (?, 'admin', ?, datetime('now'))
      `
      ).run(userId, text);

      db.prepare(
        `
        INSERT INTO support_threads (user_id, status)
        VALUES (?, 'active')
        ON CONFLICT(user_id) DO UPDATE SET status='active'
      `
      ).run(userId);

      res.json({ ok: true });
    } catch (e) {
      console.error("Ошибка /support/thread/:id/message:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.post(
    "/support/thread/:id/upload",
    supportUpload.single("file"),
    (req, res) => {
      try {
        const userId = parseInt(req.params.id, 10);
        const text = req.body.text || "";
        const filePath = req.file ? `/uploads/support/${req.file.filename}` : null;

        db.prepare(
          `
          INSERT INTO support_messages (user_id, sender, message, file_path, created_at)
          VALUES (?, 'admin', ?, ?, datetime('now'))
        `
        ).run(userId, text, filePath);

        db.prepare(
          `
          INSERT INTO support_threads (user_id, status)
          VALUES (?, 'active')
          ON CONFLICT(user_id) DO UPDATE SET status='active'
        `
        ).run(userId);

        res.json({ ok: true });
      } catch (e) {
        console.error("Ошибка /support/thread/:id/upload:", e);
        res.status(500).json({ ok: false, error: "server_error" });
      }
    }
  );

  router.patch("/support/thread/:id", (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { pinned, status } = req.body;

      if (pinned !== undefined) {
        db.prepare(
          `
          INSERT INTO support_threads (user_id, pinned)
          VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET pinned=excluded.pinned
        `
        ).run(userId, pinned ? 1 : 0);
      }

      if (status) {
        db.prepare(
          `
          INSERT INTO support_threads (user_id, status)
          VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET status=excluded.status
        `
        ).run(userId, status);
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("Ошибка /support/thread/:id [PATCH]:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.delete("/support/:id", (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      db.prepare("DELETE FROM support_messages WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM support_threads WHERE user_id = ?").run(userId);
      res.json({ ok: true });
    } catch (e) {
      console.error("Ошибка /api/admin/support/:id [DELETE]:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  router.get("/support/threads", (req, res) => {
    try {
      const threads = db
        .prepare(
          `
          SELECT   
            u.id AS user_id,  
            u.nick,  
            u.email,  
            u.city,  
            u.gender,  
            u.status AS user_status,  
            u.balance,  
            u.premium,  
            u.avatar_path,  
            IFNULL(MAX(m.created_at), u.created_at) AS last_time,  
            IFNULL(SUBSTR(MAX(m.message), 1, 60), '—') AS last_message,  
            COUNT(CASE WHEN m.is_read = 0 AND m.sender='user' THEN 1 END) AS unread_count,  
            IFNULL(t.pinned, 0) AS pinned,  
            IFNULL(t.status, 'active') AS status  
          FROM users u  
          LEFT JOIN support_messages m ON u.id = m.user_id  
          LEFT JOIN support_threads t ON u.id = t.user_id  
          WHERE EXISTS (SELECT 1 FROM support_messages sm WHERE sm.user_id = u.id)  
          GROUP BY u.id  
          ORDER BY t.pinned DESC, last_time DESC  
        `
        )
        .all();

      res.json({ ok: true, threads });
    } catch (e) {
      console.error("Ошибка /api/admin/support/threads:", e);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  return router;
}
