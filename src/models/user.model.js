const pool = require("../config/db");

const publicColumns =
  "id, name, email, phone, avatar_url, role, created_at, updated_at";

const findByEmail = async (email) => {
  const result = await pool.query(
    `SELECT id, name, email, password_hash, phone, avatar_url, role, created_at, updated_at
     FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
};

const findById = async (id) => {
  const result = await pool.query(
    `SELECT ${publicColumns} FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findAuthUser = async (id) => {
  const result = await pool.query(
    `SELECT id, name, email, role FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findByIdWithPassword = async (id) => {
  const result = await pool.query(
    `SELECT id, name, email, password_hash, phone, avatar_url, role, created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const list = async ({ limit, offset }) => {
  const [users, count] = await Promise.all([
    pool.query(
      `SELECT ${publicColumns} FROM users ORDER BY id ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM users"),
  ]);
  return { items: users.rows, total: count.rows[0].total };
};

const create = async ({ name, email, passwordHash, phone }) => {
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, phone, role)
     VALUES ($1, $2, $3, $4, 'buyer')
     RETURNING ${publicColumns}`,
    [name, email, passwordHash, phone || null]
  );
  return result.rows[0];
};

const update = async (id, fields) => {
  const columns = {
    name: "name",
    email: "email",
    phone: "phone",
    avatar_url: "avatar_url",
    role: "role",
  };
  const values = [];
  const assignments = [];
  for (const [field, value] of Object.entries(fields)) {
    values.push(value);
    assignments.push(`${columns[field]} = $${values.length}`);
  }
  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${assignments.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING ${publicColumns}`,
    values
  );
  return result.rows[0] || null;
};

const remove = async (id) => {
  const result = await pool.query("DELETE FROM users WHERE id = $1", [id]);
  return result.rowCount > 0;
};

module.exports = {
  findByEmail,
  findById,
  findByIdWithPassword,
  findAuthUser,
  list,
  create,
  update,
  remove,
};
