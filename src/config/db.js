import dotenv from "dotenv";
dotenv.config();

import pkg from "pg";
const { Pool } = pkg;

/* ================= DATABASE CONFIG ================= */
export const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});

/* ================= DATABASE CONNECTION CHECK ================= */
pool.query("SELECT 1")
  .then(() => {
    console.log("✅ PostgreSQL connected Sucessfully");
  })
  .catch((err) => {
    console.error("❌ PostgreSQL connection failed");
    console.error(err.message);
    process.exit(1); // stop app if DB is down
  });
