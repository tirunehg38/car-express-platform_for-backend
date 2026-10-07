const multer = require("multer");

const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  let status = Number(error.status || error.statusCode) || 500;
  let message = error.message || "An unexpected error occurred";

  const serviceStatuses = {
    VALIDATION_ERROR: 400,
    AUTHENTICATION_FAILED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UPLOAD_FAILED: 502,
    CLOUDINARY_NOT_CONFIGURED: 503,
    CLOUDINARY_UPLOAD_REJECTED: 502,
    IMAGE_SYNC_FAILED: 503,
  };
  if (serviceStatuses[error.code]) {
    status = serviceStatuses[error.code];
  } else if (error instanceof multer.MulterError) {
    status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = error.code === "LIMIT_FILE_SIZE"
      ? "Each image must be no larger than 10 MB"
      : error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE"
        ? "Upload at most 10 images using the 'images' field"
        : "Image upload request is invalid";
  } else if (error.type === "entity.parse.failed") {
    status = 400;
    message = "Request body contains invalid JSON";
  } else if (error.code === "23505") {
    status = 409;
    message = "A record with the provided unique value already exists";
  } else if (
    error.code === "23503" ||
    error.code === "23514" ||
    error.code === "22P02" ||
    error.code === "22003"
  ) {
    status = 400;
    message = "Request contains a value that is not valid for this resource";
  } else if (error.code === "23502") {
    status = 400;
    message = "A required value is missing";
  }

  if (status < 400 || status > 599) status = 500;
  if (status === 500) {
    console.error("Request failed:", error);
    message = "Internal server error";
  }

  return res.status(status).json({
    success: false,
    message,
    data: null,
  });
};

module.exports = errorMiddleware;