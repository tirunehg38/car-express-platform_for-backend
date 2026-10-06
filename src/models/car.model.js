const pool = require("../config/db");

const publicSelect = `
  SELECT c.id, c.owner_id, u.name AS seller_name, u.avatar_url AS seller_avatar_url,
         c.brand_id, b.name AS brand_name, c.model,
         c.year, c.price, c.mileage, c.vehicle_condition, c.fuel_type,
         c.transmission, c.body_type, c.engine_size, c.color, c.city, c.area,
         c.description, c.features, c.status, c.created_at, c.updated_at,
         COALESCE(
           json_agg(json_build_object('id', ci.id, 'image_url', ci.image_url,
                                     'sort_order', ci.sort_order, 'is_primary', ci.is_primary)
                    ORDER BY ci.is_primary DESC, ci.sort_order, ci.id)
             FILTER (WHERE ci.id IS NOT NULL),
           '[]'::json
         ) AS images
  FROM cars c
  JOIN brands b ON b.id = c.brand_id
  LEFT JOIN users u ON u.id = c.owner_id
  LEFT JOIN car_images ci ON ci.car_id = c.id`;

const findById = async (id, includeHidden = false) => {
  const result = await pool.query(
    `${publicSelect}
     WHERE c.id = $1 ${includeHidden ? "" : "AND c.status = 'approved'"}
     GROUP BY c.id, b.id, u.id`,
    [id]
  );
  return result.rows[0] || null;
};

const findAll = async ({
  status = "approved",
  owner_id,
  brand_id,
  year,
  fuel_type,
  transmission,
  vehicle_condition,
  city,
  q,
  min_price,
  max_price,
  limit,
  offset,
  sort = "created_at",
  order = "DESC",
}) => {
  const sortColumns = {
    created_at: "c.created_at",
    price: "c.price",
    year: "c.year",
  };
  const effectiveStatus = status === "all" || status === null ? undefined : status;
  const filters = { status: effectiveStatus, owner_id, brand_id, year, fuel_type, transmission, vehicle_condition };
  const conditions = [];
  const values = [];
  for (const [column, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    values.push(value);
    conditions.push(`c.${column} = $${values.length}`);
  }
  if (city !== undefined) {
    values.push(`%${city}%`);
    conditions.push(`c.city ILIKE $${values.length}`);
  }
  if (q !== undefined) {
    values.push(`%${q}%`);
    const placeholder = `$${values.length}`;
    conditions.push(
      `(c.model ILIKE ${placeholder} OR b.name ILIKE ${placeholder} OR c.city ILIKE ${placeholder})`
    );
  }
  if (min_price !== undefined) {
    values.push(min_price);
    conditions.push(`c.price >= $${values.length}`);
  }
  if (max_price !== undefined) {
    values.push(max_price);
    conditions.push(`c.price <= $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = sortColumns[sort] || sortColumns.created_at;
  const direction = order === "ASC" ? "ASC" : "DESC";
  const [cars, count] = await Promise.all([
    pool.query(
      `${publicSelect} ${where}
       GROUP BY c.id, b.id, u.id
       ORDER BY ${orderBy} ${direction}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM cars c JOIN brands b ON b.id = c.brand_id ${where}`,
      values
    ),
  ]);
  return { items: cars.rows, total: count.rows[0].total };
};

const create = async (car) => {
  const columns = [
    "owner_id", "brand_id", "model", "year", "price", "mileage",
    "vehicle_condition", "fuel_type", "transmission", "body_type",
    "engine_size", "color", "city", "area", "description", "features", "status",
  ];
  const values = columns.map((column) => car[column] ?? null);
  const result = await pool.query(
    `INSERT INTO cars (${columns.join(", ")})
     VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")})
     RETURNING id`,
    values
  );
  return findById(result.rows[0].id, true);
};

const update = async (id, fields, ownerId = undefined, admin = false) => {
  const columns = {
    owner_id: "owner_id",
    brand_id: "brand_id",
    model: "model",
    year: "year",
    price: "price",
    mileage: "mileage",
    vehicle_condition: "vehicle_condition",
    fuel_type: "fuel_type",
    transmission: "transmission",
    body_type: "body_type",
    engine_size: "engine_size",
    color: "color",
    city: "city",
    area: "area",
    description: "description",
    features: "features",
    status: "status",
  };
  const values = [];
  const assignments = [];
  for (const [field, value] of Object.entries(fields)) {
    values.push(value);
    assignments.push(`${columns[field]} = $${values.length}`);
  }
  values.push(id);
  const ownership = admin ? "" : ` AND owner_id = $${values.length + 1}`;
  if (!admin) values.push(ownerId);
  const result = await pool.query(
    `UPDATE cars SET ${assignments.join(", ")}, updated_at = NOW()
     WHERE id = $${admin ? values.length : values.length - 1}${ownership} RETURNING id`,
    values
  );
  return result.rowCount ? findById(id, true) : null;
};

const remove = async (id, ownerId = undefined, admin = false) => {
  const values = [id];
  const ownership = admin ? "" : " AND owner_id = $2";
  if (!admin) values.push(ownerId);
  const result = await pool.query(
    `DELETE FROM cars WHERE id = $1${ownership} RETURNING id`,
    values
  );
  return result.rows[0] || null;
};

const findOwner = async (id) => {
  const result = await pool.query(
    "SELECT id, owner_id FROM cars WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
};

const findApprovedById = async (id) => {
  const result = await pool.query(
    "SELECT id FROM cars WHERE id = $1 AND status = 'approved'",
    [id]
  );
  return result.rows[0] || null;
};

const findExistingById = async (id) => {
  const result = await pool.query("SELECT id FROM cars WHERE id = $1", [id]);
  return result.rows[0] || null;
};

const updateStatus = async (id, status) => {
  const result = await pool.query(
    "UPDATE cars SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status",
    [status, id]
  );
  return result.rowCount ? findById(id, true) : null;
};

const getStats = async () => {
  const [cars, inquiries, users] = await Promise.all([
    pool.query(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'sold')::int AS sold
      FROM cars
    `),
    pool.query(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
        COUNT(*) FILTER (WHERE status = 'read')::int AS read_count,
        COUNT(*) FILTER (WHERE status = 'replied')::int AS replied,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
      FROM inquiries
    `),
    pool.query(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE role = 'buyer')::int AS buyers,
        COUNT(*) FILTER (WHERE role = 'seller')::int AS sellers,
        COUNT(*) FILTER (WHERE role = 'admin')::int AS admins
      FROM users
    `),
  ]);

  return {
    cars: cars.rows[0],
    inquiries: inquiries.rows[0],
    users: users.rows[0],
  };
};

module.exports = {
  publicSelect,
  findById,
  findAll,
  create,
  update,
  updateStatus,
  remove,
  findOwner,
  findApprovedById,
  findExistingById,
  getStats,
};