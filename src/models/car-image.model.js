const pool = require("../config/db");

const findImagesByCarId = async (carId) => {
  const result = await pool.query(
    `SELECT id, car_id, image_url, public_id, is_primary, sort_order, created_at
     FROM car_images
     WHERE car_id = $1
     ORDER BY is_primary DESC, sort_order, id`,
    [carId]
  );
  return result.rows;
};

const findImageById = async (carId, imageId) => {
  const result = await pool.query(
    `SELECT id, car_id, image_url, public_id, is_primary, sort_order, created_at
     FROM car_images
     WHERE car_id = $1 AND id = $2`,
    [carId, imageId]
  );
  return result.rows[0] || null;
};

const createCarImages = async (carId, images, { primaryIndex, primaryImageId } = {}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const car = await client.query("SELECT id FROM cars WHERE id = $1 FOR UPDATE", [carId]);
    if (!car.rowCount) {
      const error = new Error("Car not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    const existing = await client.query(
      "SELECT id, is_primary, sort_order FROM car_images WHERE car_id = $1 ORDER BY sort_order, id",
      [carId]
    );
    const hasPrimary = existing.rows.some((image) => image.is_primary);
    if (existing.rowCount + images.length > 10) {
      const error = new Error("A car may have no more than 10 images");
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    if (primaryImageId !== undefined) {
      const selected = existing.rows.find((image) => String(image.id) === String(primaryImageId));
      if (!selected) {
        const error = new Error("The selected primary image does not belong to this car");
        error.code = "VALIDATION_ERROR";
        throw error;
      }
      await client.query("UPDATE car_images SET is_primary = FALSE WHERE car_id = $1", [carId]);
      await client.query("UPDATE car_images SET is_primary = TRUE WHERE car_id = $1 AND id = $2", [
        carId,
        primaryImageId,
      ]);
    } else if (primaryIndex !== undefined || !hasPrimary) {
      await client.query("UPDATE car_images SET is_primary = FALSE WHERE car_id = $1", [carId]);
    }

    const nextOrder = existing.rows.reduce(
      (highest, image) => Math.max(highest, image.sort_order),
      -1
    ) + 1;
    const created = [];
    for (const [index, image] of images.entries()) {
      const isPrimary = primaryImageId === undefined
        ? (primaryIndex !== undefined ? index === primaryIndex : !hasPrimary && index === 0)
        : false;
      const result = await client.query(
        `INSERT INTO car_images (car_id, image_url, public_id, is_primary, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, car_id, image_url, public_id, is_primary, sort_order, created_at`,
        [carId, image.secure_url, image.public_id, isPrimary, nextOrder + index]
      );
      created.push(result.rows[0]);
    }
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const setPrimaryCarImage = async (carId, imageId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query(
      "SELECT id FROM car_images WHERE car_id = $1 AND id = $2 FOR UPDATE",
      [carId, imageId]
    );
    if (!selected.rowCount) {
      const error = new Error("Car image not found");
      error.code = "NOT_FOUND";
      throw error;
    }
    await client.query("UPDATE car_images SET is_primary = FALSE WHERE car_id = $1", [carId]);
    const result = await client.query(
      `UPDATE car_images SET is_primary = TRUE
       WHERE car_id = $1 AND id = $2
       RETURNING id, car_id, image_url, public_id, is_primary, sort_order, created_at`,
      [carId, imageId]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteCarImage = async (carId, imageId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query(
      `SELECT id, car_id, image_url, public_id, is_primary, sort_order, created_at
       FROM car_images
       WHERE car_id = $1 AND id = $2
       FOR UPDATE`,
      [carId, imageId]
    );
    if (!selected.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    const image = selected.rows[0];
    await client.query("DELETE FROM car_images WHERE car_id = $1 AND id = $2", [carId, imageId]);
    if (image.is_primary) {
      await client.query(
        `UPDATE car_images SET is_primary = TRUE
         WHERE id = (
           SELECT id FROM car_images
           WHERE car_id = $1
           ORDER BY sort_order, id
           LIMIT 1
         )`,
        [carId]
      );
    }
    await client.query("COMMIT");
    return image;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteImagesByCarId = async (carId) => {
  const result = await pool.query(
    `DELETE FROM car_images
     WHERE car_id = $1
     RETURNING id, car_id, image_url, public_id, is_primary, sort_order`,
    [carId]
  );
  return result.rows;
};

module.exports = {
  findImagesByCarId,
  findImageById,
  createCarImages,
  setPrimaryCarImage,
  deleteCarImage,
  deleteImagesByCarId,
};
