const { Pool } = require("pg");
const config = require("./config");

const poolConfig = config.database.connectionString
  ? {
      connectionString: config.database.connectionString,
      ...(config.database.ssl ? { ssl: config.database.ssl } : {}),
    }
  : {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ...(config.database.ssl ? { ssl: config.database.ssl } : {}),
    };

const pool = new Pool(poolConfig);

pool.on("connect", () => {
  console.log("PostgreSQL connected");
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

module.exports = pool;