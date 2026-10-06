const app = require("./app");
const config = require("./config/config");

const server = app.listen(config.port, () => {
  console.log(`Car Express API running on port ${config.port}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down...`);

  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// console.log(`${signal} received. Shutting down...`);