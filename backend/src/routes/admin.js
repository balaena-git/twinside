import express from "express";
import { JWT_SECRET } from "../config.js";
import { createUploaders, logAdminRequest, adminSessionGuard } from "./admin/common.js";
import { ensureFinanceTables, ensureSupportTables, ensureAdminTables, ensurePromoTables, ensureAdsTables, ensureComplaintsTables, ensureSocialTables, ensurePhotoTables } from "./admin/bootstrap.js";
import financeRouter from "./admin/finance.js";
import dashboardRouter from "./admin/dashboard.js";
import createUsersRouter from "./admin/users.js";
import moderationRouter from "./admin/moderation.js";
import createSupportRouter from "./admin/support.js";
import createAdsRouter from "./admin/ads.js";
import complaintsRouter from "./admin/complaints.js";
import promosRouter from "./admin/promos.js";
import {
  registerPublicAuthRoutes,
  createProtectedAuthRouter,
} from "./admin/auth.js";

const router = express.Router();
const { ADMIN_EMAIL, ADMIN_PASS } = process.env;

console.log(
  "[admin] credentials",
  ADMIN_EMAIL ? "configured" : "missing",
  ADMIN_PASS ? "configured" : "missing"
);

if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.warn(
    "[admin] ADMIN_EMAIL or ADMIN_PASS is not configured — admin login disabled"
  );
}

ensureFinanceTables();
ensureSupportTables();
ensureAdminTables();
ensurePromoTables();
ensureAdsTables();
ensureComplaintsTables();
ensureSocialTables();
ensurePhotoTables();

const { avatarUpload, supportUpload, adsUpload } = createUploaders();

router.use(logAdminRequest);
router.use((req, _res, next) => {
  console.log(`[admin] ${req.method} ${req.path}`);
  next();
});
registerPublicAuthRoutes(router, { adminEmail: ADMIN_EMAIL, adminPass: ADMIN_PASS });

router.use(adminSessionGuard);

router.use(createProtectedAuthRouter({ jwtSecret: JWT_SECRET }));
router.use(financeRouter);
router.use(dashboardRouter);
router.use(createUsersRouter({ avatarUpload }));
router.use(moderationRouter);
router.use(createSupportRouter({ supportUpload }));
router.use(promosRouter);
router.use(createAdsRouter({ adsUpload }));
router.use(complaintsRouter);

export default router;
