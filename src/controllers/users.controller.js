const UsersService = require("../services/users.service");

const list = async (req, res) => {
  const data = await UsersService.list(req.query);
  return res.status(200).json({
    success: true,
    message: "Users retrieved successfully",
    data,
  });
};

const getById = async (req, res) => {
  const user = await UsersService.getById(req.params.id);
  return res.status(200).json({
    success: true,
    message: "User retrieved successfully",
    data: user,
  });
};

const update = async (req, res) => {
  const user = await UsersService.update(req.params.id, req.body, req.user);
  return res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: user,
  });
};

const remove = async (req, res) => {
  await UsersService.remove(req.params.id);
  return res.status(200).json({
    success: true,
    message: "User deleted successfully",
    data: null,
  });
};

module.exports = { list, getById, update, remove };
