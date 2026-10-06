const express = require('express');
const pool = require('./config/db');
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
const carRoutes = require("./routes/cars.routes");
const brandRoutes = require("./routes/brands.routes");
const favoriteRoutes = require("./routes/favorites.routes");
const inquiryRoutes = require("./routes/inquiries.routes");
const errorMiddleware = require("./middleware/error.middleware");
const httpError = require("./utils/httpError");

const cors = require("cors");
const helmet = require("helmet");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/inquiries", inquiryRoutes);

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.status(200).json({
      success: true,
      message: "Car Express API and database are running",
      data: {
        database: "connected",
        time: result.rows[0].current_time,
      },
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      success: false,
      message: "Car Express API is running, but database is unavailable",
      data: { database: "disconnected" },
    });
  }
});

app.use((req, res, next) => {
  next(httpError(404, "Route not found"));
});
app.use(errorMiddleware);

module.exports = app;