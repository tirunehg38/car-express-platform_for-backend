const BrandsService = require("../services/brands.service");

const list = async (req, res) => {
  const brands = await BrandsService.list();
  return res.status(200).json({
    success: true,
    message: "Brands retrieved successfully",
    data: brands,
  });
};

const getById = async (req, res) => {
  const brand = await BrandsService.getById(req.params.id);
  return res.status(200).json({
    success: true,
    message: "Brand retrieved successfully",
    data: brand,
  });
};

const create = async (req, res) => {
  const brand = await BrandsService.create(req.body);
  return res.status(201).json({
    success: true,
    message: "Brand created successfully",
    data: brand,
  });
};

const update = async (req, res) => {
  const brand = await BrandsService.update(req.params.id, req.body);
  return res.status(200).json({
    success: true,
    message: "Brand updated successfully",
    data: brand,
  });
};

const remove = async (req, res) => {
  await BrandsService.remove(req.params.id);
  return res.status(200).json({
    success: true,
    message: "Brand deleted successfully",
    data: null,
  });
};

module.exports = { list, getById, create, update, remove };
