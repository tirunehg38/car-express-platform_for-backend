const FavoritesService = require("../services/favorites.service");

const list = async (req, res) => {
  const favorites = await FavoritesService.list(req.user.id);
  return res.status(200).json({
    success: true,
    message: "Favorites retrieved successfully",
    data: favorites,
  });
};

const add = async (req, res) => {
  const favorite = await FavoritesService.add(req.user.id, req.params.carId);
  return res.status(201).json({
    success: true,
    message: "Car added to favorites",
    data: favorite,
  });
};

const remove = async (req, res) => {
  await FavoritesService.remove(req.user.id, req.params.carId);
  return res.status(200).json({
    success: true,
    message: "Favorite removed successfully",
    data: null,
  });
};

module.exports = { list, add, remove };
