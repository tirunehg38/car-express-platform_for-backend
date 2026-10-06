const express = require("express");
const controller = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireBody } = require("../middleware/validate.middleware");

const router = express.Router();

router.post("/register", requireBody, controller.register);
router.post("/login", requireBody, controller.login);
router.get("/me", authenticate, controller.me);

module.exports = router;