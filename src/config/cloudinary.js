const config = require("./config");
const cloudinary = require("cloudinary").v2;

const sanitize = (value) => {
  if (!value) return "";
  return String(value).trim().replace(/^["'<@]+|["'>]+$/g, "").trim();
};

// Always enforce secure (HTTPS) URLs
cloudinary.config({ secure: true });

const cloudName = sanitize(config.cloudinary?.cloudName || process.env.CLOUDINARY_CLOUD_NAME);
const apiKey = sanitize(config.cloudinary?.apiKey || process.env.CLOUDINARY_API_KEY);
const apiSecret = sanitize(config.cloudinary?.apiSecret || process.env.CLOUDINARY_API_SECRET);
const cloudinaryUrl = sanitize(config.cloudinary?.url || process.env.CLOUDINARY_URL || "");

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
} else if (cloudinaryUrl) {
  const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/);
  if (match) {
    cloudinary.config({
      api_key: match[1],
      api_secret: match[2],
      cloud_name: match[3],
      secure: true,
    });
  } else {
    process.env.CLOUDINARY_URL = cloudinaryUrl;
    cloudinary.config({ secure: true });
  }
}

module.exports = cloudinary;
