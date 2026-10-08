const Car = require("../models/car.model");
const CarImage = require("../models/car-image.model");
const StorageService = require("./storage.service");
const serviceError = require("../utils/serviceError");

const requiredText = ["model", "city", "area", "description"];
const optionalText = ["body_type", "engine_size", "color"];
const editableFields = [
  "brand_id", "model", "year", "price", "mileage", "vehicle_condition",
  "fuel_type", "transmission", "body_type", "engine_size", "color", "city",
  "area", "description", "features",
];
const validChoices = {
  vehicle_condition: ["new", "used", "certified"],
  fuel_type: ["petrol", "diesel", "hybrid", "electric"],
  transmission: ["manual", "automatic", "cvt"],
  status: ["pending", "approved", "rejected", "sold"],
};
const isPositiveId = (value) =>
  /^[1-9]\d*$/.test(String(value ?? "")) &&
  BigInt(value) <= 9223372036854775807n;

const cleanupStorageImages = async (images) => {
  await StorageService.cleanupImages(images);
};

const assertCarAccess = async (id, actor) => {
  const car = await Car.findOwner(id);
  if (!car) throw serviceError("NOT_FOUND", "Car not found");
  if (actor.role !== "admin" && String(car.owner_id) !== String(actor.id)) {
    throw serviceError("FORBIDDEN", "You may only manage images for your own car listings");
  }
  return car;
};

const uploadImages = async (id, files, actor, options = {}) => {
  await assertCarAccess(id, actor);
  if (!Array.isArray(files) || !files.length) {
    throw serviceError("VALIDATION_ERROR", "Select at least one image to upload");
  }
  if (files.length > 10) {
    throw serviceError("VALIDATION_ERROR", "You may upload at most 10 images at a time");
  }
  for (const file of files) {
    if (!file.mimetype?.startsWith("image/")) {
      throw serviceError("VALIDATION_ERROR", "Only image files are allowed");
    }
    if (!Buffer.isBuffer(file.buffer) || file.size > 10 * 1024 * 1024) {
      throw serviceError("VALIDATION_ERROR", "Each image must be no larger than 10 MB");
    }
  }

  const primaryIndex = options.primary_index === undefined || options.primary_index === ""
    ? undefined
    : Number(options.primary_index);
  if (
    primaryIndex !== undefined &&
    (!Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex >= files.length)
  ) {
    throw serviceError("VALIDATION_ERROR", "primary_index must identify an uploaded image");
  }
  const primaryImageId = options.primary_image_id === undefined || options.primary_image_id === ""
    ? undefined
    : options.primary_image_id;
  if (primaryIndex !== undefined && primaryImageId !== undefined) {
    throw serviceError("VALIDATION_ERROR", "Select one primary image");
  }
  if (primaryImageId !== undefined) {
    if (!isPositiveId(primaryImageId)) {
      throw serviceError("VALIDATION_ERROR", "primary_image_id must be a positive integer");
    }
    if (!(await CarImage.findImageById(id, primaryImageId))) {
      throw serviceError("VALIDATION_ERROR", "The selected primary image does not belong to this car");
    }
  }
  const existingImages = await CarImage.findImagesByCarId(id);
  if (existingImages.length + files.length > 10) {
    throw serviceError("VALIDATION_ERROR", "A car may have no more than 10 images");
  }

  const uploaded = [];
  try {
    for (const file of files) {
      uploaded.push(await StorageService.uploadImage(file));
    }
    return await CarImage.createCarImages(id, uploaded, { primaryIndex, primaryImageId });
  } catch (error) {
    await cleanupStorageImages(uploaded);
    if (uploaded.length !== files.length) {
      console.error("Car image upload failed", {
        errorCode: error.code ?? "UNKNOWN",
        httpStatus: error.http_code ?? error.status ?? null,
      });
      const message = error.message || "Car image upload failed; verify storage configuration";
      const uploadError = serviceError(error.code || "UPLOAD_FAILED", message);
      uploadError.status = error.status || 502;
      throw uploadError;
    }
    throw error;
  }
};

const setPrimaryImage = async (carId, imageId, actor) => {
  await assertCarAccess(carId, actor);
  if (!isPositiveId(imageId)) {
    throw serviceError("VALIDATION_ERROR", "Invalid image ID");
  }
  return CarImage.setPrimaryCarImage(carId, imageId);
};

const deleteImage = async (carId, imageId, actor) => {
  await assertCarAccess(carId, actor);
  if (!isPositiveId(imageId)) {
    throw serviceError("VALIDATION_ERROR", "Invalid image ID");
  }
  const image = await CarImage.findImageById(carId, imageId);
  if (!image) throw serviceError("NOT_FOUND", "Car image not found");
  if (image.public_id) {
    try {
      await StorageService.deleteImage(image.public_id);
    } catch (error) {
      const deleteError = serviceError("UPLOAD_FAILED", "Image could not be deleted from storage");
      deleteError.status = 502;
      throw deleteError;
    }
  }
  try {
    const deleted = await CarImage.deleteCarImage(carId, imageId);
    if (!deleted) throw serviceError("NOT_FOUND", "Car image not found");
    return deleted;
  } catch (error) {
    if (image.public_id) {
      console.error("Cloudinary image was deleted but its database record remains", {
        carId,
        imageId,
        error: error.message,
      });
      const syncError = serviceError(
        "IMAGE_SYNC_FAILED",
        "The image was removed from storage, but its database record could not be deleted. Retry the deletion."
      );
      syncError.status = 503;
      throw syncError;
    }
    throw error;
  }
};

const validateCar = (car) => {
  for (const field of requiredText) {
    if (typeof car[field] !== "string" || !car[field].trim()) {
      throw serviceError(
        "VALIDATION_ERROR",
        `${field} is required and must be a non-empty string`
      );
    }
  }
  if (!isPositiveId(car.brand_id)) {
    throw serviceError("VALIDATION_ERROR", "A valid brand_id is required");
  }
  if (!Number.isInteger(Number(car.year)) || Number(car.year) < 1900 || Number(car.year) > 2100) {
    throw serviceError("VALIDATION_ERROR", "Year must be an integer between 1900 and 2100");
  }
  if (!Number.isFinite(Number(car.price)) || Number(car.price) <= 0) {
    throw serviceError("VALIDATION_ERROR", "Price must be greater than zero");
  }
  if (!Number.isInteger(Number(car.mileage)) || Number(car.mileage) < 0) {
    throw serviceError("VALIDATION_ERROR", "Mileage must be a non-negative integer");
  }
  for (const [field, choices] of Object.entries(validChoices)) {
    if (!choices.includes(car[field])) {
      throw serviceError("VALIDATION_ERROR", `${field} must be one of: ${choices.join(", ")}`);
    }
  }
  if (!Array.isArray(car.features) || car.features.some((item) => typeof item !== "string")) {
    throw serviceError("VALIDATION_ERROR", "Features must be an array of strings");
  }
  for (const field of optionalText) {
    if (car[field] !== undefined && car[field] !== null && typeof car[field] !== "string") {
      throw serviceError("VALIDATION_ERROR", `${field} must be a string or null`);
    }
  }
};

const parseInteger = (value, field, minimum = 0) => {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) {
    throw serviceError("VALIDATION_ERROR", `${field} must be an integer of at least ${minimum}`);
  }
  return Number(value);
};

const list = async (query = {}, actor = null) => {
  const page = parseInteger(query.page, "page", 1) || 1;
  const limit = Math.min(parseInteger(query.limit, "limit", 1) || 20, 100);
  if (query.mine !== undefined && query.mine !== "true") {
    throw serviceError("VALIDATION_ERROR", "mine must be true when provided");
  }
  const mine = query.mine === "true";
  if (mine && !actor) {
    throw serviceError("AUTHENTICATION_FAILED", "Authentication is required to view your listings");
  }
  const brand_id = parseInteger(query.brand_id, "brand_id", 1);
  const year = parseInteger(query.year, "year", 1900);
  if (year !== undefined && year > 2100) {
    throw serviceError("VALIDATION_ERROR", "year must not be greater than 2100");
  }
  const min_price = query.min_price === undefined ? undefined : Number(query.min_price);
  const max_price = query.max_price === undefined ? undefined : Number(query.max_price);
  for (const [field, value] of [["min_price", min_price], ["max_price", max_price]]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw serviceError("VALIDATION_ERROR", `${field} must be a non-negative number`);
    }
  }
  if (min_price !== undefined && max_price !== undefined && min_price > max_price) {
    throw serviceError("VALIDATION_ERROR", "min_price cannot be greater than max_price");
  }
  const filters = { brand_id, year, min_price, max_price };
  for (const field of ["fuel_type", "transmission", "vehicle_condition"]) {
    const choices = validChoices[field];
    if (query[field] !== undefined && !choices.includes(query[field])) {
      throw serviceError("VALIDATION_ERROR", `Invalid ${field}`);
    }
    filters[field] = query[field];
  }
  for (const field of ["city", "q"]) {
    if (query[field] !== undefined) {
      if (typeof query[field] !== "string" || !query[field].trim()) {
        throw serviceError("VALIDATION_ERROR", `${field} must not be empty`);
      }
      filters[field] = query[field].trim();
    }
  }
  const isAdmin = actor?.role === "admin";
  if (query.status !== undefined && !isAdmin && !mine) {
    throw serviceError("FORBIDDEN", "Only administrators or listing owners may filter by status");
  }
  if (query.status !== undefined && query.status !== "all" && !validChoices.status.includes(query.status)) {
    throw serviceError("VALIDATION_ERROR", "Invalid car status");
  }
  if (mine) {
    filters.status = query.status === undefined || query.status === "all" ? "all" : query.status;
  } else if (isAdmin) {
    filters.status = query.status === undefined ? "approved" : query.status;
  } else {
    filters.status = "approved";
  }
  filters.owner_id = mine ? actor.id : undefined;
  const sort = query.sort || "created_at";
  const order = (query.order || "desc").toUpperCase();
  if (!["created_at", "price", "year"].includes(sort) || !["ASC", "DESC"].includes(order)) {
    throw serviceError("VALIDATION_ERROR", "Invalid sort or order");
  }

  const result = await Car.findAll({
    ...filters,
    limit,
    offset: (page - 1) * limit,
    sort,
    order,
  });
  return {
    items: result.items,
    pagination: { page, limit, total: result.total },
  };
};

const getById = async (id, actor = null) => {
  const car = await Car.findById(id, true);
  if (!car) throw serviceError("NOT_FOUND", "Car not found");
  if (
    car.status !== "approved" &&
    actor?.role !== "admin" &&
    String(car.owner_id) !== String(actor?.id)
  ) {
    throw serviceError("NOT_FOUND", "Car not found");
  }
  return car;
};

const create = async (input, actor) => {
  const allowedFields = new Set([
    ...editableFields,
    ...(actor.role === "admin" ? ["status", "owner_id"] : []),
  ]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw serviceError("VALIDATION_ERROR", "Request contains unsupported car fields");
  }
  const car = { ...input };
  car.status = actor.role === "admin" ? car.status || "pending" : "pending";
  if (car.owner_id !== undefined && car.owner_id !== null && !isPositiveId(car.owner_id)) {
    throw serviceError("VALIDATION_ERROR", "owner_id must be a positive integer or null");
  }
  validateCar(car);
  const ownerId =
    actor.role === "admin" && car.owner_id !== undefined ? car.owner_id : actor.id;
  const normalized = {
    ...car,
    owner_id: ownerId,
    model: car.model.trim(),
    city: car.city.trim(),
    area: car.area.trim(),
    description: car.description.trim(),
  };
  for (const field of optionalText) {
    if (typeof normalized[field] === "string") normalized[field] = normalized[field].trim() || null;
  }
  return Car.create(normalized);
};

const update = async (id, input, actor) => {
  const current = await Car.findById(id, true);
  if (!current) throw serviceError("NOT_FOUND", "Car not found");
  if (actor.role !== "admin" && String(current.owner_id) !== String(actor.id)) {
    throw serviceError("FORBIDDEN", "You may only update your own car listings");
  }
  const allowedFields = new Set([
    ...editableFields,
    ...(actor.role === "admin" ? ["status", "owner_id"] : []),
  ]);
  const supplied = Object.keys(input);
  if (!supplied.length) throw serviceError("VALIDATION_ERROR", "At least one field is required");
  if (supplied.some((field) => !allowedFields.has(field))) {
    throw serviceError("VALIDATION_ERROR", "Request contains unsupported car fields");
  }
  if (input.owner_id !== undefined && input.owner_id !== null && !isPositiveId(input.owner_id)) {
    throw serviceError("VALIDATION_ERROR", "owner_id must be a positive integer or null");
  }
  const merged = { ...current, ...input };
  validateCar(merged);
  const fields = {};
  for (const field of supplied) {
    let value = input[field];
    if (["model", "city", "area", "description"].includes(field)) value = value.trim();
    if (optionalText.includes(field) && typeof value === "string") value = value.trim() || null;
    fields[field] = value;
  }
  const updated = await Car.update(
    id,
    fields,
    actor.id,
    actor.role === "admin"
  );
  if (!updated) throw serviceError("FORBIDDEN", "You may only update your own car listings");
  return updated;
};

const updateStatus = async (id, status, actor) => {
  if (!validChoices.status.includes(status)) {
    throw serviceError("VALIDATION_ERROR", `Status must be one of: ${validChoices.status.join(", ")}`);
  }
  const current = await Car.findById(id, true);
  if (!current) throw serviceError("NOT_FOUND", "Car not found");

  const isAdmin = actor.role === "admin";
  const isOwner = String(current.owner_id) === String(actor.id);

  if (!isAdmin && !isOwner) {
    throw serviceError("FORBIDDEN", "You do not have permission to modify this listing");
  }

  if (!isAdmin) {
    if (current.status === "pending" || current.status === "rejected") {
      throw serviceError(
        "FORBIDDEN",
        "Only an administrator can approve or reject listings under review"
      );
    }
    if (status !== "sold" && status !== "approved") {
      throw serviceError("FORBIDDEN", "Sellers can only set status to 'sold' or 'approved'");
    }
  }

  return Car.updateStatus(id, status);
};

const remove = async (id, actor) => {
  const current = await Car.findOwner(id);
  if (!current) throw serviceError("NOT_FOUND", "Car not found");
  if (actor.role !== "admin" && String(current.owner_id) !== String(actor.id)) {
    throw serviceError("FORBIDDEN", "You may only delete your own car listings");
  }
  const images = await CarImage.findImagesByCarId(id);
  for (const image of images) {
    if (image.public_id) {
      try {
        await StorageService.deleteImage(image.public_id);
      } catch (error) {
        const deleteError = serviceError(
          "UPLOAD_FAILED",
          "Car images could not be deleted from storage; the listing was kept"
        );
        deleteError.status = 502;
        throw deleteError;
      }
    }
  }
  const removed = await Car.remove(id, actor.id, actor.role === "admin");
  if (!removed) throw serviceError("FORBIDDEN", "You may only delete your own car listings");
};

const getStats = async (actor) => {
  if (actor.role !== "admin") {
    throw serviceError("FORBIDDEN", "Only administrators can view system stats");
  }
  return Car.getStats();
};

module.exports = {
  list,
  getById,
  create,
  update,
  updateStatus,
  remove,
  uploadImages,
  setPrimaryImage,
  deleteImage,
  getStats,
};
