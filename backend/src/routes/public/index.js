import express from "express";
import authRouter from "./auth.js";
import profileRouter from "./profile.js";
import meRouter from "./me.js";
import promoRouter from "./promo.js";
import billingRouter from "./billing.js";
import publicAdsRouter from "./ads.js";
import feedRouter from "./feed.js";
import usersRouter from "./users.js";
import friendsRouter from "./friends.js";
import photosRouter from "./photos.js";
import postsRouter from "./posts.js";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/me", meRouter);
router.use(promoRouter);
router.use(billingRouter);
router.use(publicAdsRouter);
router.use(feedRouter);
router.use(usersRouter);
router.use(friendsRouter);
router.use(photosRouter);
router.use(postsRouter);

export default router;
