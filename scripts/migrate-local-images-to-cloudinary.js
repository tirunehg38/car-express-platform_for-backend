const fs = require("fs");
const path = require("path");
const pool = require("../src/config/db");
const CloudinaryService = require("../src/services/cloudinary.service");

async function migrateImages() {
  console.log("=== Car Express Ethiopia: Local Images to Cloudinary Migration ===");

  if (!CloudinaryService.isConfigured()) {
    console.error(
      "ERROR: Cloudinary is not configured. Please ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set."
    );
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const { rows: localImages } = await client.query(
      `SELECT id, car_id, image_url, public_id
       FROM car_images
       WHERE public_id LIKE 'local:%' OR image_url LIKE '/uploads/%'
       ORDER BY car_id, id`
    );

    console.log(`Found ${localImages.length} locally stored images in the database.`);

    if (!localImages.length) {
      console.log("No local images need migration.");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const image of localImages) {
      const filename = path.basename(image.image_url);
      const localFilePath = path.resolve(__dirname, "../uploads/cars", filename);

      if (!fs.existsSync(localFilePath)) {
        console.warn(`[SKIP] Image ID ${image.id} (Car ${image.car_id}): Local file not found on disk at ${localFilePath}`);
        failCount++;
        continue;
      }

      try {
        console.log(`[UPLOADING] Image ID ${image.id} (${filename})...`);
        const buffer = await fs.promises.readFile(localFilePath);
        const result = await CloudinaryService.uploadImage(buffer);

        await client.query(
          `UPDATE car_images
           SET image_url = $1, public_id = $2
           WHERE id = $3`,
          [result.secure_url, result.public_id, image.id]
        );

        console.log(`[SUCCESS] Image ID ${image.id} migrated -> ${result.secure_url}`);
        successCount++;
      } catch (err) {
        console.error(`[FAILED] Image ID ${image.id}: ${err.message}`);
        failCount++;
      }
    }

    console.log("\nMigration completed:");
    console.log(`- Successfully migrated to Cloudinary: ${successCount}`);
    console.log(`- Failed / Skipped: ${failCount}`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateImages().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
