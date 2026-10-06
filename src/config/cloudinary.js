const cloudinary = require("cloudinary").v2;
require("./config");

cloudinary.config();

const explicitCredentials = Object.fromEntries(
  [
    ["cloud_name", process.env.CLOUDINARY_CLOUD_NAME],
    ["api_key", process.env.CLOUDINARY_API_KEY],
    ["api_secret", process.env.CLOUDINARY_API_SECRET],
  ].filter(([, value]) => value)
);

if (Object.keys(explicitCredentials).length) {
  cloudinary.config(explicitCredentials);
}

module.exports = cloudinary;
