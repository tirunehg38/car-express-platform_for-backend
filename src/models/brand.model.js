const pool = require("../config/db");

const list = async () => {
  const result = await pool.query(
    "SELECT id, name FROM brands ORDER BY name ASC"
  );
  return result.rows;
};

const findById = async (id) => {
  const result = await pool.query(
    "SELECT id, name FROM brands WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
};

const create = async (name) => {
  const result = await pool.query(
    "INSERT INTO brands (name) VALUES ($1) RETURNING id, name",
    [name]
  );
  return result.rows[0];
};

const update = async (id, name) => {
  const result = await pool.query(
    "UPDATE brands SET name = $1 WHERE id = $2 RETURNING id, name",
    [name, id]
  );
  return result.rows[0] || null;
};

const remove = async (id) => {
  const result = await pool.query(
    "DELETE FROM brands WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rows[0] || null;
};

module.exports = { list, findById, create, update, remove };