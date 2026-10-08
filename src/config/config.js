const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  port: Number(process.env.PORT) || 5000,

  database: {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:
      process.env.DB_SSL === "true" ||
      (Boolean(process.env.DATABASE_URL) && !process.env.DATABASE_URL.includes("localhost"))
        ? { rejectUnauthorized: false }
        : false,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    url: process.env.CLOUDINARY_URL || "",
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "Car Express <onboarding@resend.dev>",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  },
};

module.exports = config;