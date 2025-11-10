import express from "express";
import path from "path";
import { authMiddleware } from "../../middlewares/auth.js";
import upload from "../../middlewares/userUploads.js";
import { getUserById, updateProfile } from "../../repositories/usersRepository.js";

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
