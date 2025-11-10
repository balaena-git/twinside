import express from "express";
import authRouter from "./auth.js";
import profileRouter from "./profile.js";
import meRouter from "./me.js";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/me", meRouter);

export default router;
