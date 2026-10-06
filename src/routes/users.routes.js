const express = require("express");
const controller = require("../controllers/users.controller");
const {
  authenticate,
  requireAdmin,
  requireOwnerOrAdmin,
} = require("../middleware/auth.middleware");
const {
  requireBody,
  validateId,
} = require("../middleware/validate.middleware");

const router = express.Router();

router.get("/", authenticate, requireAdmin, controller.list);
router.get(
  "/:id",
  authenticate,
  validateId(),
  requireOwnerOrAdmin(),
  controller.getById
);
router.put(
  "/:id",
  authenticate,
  validateId(),
  requireOwnerOrAdmin(),
  requireBody,
  controller.update
);
router.delete(
  "/:id",
  authenticate,
  validateId(),
  requireOwnerOrAdmin(),
  controller.remove
);

module.exports = router;