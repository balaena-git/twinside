import express from "express";
import db from "../../db.js";
import { authMiddleware } from "../../middlewares/auth.js";

const router = express.Router();

const mapPost = (row) => {
  if (!row) return null;
  let attachments = [];
  let poll = null;
  try {
    attachments = row.attachments ? JSON.parse(row.attachments) : [];
    if (!Array.isArray(attachments)) attachments = [];
  } catch {
    attachments = [];
  }
  try {
    poll = row.poll ? JSON.parse(row.poll) : null;
  } catch {
    poll = null;
  }
  return {
    id: row.id,
    user_id: row.user_id,
    kind: row.kind,
    text: row.text || "",
    attachments,
    poll,
    created_at: row.created_at,
    likes: row.likes || 0,
    liked: !!row.liked,
    comments: typeof row.comments === "number" ? row.comments : 0,
    parent_id: row.parent_id || null,
  };
};

const allowedKinds = new Set(["post", "photo", "poll"]);

router.get("/users/:id/posts", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }
    const user = db
      .prepare("SELECT id FROM users WHERE id=? AND IFNULL(banned,0)=0")
      .get(id);
    if (!user) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "50", 10), 1),
      100
    );
    const total = db
      .prepare(`SELECT COUNT(*) as c FROM posts WHERE user_id=? AND parent_id IS NULL`)
      .get(id).c;
    const rows = db
      .prepare(
        `SELECT p.id, p.user_id, p.kind, p.text, p.attachments, p.poll, p.created_at, p.parent_id,
                (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) as likes,
                0 as liked,
                (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id) as comments
         FROM posts p WHERE p.user_id=? AND p.parent_id IS NULL ORDER BY p.id DESC LIMIT ?`
      )
      .all(id, limit);
    res.json({ ok: true, posts: rows.map(mapPost).filter(Boolean), total });
  } catch (e) {
    console.error("GET /users/:id/posts:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/me/posts", authMiddleware, (req, res) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "50", 10), 1),
      100
    );
    const total = db
      .prepare(`SELECT COUNT(*) as c FROM posts WHERE user_id=? AND parent_id IS NULL`)
      .get(req.user.uid).c;
    const rows = db
      .prepare(
        `SELECT p.id, p.user_id, p.kind, p.text, p.attachments, p.poll, p.created_at, p.parent_id,
                (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) as likes,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id=p.id AND user_id=?) as liked,
                (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id) as comments
         FROM posts p WHERE p.user_id=? AND p.parent_id IS NULL ORDER BY p.id DESC LIMIT ?`
      )
      .all(req.user.uid, req.user.uid, limit);
    res.json({ ok: true, posts: rows.map(mapPost).filter(Boolean), total });
  } catch (e) {
    console.error("GET /me/posts:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/posts", authMiddleware, (req, res) => {
  try {
    const kind = (req.body?.kind || "post").toString().toLowerCase();
    if (!allowedKinds.has(kind)) {
      return res.status(400).json({ ok: false, error: "invalid_kind" });
    }

    let text = (req.body?.text ?? "").toString().trim();
    text = text.slice(0, 700);

    let attachments = [];
    if (kind === "photo") {
      if (!Array.isArray(req.body.attachments)) {
        return res.status(400).json({ ok: false, error: "attachments_required" });
      }
      attachments = req.body.attachments
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 10);
      if (!attachments.length) {
        return res.status(400).json({ ok: false, error: "attachments_required" });
      }
    }

    let poll = null;
    if (kind === "poll") {
      const payload = req.body.poll || {};
      const question = (payload.question || "").toString().trim();
      const options = Array.isArray(payload.options)
        ? payload.options
            .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
            .filter(Boolean)
        : [];
      const anonymous = !!payload.anonymous;
      if (!question || options.length < 2) {
        return res
          .status(400)
          .json({ ok: false, error: "poll_invalid" });
      }
      poll = { question: question.slice(0, 200), options: options.slice(0, 10), anonymous };
      if (!text) text = poll.question;
    }

    if (kind === "post" && !text) {
      return res.status(400).json({ ok: false, error: "text_required" });
    }

    const parentId = req.body.parent_id ? parseInt(req.body.parent_id, 10) : null;
    if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
      return res.status(400).json({ ok: false, error: "invalid_parent" });
    }
    if (parentId) {
      const parent = db
        .prepare("SELECT id, user_id FROM posts WHERE id=?")
        .get(parentId);
      if (!parent) return res.status(404).json({ ok: false, error: "parent_not_found" });
      if (parent.user_id !== req.user.uid) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }
    }

    const createdAt = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO posts (user_id, kind, text, attachments, poll, created_at, parent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user.uid,
        kind,
        text,
        JSON.stringify(attachments),
        poll ? JSON.stringify(poll) : null,
        createdAt,
        parentId
      );

    const saved = db
      .prepare(
        `SELECT p.id, p.user_id, p.kind, p.text, p.attachments, p.poll, p.created_at, p.parent_id,
                (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) as likes,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id=p.id AND user_id=?) as liked,
                (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id) as comments
         FROM posts p WHERE p.id=?`
      )
      .get(req.user.uid, info.lastInsertRowid);

    res.json({ ok: true, post: mapPost(saved) });
  } catch (e) {
    console.error("POST /posts:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/posts/:id/like", authMiddleware, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }
    const post = db
      .prepare("SELECT id, user_id FROM posts WHERE id=?")
      .get(id);
    if (!post) return res.status(404).json({ ok: false, error: "not_found" });

    const exists = db
      .prepare("SELECT 1 FROM post_likes WHERE post_id=? AND user_id=?")
      .get(id, req.user.uid);
    if (exists) {
      db.prepare("DELETE FROM post_likes WHERE post_id=? AND user_id=?").run(id, req.user.uid);
    } else {
      db.prepare("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)").run(id, req.user.uid);
    }
    const total = db
      .prepare("SELECT COUNT(*) as c FROM post_likes WHERE post_id=?")
      .get(id).c;
    res.json({ ok: true, liked: !exists, likes: total });
  } catch (e) {
    console.error("POST /posts/:id/like:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/posts/:id/comments", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }
    const rows = db
      .prepare(
        `SELECT c.id, c.post_id, c.user_id, c.parent_id, c.text, c.created_at, u.nick, u.avatar_path
         FROM post_comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id=? ORDER BY c.id ASC`
      )
      .all(id);

    const nodes = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      parent_id: row.parent_id,
      text: row.text,
      created_at: row.created_at,
      nick: row.nick,
      avatar: row.avatar_path || null,
      replies: [],
    }));

    const map = new Map();
    nodes.forEach((node) => map.set(node.id, node));
    const roots = [];
    nodes.forEach((node) => {
      if (node.parent_id && map.has(node.parent_id)) {
        map.get(node.parent_id).replies.push(node);
      } else {
        roots.push(node);
      }
    });

    res.json({ ok: true, comments: roots, total: nodes.length });
  } catch (e) {
    console.error("GET /posts/:id/comments:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/posts/:id/comments", authMiddleware, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }
    const text = (req.body?.text || '').toString().trim().slice(0, 500);
    if (!text) return res.status(400).json({ ok: false, error: "text_required" });
    const post = db.prepare("SELECT id FROM posts WHERE id=?").get(id);
    if (!post) return res.status(404).json({ ok: false, error: "not_found" });
    const parentId = req.body?.parent_id ? parseInt(req.body.parent_id, 10) : null;
    if (parentId !== null) {
      if (!Number.isInteger(parentId) || parentId <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_parent" });
      }
      const parent = db
        .prepare("SELECT id, post_id FROM post_comments WHERE id=?")
        .get(parentId);
      if (!parent || parent.post_id !== id) {
        return res.status(404).json({ ok: false, error: "parent_not_found" });
      }
    }
    const info = db
      .prepare("INSERT INTO post_comments (post_id, user_id, text, parent_id) VALUES (?, ?, ?, ?)")
      .run(id, req.user.uid, text, parentId);
    const saved = db
      .prepare(
        `SELECT c.id, c.post_id, c.user_id, c.parent_id, c.text, c.created_at, u.nick, u.avatar_path
         FROM post_comments c JOIN users u ON u.id=c.user_id WHERE c.id=?`
      )
      .get(info.lastInsertRowid);
    const total = db
      .prepare("SELECT COUNT(*) as c FROM post_comments WHERE post_id=?")
      .get(id).c;
    res.json({ ok: true, comment: {
      id: saved.id,
      post_id: saved.post_id,
      user_id: saved.user_id,
      parent_id: saved.parent_id,
      text: saved.text,
      created_at: saved.created_at,
      nick: saved.nick,
      avatar: saved.avatar_path || null,
      replies: [],
    }, total });
  } catch (e) {
    console.error("POST /posts/:id/comments:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
