const cloudinary = require("../config/cloudinary");
const serviceError = require("../utils/serviceError");

const isPlaceholder = (value) => {
  let decoded = String(value ?? "").trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return true;
  }
  return !decoded ||
    /<[^>]*>|your_|actual_|placeholder|example/i.test(decoded);
};

const isConfigured = () => {
  const config = cloudinary.config();
  return (
    Boolean(config.cloud_name && config.api_key && config.api_secret) &&
    !isPlaceholder(config.cloud_name) &&
    !isPlaceholder(config.api_key) &&
    !isPlaceholder(config.api_secret)
  );
};

const assertConfigured = () => {
  if (!isConfigured()) {
    const error = serviceError(
      "CLOUDINARY_NOT_CONFIGURED",
      "Set valid Cloudinary cloud name, API key, and API secret in backend/.env, then restart the backend"
    );
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
        if (error) {
          const rawMsg = error.message || "";
          let message = "Cloudinary could not store the image; verify the Cloudinary account and network connection";
          if (/permission|forbidden|action|create/i.test(rawMsg)) {
            message = "Cloudinary rejected upload: The API key is missing 'create' (upload) permission. Grant 'create' permission to this Access Key in the Cloudinary Console or use the Master API key.";
          } else if (/invalid api_key|unauthorized|authentication/i.test(rawMsg)) {
            message = "Cloudinary rejected the configured credentials; verify the API key and secret in backend/.env";
          }
          const uploadError = serviceError("CLOUDINARY_UPLOAD_REJECTED", message);
          uploadError.status = 502;
          return reject(uploadError);
        }
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

module.exports = { isConfigured, uploadImage, deleteImage };
