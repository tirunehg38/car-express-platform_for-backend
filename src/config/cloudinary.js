const config = require("./config");
const cloudinary = require("cloudinary").v2;

const sanitize = (value) => {
  if (!value) return "";
  return String(value).trim().replace(/^[<@]+|[>]+$/g, "");
};

// Always enforce secure (HTTPS) URLs
cloudinary.config({ secure: true });

const cloudName = sanitize(config.cloudinary?.cloudName || process.env.CLOUDINARY_CLOUD_NAME);
const apiKey = sanitize(config.cloudinary?.apiKey || process.env.CLOUDINARY_API_KEY);
const apiSecret = sanitize(config.cloudinary?.apiSecret || process.env.CLOUDINARY_API_SECRET);
const cloudinaryUrl = (config.cloudinary?.url || process.env.CLOUDINARY_URL || "").replace(/<|>/g, "").trim();

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
} else if (cloudinaryUrl) {
  process.env.CLOUDINARY_URL = cloudinaryUrl;
  cloudinary.config({ secure: true });
}

module.exports = cloudinary;
