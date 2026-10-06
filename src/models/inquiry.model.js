const pool = require("../config/db");

const inquirySelect = `
  SELECT i.id, i.user_id, i.car_id, i.type, i.name, i.email, i.message, i.status, i.created_at,
         c.model AS car_model, c.year AS car_year, c.price AS car_price, c.owner_id AS seller_id,
         b.name AS brand_name,
         (
           SELECT image_url FROM car_images ci
           WHERE ci.car_id = c.id
           ORDER BY ci.is_primary DESC, ci.sort_order, ci.id
           LIMIT 1
         ) AS car_image
  FROM inquiries i
  LEFT JOIN cars c ON c.id = i.car_id
  LEFT JOIN brands b ON b.id = c.brand_id`;

const list = async ({ userId, isAdmin, scope = "all", status, limit, offset }) => {
  const conditions = [];
  const values = [];

  if (scope === "received") {
    values.push(userId);
    conditions.push(`c.owner_id = $${values.length}`);
  } else if (scope === "sent") {
    values.push(userId);
    conditions.push(`i.user_id = $${values.length}`);
  } else if (!isAdmin) {
    values.push(userId);
    conditions.push(`(c.owner_id = $${values.length} OR i.user_id = $${values.length})`);
  }

  if (status && status !== "all") {
    values.push(status);
    conditions.push(`i.status = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(limit);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;

  const countValues = values.slice(0, values.length - 2);

  const [inquiries, count] = await Promise.all([
    pool.query(
      `${inquirySelect} ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM inquiries i
       LEFT JOIN cars c ON c.id = i.car_id
       ${whereClause}`,
      countValues
    ),
  ]);

  return { items: inquiries.rows, total: count.rows[0].total };
};

const findById = async (id) => {
  const result = await pool.query(
    `${inquirySelect} WHERE i.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const create = async (inquiry) => {
  const result = await pool.query(
    `INSERT INTO inquiries (user_id, car_id, type, name, email, message, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'new')
     RETURNING id, user_id, car_id, type, name, email, message, status, created_at`,
    [
      inquiry.user_id,
      inquiry.car_id,
      inquiry.type,
      inquiry.name,
      inquiry.email,
      inquiry.message,
    ]
  );
  return findById(result.rows[0].id);
};

const update = async (id, fields, userId, isAdmin, isSeller = false) => {
  const values = [];
  const assignments = [];
  const columns = { name: "name", email: "email", message: "message", status: "status" };
  for (const [field, value] of Object.entries(fields)) {
    values.push(value);
    assignments.push(`${columns[field]} = $${values.length}`);
  }
  values.push(id);
  const ownership = isAdmin || isSeller ? "" : ` AND user_id = $${values.length + 1}`;
  if (!isAdmin && !isSeller) values.push(userId);
  const result = await pool.query(
    `UPDATE inquiries SET ${assignments.join(", ")}
     WHERE id = $${isAdmin || isSeller ? values.length : values.length - 1}${ownership}
     RETURNING id`,
    values
  );
  return result.rowCount ? findById(id) : null;
};

const updateStatus = async (id, status) => {
  const result = await pool.query(
    "UPDATE inquiries SET status = $1 WHERE id = $2 RETURNING id",
    [status, id]
  );
  return result.rowCount ? findById(id) : null;
};

const remove = async (id, userId, isAdmin, isSeller = false) => {
  const values = [id];
  let ownership = "";
  if (!isAdmin && !isSeller) {
    values.push(userId);
    ownership = " AND user_id = $2";
  }
  const result = await pool.query(
    `DELETE FROM inquiries WHERE id = $1${ownership} RETURNING id`,
    values
  );
  return result.rows[0] || null;
};

module.exports = { list, findById, create, update, updateStatus, remove };
