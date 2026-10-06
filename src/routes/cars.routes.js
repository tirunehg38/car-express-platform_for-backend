const express = require("express");
const controller = require("../controllers/cars.controller");
const {
  authenticate,
  optionalAuthenticate,
} = require("../middleware/auth.middleware");
const {
  requireBody,
  validateId,
} = require("../middleware/validate.middleware");
const upload = require("../middleware/upload.middleware");

const router = express.Router();

router.get("/", optionalAuthenticate, controller.list);
router.get("/stats", authenticate, controller.getStats);
router.get("/:id", optionalAuthenticate, validateId(), controller.getById);
router.post("/", authenticate, requireBody, controller.create);
router.post(
  "/:id/images",
  authenticate,
  validateId(),
  upload.array("images", 10),
  controller.uploadImages
);
router.put(
  "/:carId/images/:imageId/primary",
  authenticate,
  validateId("carId"),
  validateId("imageId"),
  controller.setPrimaryImage
);
router.delete(
  "/:carId/images/:imageId",
  authenticate,
  validateId("carId"),
  validateId("imageId"),
  controller.deleteImage
);
router.patch("/:id/status", authenticate, validateId(), requireBody, controller.updateStatus);
router.put("/:id/status", authenticate, validateId(), requireBody, controller.updateStatus);
router.put("/:id", authenticate, validateId(), requireBody, controller.update);
router.delete("/:id", authenticate, validateId(), controller.remove);

module.exports = router;