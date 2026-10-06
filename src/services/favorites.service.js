const Favorite = require("../models/favorite.model");
const Car = require("../models/car.model");
const serviceError = require("../utils/serviceError");

const list = async (userId) => Favorite.listByUser(userId);

const add = async (userId, carId) => {
  if (!(await Car.findApprovedById(carId))) {
    throw serviceError("NOT_FOUND", "Approved car not found");
  }
  const favorite = await Favorite.add(userId, carId);
  if (!favorite) throw serviceError("CONFLICT", "Car is already in favorites");
  return favorite;
};

const remove = async (userId, carId) => {
  const favorite = await Favorite.remove(userId, carId);
  if (!favorite) throw serviceError("NOT_FOUND", "Favorite not found");
};

module.exports = { list, add, remove };
