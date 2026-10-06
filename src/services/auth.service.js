const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/user.model");
const serviceError = require("../utils/serviceError");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createToken = (user) => {
  if (!config.jwt.secret) {
    throw serviceError("CONFIGURATION_ERROR", "JWT_SECRET is not configured");
  }
  return jwt.sign({}, config.jwt.secret, {
    subject: String(user.id),
    expiresIn: config.jwt.expiresIn,
    algorithm: "HS256",
  });
};

const verifyToken = async (token) => {
  if (!config.jwt.secret) {
    throw serviceError("CONFIGURATION_ERROR", "JWT_SECRET is not configured");
  }
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"] });
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      throw serviceError("AUTHENTICATION_FAILED", "Invalid or expired authentication token");
    }
    throw error;
  }
  if (!payload || typeof payload.sub !== "string") {
    throw serviceError("AUTHENTICATION_FAILED", "Invalid authentication token");
  }
  const user = await User.findAuthUser(payload.sub);
  if (!user) {
    throw serviceError("AUTHENTICATION_FAILED", "Authentication account no longer exists");
  }
  return user;
};

const register = async (input) => {
  if (!config.jwt.secret) {
    throw serviceError("CONFIGURATION_ERROR", "JWT_SECRET is not configured");
  }
  if (Object.keys(input).some((field) => !["name", "email", "password", "phone"].includes(field))) {
    throw serviceError("VALIDATION_ERROR", "Request contains unsupported registration fields");
  }
  const { name, email, password, phone } = input;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !emailPattern.test(email.trim()) ||
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw serviceError(
      "VALIDATION_ERROR",
      "Name, a valid email, and a password of 8-72 bytes are required"
    );
  }
  if (phone !== undefined && phone !== null && typeof phone !== "string") {
    throw serviceError("VALIDATION_ERROR", "Phone must be a string");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.findByEmail(normalizedEmail)) {
    throw serviceError("CONFLICT", "An account with this email already exists");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
  });
  return { user, token: createToken(user) };
};

const login = async ({ email, password }) => {
  if (
    typeof email !== "string" ||
    !emailPattern.test(email.trim()) ||
    typeof password !== "string" ||
    !password
  ) {
    throw serviceError("VALIDATION_ERROR", "A valid email and password are required");
  }
  const user = await User.findByEmail(email.trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw serviceError("AUTHENTICATION_FAILED", "Email or password is incorrect");
  }
  const {
    id,
    name,
    phone,
    avatar_url,
    role,
    created_at,
    updated_at,
  } = user;
  return {
    user: { id, name, email: user.email, phone, avatar_url, role, created_at, updated_at },
    token: createToken(user),
  };
};

const getCurrentUser = async (id) => {
  const user = await User.findById(id);
  if (!user) throw serviceError("NOT_FOUND", "User not found");
  return user;
};

module.exports = { register, login, getCurrentUser, createToken, verifyToken };
