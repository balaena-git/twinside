export const checkAdminAuth = (req, res, next) => {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ ok: false, error: "Unauthorized" });
};
