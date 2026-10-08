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
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) in your environment variables (Render Dashboard / .env)."
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
          console.error("Cloudinary upload_stream error details:", error);
          const rawMsg =
            error?.message ||
            error?.error?.message ||
            (typeof error === "string" ? error : "") ||
            JSON.stringify(error);

          let message = `Cloudinary upload failed: ${rawMsg}`;
          if (/permission|forbidden|action|not permitted|create/i.test(rawMsg)) {
            message = `Cloudinary permission denied (${rawMsg}): The API key is missing 'create' (upload) permission. In Cloudinary Console -> Settings -> Access Keys, grant 'Upload' permission to this Access Key or use the Master API key.`;
          } else if (/invalid|unauthorized|authentication|signature|api[_\s-]?key|secret|credentials/i.test(rawMsg)) {
            message = `Cloudinary authentication failed (${rawMsg}): Please check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your Render environment variables.`;
          } else if (/econnrefused|etimedout|enotfound|network|timeout/i.test(rawMsg)) {
            message = `Cloudinary network error (${rawMsg}): Could not reach Cloudinary. Check network connection or outbound access.`;
          }

          const uploadError = serviceError("CLOUDINARY_UPLOAD_REJECTED", message);
          uploadError.status = error?.http_code || error?.error?.http_code || 502;
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
