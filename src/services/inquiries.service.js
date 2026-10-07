const Inquiry = require("../models/inquiry.model");
const Car = require("../models/car.model");
const User = require("../models/user.model");
const EmailService = require("./email.service");
const serviceError = require("../utils/serviceError");

const validTypes = ["contact", "financing"];
const validStatuses = ["new", "contacted", "read", "replied", "closed"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s\-().]{7,25}$/;

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
  const allowed = [
    "type", "name", "email", "phone", "message", "car_id",
    "buyerName", "buyerEmail", "buyerPhone", "carId",
  ];
  if (Object.keys(input).some((field) => !allowed.includes(field))) {
    throw serviceError("VALIDATION_ERROR", "Request contains unsupported inquiry fields");
  }

  const rawCarId = input.carId !== undefined ? input.carId : input.car_id;
  const name = input.buyerName !== undefined ? input.buyerName : input.name;
  const email = input.buyerEmail !== undefined ? input.buyerEmail : input.email;
  const phone = input.buyerPhone !== undefined ? input.buyerPhone : input.phone;
  const message = input.message;
  const type = input.type || "contact";

  if (!validTypes.includes(type)) {
    throw serviceError("VALIDATION_ERROR", "type must be contact or financing");
  }

  // 1. Validate Buyer Name
  if (name === undefined || name === null || typeof name !== "string" || !name.trim()) {
    throw serviceError("VALIDATION_ERROR", "Buyer name is required");
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    throw serviceError("VALIDATION_ERROR", "Buyer name must be 100 characters or less");
  }

  // 2. Validate Buyer Email
  if (email === undefined || email === null || typeof email !== "string" || !emailPattern.test(email.trim())) {
    throw serviceError("VALIDATION_ERROR", "A valid email address is required");
  }
  const trimmedEmail = email.trim().toLowerCase();

  // 3. Validate Buyer Phone
  const isCarInquiry = rawCarId !== undefined && rawCarId !== null && rawCarId !== "";
  if (isCarInquiry) {
    if (phone === undefined || phone === null || typeof phone !== "string" || !phone.trim()) {
      throw serviceError("VALIDATION_ERROR", "Buyer phone number is required");
    }
  }
  let trimmedPhone = null;
  if (phone !== undefined && phone !== null && typeof phone === "string" && phone.trim()) {
    trimmedPhone = phone.trim();
    if (!phonePattern.test(trimmedPhone)) {
      throw serviceError("VALIDATION_ERROR", "Buyer phone number must be a valid format");
    }
  }

  // 4. Validate Message
  if (message === undefined || message === null || typeof message !== "string" || !message.trim()) {
    throw serviceError("VALIDATION_ERROR", "A non-empty message is required");
  }
  const trimmedMessage = message.trim();
  if (trimmedMessage.length > 2000) {
    throw serviceError("VALIDATION_ERROR", "Message must be 2000 characters or less");
  }

  let car = null;
  let seller = null;
  let validatedCarId = null;

  // 5. If car inquiry, verify car, seller, and seller email
  if (isCarInquiry) {
    if (
      !/^[1-9]\d*$/.test(String(rawCarId)) ||
      BigInt(rawCarId) > 9223372036854775807n
    ) {
      throw serviceError("VALIDATION_ERROR", "Invalid car ID");
    }
    validatedCarId = String(rawCarId);

    car = await Car.findById(validatedCarId, true);
    if (!car) {
      throw serviceError("NOT_FOUND", "Car not found");
    }

    if (!car.owner_id) {
      throw serviceError("VALIDATION_ERROR", "This car listing does not have an assigned seller");
    }

    seller = await User.findById(car.owner_id);
    if (!seller) {
      throw serviceError("NOT_FOUND", "The seller for this car could not be found");
    }

    if (!seller.email || !emailPattern.test(String(seller.email).trim())) {
      throw serviceError("VALIDATION_ERROR", "The seller does not have a registered email address");
    }
  }

  // 6. Save inquiry in PostgreSQL (source of truth)
  const savedInquiry = await Inquiry.create({
    user_id: actor?.id || null,
    car_id: validatedCarId,
    type,
    name: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone,
    message: trimmedMessage,
    status: "new",
  });

  // 7. Send notification email to seller via Resend safely
  if (car && seller) {
    try {
      const emailResult = await EmailService.sendSellerInquiryNotification({
        seller: {
          id: seller.id,
          name: seller.name,
          email: seller.email,
        },
        buyer: {
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
        },
        car: {
          id: car.id,
          brand_name: car.brand_name || car.brand,
          model: car.model,
          year: car.year,
          price: car.price,
        },
        inquiry: {
          id: savedInquiry.id,
          message: trimmedMessage,
          created_at: savedInquiry.created_at,
        },
      });

      if (emailResult.success) {
        await Inquiry.updateEmailDelivery(savedInquiry.id, {
          email_sent: true,
          email_sent_at: new Date(),
          email_error: null,
        });
        savedInquiry.email_sent = true;
      } else {
        await Inquiry.updateEmailDelivery(savedInquiry.id, {
          email_sent: false,
          email_error: emailResult.error || "Email delivery failed",
        });
        savedInquiry.email_sent = false;
        savedInquiry.email_error = emailResult.error;
      }
    } catch (emailError) {
      console.error("[InquiriesService] Email notification error:", emailError.message);
      await Inquiry.updateEmailDelivery(savedInquiry.id, {
        email_sent: false,
        email_error: emailError.message || "Failed to deliver email",
      }).catch(() => {});
      savedInquiry.email_sent = false;
      savedInquiry.email_error = emailError.message;
    }
  }

  return savedInquiry;
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
    ? ["name", "email", "phone", "message", "status"]
    : ["name", "email", "phone", "message"];

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
    } else if (field === "phone") {
      if (value !== null && typeof value !== "string") {
        throw serviceError("VALIDATION_ERROR", "Phone must be a string or null");
      }
      if (typeof value === "string" && value.trim()) {
        if (!phonePattern.test(value.trim())) {
          throw serviceError("VALIDATION_ERROR", "Phone must be a valid format");
        }
        fields.phone = value.trim();
      } else {
        fields.phone = null;
      }
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
