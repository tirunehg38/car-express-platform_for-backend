const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      const error = new Error("Only image files are allowed");
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

module.exports = upload;
