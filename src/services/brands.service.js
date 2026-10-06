const Brand = require("../models/brand.model");
const serviceError = require("../utils/serviceError");

const validateName = (name) => {
  if (typeof name !== "string" || !name.trim()) {
    throw serviceError("VALIDATION_ERROR", "A non-empty name is required");
  }
  return name.trim();
};

const list = async () => Brand.list();

const getById = async (id) => {
  const brand = await Brand.findById(id);
  if (!brand) throw serviceError("NOT_FOUND", "Brand not found");
  return brand;
};

const validateInput = (input) => {
  if (
    !input ||
    Object.keys(input).some((field) => field !== "name") ||
    !Object.hasOwn(input, "name")
  ) {
    throw serviceError("VALIDATION_ERROR", "Request must contain only the name field");
  }
  return validateName(input.name);
};

const create = async (input) => Brand.create(validateInput(input));

const update = async (id, input) => {
  const brand = await Brand.update(id, validateInput(input));
  if (!brand) throw serviceError("NOT_FOUND", "Brand not found");
  return brand;
};

const remove = async (id) => {
  try {
    const brand = await Brand.remove(id);
    if (!brand) throw serviceError("NOT_FOUND", "Brand not found");
  } catch (error) {
    if (error.code === "23503") {
      throw serviceError("CONFLICT", "Cannot delete a brand that has car listings");
    }
    throw error;
  }
};

module.exports = { list, getById, create, update, remove };
