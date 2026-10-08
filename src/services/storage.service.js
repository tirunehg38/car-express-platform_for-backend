const path = require("path");
const fs = require("fs");
const CloudinaryService = require("./cloudinary.service");

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads/cars");

const ensureUploadsDir = async () => {
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
};

const getExtension = (originalname, mimetype) => {
  const extFromName = path.extname(originalname || "").toLowerCase();
  if (extFromName && /^\.(jpe?g|png|webp|gif|svg|avif)$/.test(extFromName)) {
    return extFromName;
  }
  const mimeMap = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
  };
  return mimeMap[mimetype] || ".jpg";
};

const saveLocalImage = async (file) => {
  await ensureUploadsDir();
  const ext = getExtension(file.originalname, file.mimetype);
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const filename = `${Date.now()}-${randomSuffix}${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.promises.writeFile(filePath, file.buffer);

  return {
    secure_url: `/uploads/cars/${filename}`,
    public_id: `local:cars/${filename}`,
  };
};

/**
 * Upload an image directly to Cloudinary.
 * Does not fall back to ephemeral local disk so uploaded car images are preserved.
 */
const uploadImage = async (file) => {
  return await CloudinaryService.uploadImage(file.buffer);
};

const deleteImage = async (publicId) => {
  if (!publicId) return;

  if (publicId.startsWith("local:")) {
    const relPath = publicId.replace(/^local:/, "");
    const fullPath = path.resolve(__dirname, "../../uploads", relPath);
    try {
      await fs.promises.unlink(fullPath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("Failed to delete local file:", fullPath, err.message);
      }
    }
    return;
  }

  if (CloudinaryService.isConfigured()) {
    return await CloudinaryService.deleteImage(publicId);
  }
};

const cleanupImages = async (images = []) => {
  await Promise.allSettled(
    images.map((image) => deleteImage(image.public_id))
  );
};

module.exports = {
  uploadImage,
  deleteImage,
  cleanupImages,
  saveLocalImage,
};
