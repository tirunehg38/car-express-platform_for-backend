require("../src/config/config");
const cloudinary = require("../src/config/cloudinary");
const CloudinaryService = require("../src/services/cloudinary.service");

async function main() {
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
  }

  console.log("\nTesting Cloudinary API connectivity and credentials with ping...");
  try {
    const res = await cloudinary.api.ping();
    console.log("✅ Cloudinary API ping successful! Status:", res.status || "ok");
  } catch (err) {
    console.error("❌ Cloudinary API ping failed:");
    console.error("   Error Message:", err.message || err.error?.message || err);
    console.error("   HTTP Code:", err.http_code || err.error?.http_code || "N/A");
    if (err.http_code === 401 || /invalid|unauthorized/i.test(err.message)) {
      console.error("\n👉 This means your CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET is incorrect.");
      console.error("   Please verify them in Cloudinary Console -> Settings -> Access Keys.");
    } else if (err.http_code === 403 || /forbidden|permission|not permitted/i.test(err.message)) {
      console.error("\n👉 This means your API Key lacks permission.");
      console.error("   In Cloudinary Console, grant 'Upload' permission to this Access Key or use the Master API Key.");
    }
  }
}

main();
