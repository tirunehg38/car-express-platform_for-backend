const httpError = require("../utils/httpError");

const requireBody = (req, res, next) => {
  if (
    req.body === null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return next(httpError(400, "Request body must be a JSON object"));
  }
  return next();
};

const validateId = (parameter = "id") => (req, res, next) => {
  const value = req.params[parameter] || "";
  if (
    !/^[1-9]\d*$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    return next(httpError(400, `Invalid ${parameter}`));
  }
  return next();
};

module.exports = { requireBody, validateId };