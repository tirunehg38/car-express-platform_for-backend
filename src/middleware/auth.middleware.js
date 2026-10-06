const AuthService = require("../services/auth.service");
const httpError = require("../utils/httpError");

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.get("authorization") || "";
    const parts = authorization.trim().split(/\s+/);
    const [scheme, token] = parts;
    if (parts.length !== 2 || scheme !== "Bearer" || !token) {
      throw httpError(401, "Authentication token is required");
    }
    req.user = await AuthService.verifyToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
};

const optionalAuthenticate = async (req, res, next) => {
  if (!req.get("authorization")) return next();
  return authenticate(req, res, next);
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return next(httpError(403, "Administrator access is required"));
  }
  return next();
};

const requireOwnerOrAdmin = (param = "id") => (req, res, next) => {
  if (
    req.user?.role !== "admin" &&
    String(req.user?.id) !== String(req.params[param])
  ) {
    return next(httpError(403, "You may only access your own resources"));
  }
  return next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
  requireOwnerOrAdmin,
};