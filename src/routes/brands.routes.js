const express = require("express");
const controller = require("../controllers/brands.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");
const { requireBody, validateId } = require("../middleware/validate.middleware");

const router = express.Router();

router.get("/", controller.list);
router.get("/:id", validateId(), controller.getById);
router.post("/", authenticate, requireAdmin, requireBody, controller.create);
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  validateId(),
  requireBody,
  controller.update
);
router.delete("/:id", authenticate, requireAdmin, validateId(), controller.remove);

module.exports = router;
