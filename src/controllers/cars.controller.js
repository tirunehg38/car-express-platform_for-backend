const CarsService = require("../services/cars.service");

const list = async (req, res) => {
  const data = await CarsService.list(req.query, req.user || null);
  return res.status(200).json({
    success: true,
    message: "Cars retrieved successfully",
    data,
  });
};

const getById = async (req, res) => {
  const car = await CarsService.getById(req.params.id, req.user || null);
  return res.status(200).json({
    success: true,
    message: "Car retrieved successfully",
    data: car,
  });
};

const create = async (req, res) => {
  const car = await CarsService.create(req.body, req.user);
  return res.status(201).json({
    success: true,
    message: "Car created successfully",
    data: car,
  });
};

const update = async (req, res) => {
  const car = await CarsService.update(req.params.id, req.body, req.user);
  return res.status(200).json({
    success: true,
    message: "Car updated successfully",
    data: car,
  });
};

const remove = async (req, res) => {
  await CarsService.remove(req.params.id, req.user);
  return res.status(200).json({
    success: true,
    message: "Car deleted successfully",
    data: null,
  });
};

const uploadImages = async (req, res) => {
  const images = await CarsService.uploadImages(
    req.params.id,
    req.files,
    req.user,
    req.body
  );
  return res.status(201).json({
    success: true,
    message: "Car images uploaded successfully",
    data: images,
  });
};

const setPrimaryImage = async (req, res) => {
  const image = await CarsService.setPrimaryImage(
    req.params.carId,
    req.params.imageId,
    req.user
  );
  return res.status(200).json({
    success: true,
    message: "Primary car image updated successfully",
    data: image,
  });
};

const deleteImage = async (req, res) => {
  const image = await CarsService.deleteImage(
    req.params.carId,
    req.params.imageId,
    req.user
  );
  return res.status(200).json({
    success: true,
    message: "Car image deleted successfully",
    data: image,
  });
};

const updateStatus = async (req, res) => {
  const car = await CarsService.updateStatus(
    req.params.id,
    req.body.status,
    req.user
  );
  return res.status(200).json({
    success: true,
    message: "Car status updated successfully",
    data: car,
  });
};

const getStats = async (req, res) => {
  const stats = await CarsService.getStats(req.user);
  return res.status(200).json({
    success: true,
    message: "System stats retrieved successfully",
    data: stats,
  });
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
