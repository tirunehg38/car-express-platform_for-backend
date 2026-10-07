const pool = require("../config/db");

const inquirySelect = `
  SELECT i.id, i.user_id, i.car_id, i.type, i.name, i.email, i.phone, i.message, i.status,
         i.email_sent, i.email_sent_at, i.email_error, i.created_at, i.updated_at,
         c.model AS car_model, c.year AS car_year, c.price AS car_price, c.owner_id AS seller_id,
         u.name AS seller_name, u.email AS seller_email, u.phone AS seller_phone,
         b.name AS brand_name,
         (
           SELECT image_url FROM car_images ci
           WHERE ci.car_id = c.id
           ORDER BY ci.is_primary DESC, ci.sort_order, ci.id
           LIMIT 1
         ) AS car_image
  FROM inquiries i
  LEFT JOIN cars c ON c.id = i.car_id
  LEFT JOIN users u ON u.id = c.owner_id
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
    `INSERT INTO inquiries (user_id, car_id, type, name, email, phone, message, status, email_sent, email_sent_at, email_error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, user_id, car_id, type, name, email, phone, message, status, email_sent, email_sent_at, email_error, created_at, updated_at`,
    [
      inquiry.user_id || null,
      inquiry.car_id || null,
      inquiry.type || "contact",
      inquiry.name,
      inquiry.email,
      inquiry.phone || null,
      inquiry.message,
      inquiry.status || "new",
      Boolean(inquiry.email_sent),
      inquiry.email_sent_at || null,
      inquiry.email_error || null,
    ]
  );
  return findById(result.rows[0].id);
};

const updateEmailDelivery = async (id, { email_sent, email_sent_at, email_error }) => {
  const result = await pool.query(
    `UPDATE inquiries
     SET email_sent = $1, email_sent_at = $2, email_error = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, email_sent, email_sent_at, email_error, updated_at`,
    [Boolean(email_sent), email_sent_at || null, email_error || null, id]
  );
  return result.rows[0] || null;
};

const update = async (id, fields, userId, isAdmin, isSeller = false) => {
  const values = [];
  const assignments = [];
  const columns = {
    name: "name",
    email: "email",
    phone: "phone",
    message: "message",
    status: "status",
  };
  for (const [field, value] of Object.entries(fields)) {
    if (columns[field]) {
      values.push(value);
      assignments.push(`${columns[field]} = $${values.length}`);
    }
  }
  assignments.push("updated_at = NOW()");
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
    "UPDATE inquiries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
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

module.exports = {
  list,
  findById,
  create,
  update,
  updateStatus,
  updateEmailDelivery,
  remove,
};
