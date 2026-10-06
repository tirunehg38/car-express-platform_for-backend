const express = require("express");
const controller = require("../controllers/favorites.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validateId } = require("../middleware/validate.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", controller.list);
router.post("/:carId", validateId("carId"), controller.add);
router.delete("/:carId", validateId("carId"), controller.remove);

module.exports = router;