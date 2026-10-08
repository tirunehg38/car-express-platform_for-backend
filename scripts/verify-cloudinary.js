require("../src/config/config");
const cloudinary = require("../src/config/cloudinary");
const CloudinaryService = require("../src/services/cloudinary.service");

console.log("=== Cloudinary Configuration Verification ===");

const cConfig = cloudinary.config();
console.log("Cloud Name:", cConfig.cloud_name ? `Configured (${cConfig.cloud_name})` : "MISSING");
console.log("API Key:", cConfig.api_key ? `Configured (ends with ...${String(cConfig.api_key).slice(-4)})` : "MISSING");
console.log("API Secret:", cConfig.api_secret ? "Configured (hidden)" : "MISSING");
console.log("Secure HTTPS URLs enabled:", Boolean(cConfig.secure));
console.log("Is Configured (Service check):", CloudinaryService.isConfigured());

if (!CloudinaryService.isConfigured()) {
  console.log("\n❌ Cloudinary is NOT properly configured.");
  console.log("Ensure the following environment variables are set in Render / .env:");
  console.log("  - CLOUDINARY_CLOUD_NAME");
  console.log("  - CLOUDINARY_API_KEY");
  console.log("  - CLOUDINARY_API_SECRET");
  console.log("  (or CLOUDINARY_URL)");
  process.exit(1);
} else {
  console.log("\n✅ Cloudinary configuration is detected and valid.");
}
