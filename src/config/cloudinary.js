require("./config");
const cloudinary = require("cloudinary").v2;

const sanitize = (value) => {
  if (!value) return "";
  return String(value).trim().replace(/^[<@]+|[>]+$/g, "");
};

if (process.env.CLOUDINARY_URL) {
  process.env.CLOUDINARY_URL = process.env.CLOUDINARY_URL.replace(/<|>/g, "").trim();
}

cloudinary.config();

const explicitCredentials = Object.fromEntries(
  [
    ["cloud_name", sanitize(process.env.CLOUDINARY_CLOUD_NAME)],
    ["api_key", sanitize(process.env.CLOUDINARY_API_KEY)],
    ["api_secret", sanitize(process.env.CLOUDINARY_API_SECRET)],
  ].filter(([, value]) => Boolean(value))
);

if (Object.keys(explicitCredentials).length) {
  cloudinary.config(explicitCredentials);
}

module.exports = cloudinary;
