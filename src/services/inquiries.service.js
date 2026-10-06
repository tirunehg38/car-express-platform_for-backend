const Inquiry = require("../models/inquiry.model");
const Car = require("../models/car.model");
const serviceError = require("../utils/serviceError");

const validTypes = ["contact", "financing"];
const validStatuses = ["new", "read", "replied", "closed"];
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

const list = async (query = {}, actor) => {
  const paging = pagination(query);
  const scope = query.scope || (actor.role === "admin" ? "all" : "received");
  const status = query.status || "all";
  if (status !== "all" && !validStatuses.includes(status)) {
    throw serviceError("VALIDATION_ERROR", `status must be one of: ${validStatuses.join(", ")}`);
  }
  const result = await Inquiry.list({
    ...paging,
    userId: actor.id,
    isAdmin: actor.role === "admin",
    scope,
    status,
  });
  return {
    items: result.items,
    pagination: { page: paging.page, limit: paging.limit, total: result.total },
  };
};

const getById = async (id, actor) => {
  const inquiry = await Inquiry.findById(id);
  if (!inquiry) throw serviceError("NOT_FOUND", "Inquiry not found");
  const isAdmin = actor.role === "admin";
  const isSeller = inquiry.seller_id && String(inquiry.seller_id) === String(actor.id);
  const isSender = inquiry.user_id && String(inquiry.user_id) === String(actor.id);
  if (!isAdmin && !isSeller && !isSender) {
    throw serviceError("FORBIDDEN", "You do not have permission to view this inquiry");
  }
  return inquiry;
};

const create = async (input, actor = null) => {
  const allowed = ["type", "name", "email", "message", "car_id"];
  if (Object.keys(input).some((field) => !allowed.includes(field))) {
    throw serviceError("VALIDATION_ERROR", "Request contains unsupported inquiry fields");
  }
  const { type, name, email, message, car_id } = input;
  if (!validTypes.includes(type)) {
    throw serviceError("VALIDATION_ERROR", "type must be contact or financing");
  }
  if (typeof name !== "string" || !name.trim()) {
    throw serviceError("VALIDATION_ERROR", "A non-empty name is required");
  }
  if (typeof email !== "string" || !emailPattern.test(email.trim())) {
    throw serviceError("VALIDATION_ERROR", "A valid email is required");
  }
  if (typeof message !== "string" || !message.trim()) {
    throw serviceError("VALIDATION_ERROR", "A non-empty message is required");
  }
  if (
    car_id !== undefined &&
    car_id !== null &&
    (!/^[1-9]\d*$/.test(String(car_id)) ||
      BigInt(car_id) > 9223372036854775807n)
  ) {
    throw serviceError("VALIDATION_ERROR", "car_id must be a positive integer or null");
  }
  if (car_id !== undefined && car_id !== null && !(await Car.findExistingById(car_id))) {
    throw serviceError("NOT_FOUND", "Car not found");
  }
  return Inquiry.create({
    user_id: actor?.id || null,
    car_id: car_id ?? null,
    type,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    message: message.trim(),
  });
};

const update = async (id, input, actor) => {
  const inquiry = await Inquiry.findById(id);
  if (!inquiry) throw serviceError("NOT_FOUND", "Inquiry not found");
  const isAdmin = actor.role === "admin";
  const isSeller = inquiry.seller_id && String(inquiry.seller_id) === String(actor.id);
  const isSender = inquiry.user_id && String(inquiry.user_id) === String(actor.id);

  if (!isAdmin && !isSeller && !isSender) {
    throw serviceError("FORBIDDEN", "You do not have permission to update this inquiry");
  }

  if (input.status !== undefined && !isAdmin && !isSeller) {
    throw serviceError("FORBIDDEN", "Only administrators or the listing seller can update inquiry status");
  }

  const allowed = (isAdmin || isSeller)
    ? ["name", "email", "message", "status"]
    : ["name", "email", "message"];

  const supplied = Object.keys(input);
  if (!supplied.length) throw serviceError("VALIDATION_ERROR", "At least one field is required");
  if (supplied.some((field) => !allowed.includes(field))) {
    throw serviceError("VALIDATION_ERROR", "Request contains unsupported inquiry fields");
  }

  const fields = {};
  for (const field of supplied) {
    const value = input[field];
    if (field === "name" || field === "message") {
      if (typeof value !== "string" || !value.trim()) {
        throw serviceError("VALIDATION_ERROR", `${field} must be a non-empty string`);
      }
      fields[field] = value.trim();
    } else if (field === "email") {
      if (typeof value !== "string" || !emailPattern.test(value.trim())) {
        throw serviceError("VALIDATION_ERROR", "Email must be valid");
      }
      fields.email = value.trim().toLowerCase();
    } else if (field === "status") {
      if (!validStatuses.includes(value)) {
        throw serviceError("VALIDATION_ERROR", `status must be one of: ${validStatuses.join(", ")}`);
      }
      fields.status = value;
    }
  }

  const updated = await Inquiry.update(id, fields, actor.id, isAdmin, isSeller);
  if (!updated) throw serviceError("NOT_FOUND", "Inquiry not found");
  return updated;
};

const updateStatus = async (id, status, actor) => {
  if (!validStatuses.includes(status)) {
    throw serviceError("VALIDATION_ERROR", `status must be one of: ${validStatuses.join(", ")}`);
  }
  const inquiry = await Inquiry.findById(id);
  if (!inquiry) throw serviceError("NOT_FOUND", "Inquiry not found");
  const isAdmin = actor.role === "admin";
  const isSeller = inquiry.seller_id && String(inquiry.seller_id) === String(actor.id);
  if (!isAdmin && !isSeller) {
    throw serviceError("FORBIDDEN", "Only administrators or the listing seller can update inquiry status");
  }
  return Inquiry.updateStatus(id, status);
};

const remove = async (id, actor) => {
  const inquiry = await Inquiry.findById(id);
  if (!inquiry) throw serviceError("NOT_FOUND", "Inquiry not found");
  const isAdmin = actor.role === "admin";
  const isSeller = inquiry.seller_id && String(inquiry.seller_id) === String(actor.id);
  const isSender = inquiry.user_id && String(inquiry.user_id) === String(actor.id);
  if (!isAdmin && !isSeller && !isSender) {
    throw serviceError("FORBIDDEN", "You do not have permission to delete this inquiry");
  }
  await Inquiry.remove(id, actor.id, isAdmin, isSeller);
};

module.exports = { list, getById, create, update, updateStatus, remove };
