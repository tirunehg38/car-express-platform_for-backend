const AuthService = require("../services/auth.service");

const register = async (req, res) => {
  const data = await AuthService.register(req.body);
  return res.status(201).json({
    success: true,
    message: "Account created successfully",
    data,
  });
};

const login = async (req, res) => {
  const data = await AuthService.login(req.body);
  return res.status(200).json({
    success: true,
    message: "Login successful",
    data,
  });
};

const me = async (req, res) => {
  const user = await AuthService.getCurrentUser(req.user.id);
  return res.status(200).json({
    success: true,
    message: "Current user retrieved successfully",
    data: user,
  });
};

module.exports = { register, login, me };
