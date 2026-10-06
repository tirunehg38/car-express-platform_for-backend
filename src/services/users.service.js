const User = require("../models/user.model");
const serviceError = require("../utils/serviceError");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pagination = ({ page, limit }) => {
  const parsedPage = page === undefined ? 1 : Number(page);
  const parsedLimit = limit === undefined ? 20 : Number(limit);
  if (!Number.isSafeInteger(parsedPage) || parsedPage < 1) {
    throw serviceError("VALIDATION_ERROR", "page must be a positive integer");
  }
  if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1) {
    throw serviceError("VALIDATION_ERROR", "limit must be a positive integer");
  }
  const safeLimit = Math.min(parsedLimit, 100);
  return { page: parsedPage, limit: safeLimit, offset: (parsedPage - 1) * safeLimit };
};

const list = async (options = {}) => {
  const paging = pagination(options);
  const result = await User.list(paging);
  return {
    items: result.items,
    pagination: { page: paging.page, limit: paging.limit, total: result.total },
  };
};

const getById = async (id) => {
  const user = await User.findById(id);
  if (!user) throw serviceError("NOT_FOUND", "User not found");
  return user;
};

const update = async (id, input, actor) => {
  const allowedFields = ["name", "email", "phone", "avatar_url"];
  if (actor.role === "admin") allowedFields.push("role");
  const supplied = Object.keys(input);
  if (!supplied.length) throw serviceError("VALIDATION_ERROR", "At least one field is required");
  if (supplied.some((field) => !allowedFields.includes(field))) {
    throw serviceError("VALIDATION_ERROR", "Request contains unsupported user fields");
  }

  const fields = {};
  for (const field of supplied) {
    const value = input[field];
    if (field === "name") {
      if (typeof value !== "string" || !value.trim()) {
        throw serviceError("VALIDATION_ERROR", "Name must be a non-empty string");
      }
      fields.name = value.trim();
    } else if (field === "email") {
      if (typeof value !== "string" || !emailPattern.test(value.trim())) {
        throw serviceError("VALIDATION_ERROR", "Email must be valid");
      }
      fields.email = value.trim().toLowerCase();
    } else if (field === "phone" || field === "avatar_url") {
      if (value !== null && typeof value !== "string") {
        throw serviceError("VALIDATION_ERROR", `${field} must be a string or null`);
      }
      fields[field] = typeof value === "string" ? value.trim() || null : null;
    } else if (field === "role") {
      if (!["buyer", "seller", "admin"].includes(value)) {
        throw serviceError("VALIDATION_ERROR", "Role must be buyer, seller, or admin");
      }
      fields.role = value;
    }
  }

  const updated = await User.update(id, fields);
  if (!updated) throw serviceError("NOT_FOUND", "User not found");
  return updated;
};

const remove = async (id) => {
  if (!(await User.remove(id))) throw serviceError("NOT_FOUND", "User not found");
};

module.exports = { list, getById, update, remove };
