import express from "express";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../../middlewares/auth.js";
import upload from "../../middlewares/userUploads.js";
import { getUserById, updateProfile } from "../../repositories/usersRepository.js";
import { ensureMinSizeOrThrow } from "../../utils/image.js";

const router = express.Router();

router.post(
  "/setup",
  authMiddleware,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "verify_photo", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const user = getUserById(req.user.uid);
      if (!user) return res.status(404).json({ error: "not_found" });

      if (user.status !== "email_confirmed") {
        return res
          .status(403)
          .json({ error: "email_not_confirmed_or_already_sent" });
      }

      const avatarFile = req.files?.avatar?.[0];
      const verifyFile = req.files?.verify_photo?.[0];
      if (!avatarFile || !verifyFile) {
        return res.status(400).json({ error: "files_required" });
      }

      const about = (req.body.about || "").toString().slice(0, 300);
      const looking_for = (req.body.looking_for || "").toString();
      const interests = (req.body.interests || "").toString();

      // Validate minimal dimensions (>= 600x600)
      try {
        ensureMinSizeOrThrow(avatarFile.path, 600, 600);
        ensureMinSizeOrThrow(verifyFile.path, 600, 600);
      } catch (err) {
        try { fs.unlinkSync(avatarFile.path); } catch {}
        try { fs.unlinkSync(verifyFile.path); } catch {}
        if (err.code === "IMAGE_TOO_SMALL") {
          return res.status(400).json({ error: "image_too_small", width: err.width, height: err.height });
        }
        return res.status(400).json({ error: "invalid_image" });
      }

      const avatar_path = `/uploads/avatars/${path.basename(avatarFile.path)}`;
      const verify_path = `/uploads/verify/${path.basename(verifyFile.path)}`;

      updateProfile({
        id: user.id,
        about,
        looking_for,
        interests,
        avatar_path,
        verify_path,
        status: "profile_pending",
        updated_at: new Date().toISOString(),
      });

      res.json({ ok: true, status: "profile_pending" });
    } catch (error) {
      console.error("profile/setup:", error);
      res.status(500).json({ error: "server_error" });
    }
  }
);

export default router;

// Inline edit basic info (about, interests, city)
router.patch("/me/info", authMiddleware, (req, res) => {
  try {
    const user = getUserById(req.user.uid);
    if (!user) return res.status(404).json({ ok: false, error: "not_found" });

    const about = (req.body.about ?? user.about ?? "").toString().slice(0, 300);
    const interests = (req.body.interests ?? user.interests ?? "").toString().slice(0, 300);
    const city = (req.body.city ?? user.city ?? "").toString().slice(0, 100);

    // direct SQL update (usersRepository.updateProfile affects status/photos)
    const stmt = `UPDATE users SET about=?, interests=?, city=?, updated_at=datetime('now') WHERE id=?`;
    db.prepare(stmt).run(about, interests, city, user.id);

    res.json({ ok: true, about, interests, city });
  } catch (e) {
    console.error("PATCH /profile/me/info:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});
