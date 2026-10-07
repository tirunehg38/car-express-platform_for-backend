const express = require("express");
const controller = require("../controllers/inquiries.controller");
const {
  authenticate,
  optionalAuthenticate,
} = require("../middleware/auth.middleware");
const {
  requireBody,
  validateId,
} = require("../middleware/validate.middleware");
const { inquiryRateLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.get("/", authenticate, controller.list);
router.get("/:id", authenticate, validateId(), controller.getById);
router.post(
  "/",
  inquiryRateLimiter(),
  optionalAuthenticate,
  requireBody,
  controller.create
);
router.patch("/:id/status", authenticate, validateId(), requireBody, controller.updateStatus);
router.put("/:id/status", authenticate, validateId(), requireBody, controller.updateStatus);
router.put("/:id", authenticate, validateId(), requireBody, controller.update);
router.delete("/:id", authenticate, validateId(), controller.remove);

module.exports = router;