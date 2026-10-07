const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  port: Number(process.env.PORT) || 5000,

  database: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
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