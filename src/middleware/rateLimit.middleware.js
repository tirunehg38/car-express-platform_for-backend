const httpError = require("../utils/httpError");

// In-memory sliding window rate limiter
const ipRequests = new Map();
const recentSubmissions = new Map();

// Default: max 10 requests per 15 minutes window
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;
const DUPLICATE_COOLDOWN_MS = 5 * 1000; // 5 seconds between identical inquiries

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "127.0.0.1";
};

const inquiryRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || WINDOW_MS;
  const max = options.max || MAX_REQUESTS;
  const cooldownMs = options.cooldownMs || DUPLICATE_COOLDOWN_MS;

  return (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();

    // 1. Sliding window request count
    let records = ipRequests.get(ip) || [];
    records = records.filter((timestamp) => now - timestamp < windowMs);

    if (records.length >= max) {
      return next(
        httpError(429, "Too many inquiry requests from this IP. Please try again later.")
      );
    }

    // 2. Prevent rapid duplicate submissions (same carId + email within cooldown)
    const carId = req.body?.carId || req.body?.car_id || "general";
    const email = (req.body?.buyerEmail || req.body?.email || "").toLowerCase().trim();
    if (email) {
      const duplicateKey = `${ip}:${carId}:${email}`;
      const lastTime = recentSubmissions.get(duplicateKey);
      if (lastTime && now - lastTime < cooldownMs) {
        return next(
          httpError(
            429,
            "A duplicate inquiry was recently submitted. Please wait a few seconds before trying again."
          )
        );
      }
      recentSubmissions.set(duplicateKey, now);
    }

    records.push(now);
    ipRequests.set(ip, records);

    return next();
  };
};

const resetRateLimiter = () => {
  ipRequests.clear();
  recentSubmissions.clear();
};

// Periodic cleanup every 10 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, records] of ipRequests.entries()) {
    const active = records.filter((timestamp) => now - timestamp < WINDOW_MS);
    if (!active.length) ipRequests.delete(ip);
    else ipRequests.set(ip, active);
  }
  for (const [key, timestamp] of recentSubmissions.entries()) {
    if (now - timestamp > 60000) recentSubmissions.delete(key);
  }
}, 10 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

module.exports = {
  inquiryRateLimiter,
  resetRateLimiter,
};
