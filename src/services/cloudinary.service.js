const cloudinary = require("../config/cloudinary");
const serviceError = require("../utils/serviceError");

const assertConfigured = () => {
  const config = cloudinary.config();
  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    const error = serviceError("CLOUDINARY_NOT_CONFIGURED", "Image storage is not configured on the server");
    error.status = 503;
    throw error;
  }
};

const uploadImage = (buffer) => {
  assertConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "car-express/cars", resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Cloudinary returned incomplete image metadata"));
        }
        return resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
};

const deleteImage = async (publicId) => {
  assertConfigured();
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
  if (!["ok", "not found"].includes(result?.result)) {
    throw new Error("Cloudinary could not delete the image");
  }
  return result;
};

module.exports = { uploadImage, deleteImage };
