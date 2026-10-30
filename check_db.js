import { pool } from "./src/config/db.js";

async function check() {
  try {
    const res = await pool.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'criminal_detections' ORDER BY ordinal_position"
    );
    console.log("Columns:", res.rows);
    const count = await pool.query("SELECT COUNT(*) FROM public.criminal_detections");
    console.log("Current detection count:", count.rows[0]);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await pool.end();
  }
}

check();
