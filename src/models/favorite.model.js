const pool = require("../config/db");

const listByUser = async (userId) => {
  const result = await pool.query(
    `SELECT c.id, c.owner_id, c.brand_id, b.name AS brand_name, c.model,
            c.year, c.price, c.mileage, c.vehicle_condition, c.fuel_type,
            c.transmission, c.body_type, c.engine_size, c.color, c.city,
            c.area, c.description, c.features, c.status, c.created_at,
            c.updated_at, f.created_at AS favorited_at,
            COALESCE(
              json_agg(json_build_object('id', ci.id, 'image_url', ci.image_url,
                                        'sort_order', ci.sort_order, 'is_primary', ci.is_primary)
                       ORDER BY ci.is_primary DESC, ci.sort_order, ci.id)
                FILTER (WHERE ci.id IS NOT NULL),
              '[]'::json
            ) AS images
     FROM favorites f
     JOIN cars c ON c.id = f.car_id
     JOIN brands b ON b.id = c.brand_id
     LEFT JOIN car_images ci ON ci.car_id = c.id
     WHERE f.user_id = $1
     GROUP BY f.user_id, f.car_id, f.created_at, c.id, b.id
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return result.rows;
};

const add = async (userId, carId) => {
  const result = await pool.query(
    `INSERT INTO favorites (user_id, car_id)
     VALUES ($1, $2) ON CONFLICT (user_id, car_id) DO NOTHING
     RETURNING user_id, car_id, created_at`,
    [userId, carId]
  );
  return result.rows[0] || null;
};

const remove = async (userId, carId) => {
  const result = await pool.query(
    "DELETE FROM favorites WHERE user_id = $1 AND car_id = $2 RETURNING car_id",
    [userId, carId]
  );
  return result.rows[0] || null;
};

module.exports = { listByUser, add, remove };
