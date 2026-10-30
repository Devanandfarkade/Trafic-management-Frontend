import { pool } from "../config/db.js";

/* ============================================================
 * CATEGORY MODEL — manages categories (modules/pages)
 * Each category groups related features (e.g. Heavy Vehicle groups
 * cement_mixer, excavator, roller_compactor, tower_crane, dump_truck)
 * ============================================================ */

/* ---------- SEED DATA ---------- */
const CATEGORY_SEEDS = [
  { name: "Traffic Management", description: "No Parking, In & Out, AI Incident detection modules", page_key: "traffic" },
  { name: "Heavy Vehicle",      description: "Heavy construction vehicle detection modules",        page_key: "heavy_vehicle" },
  { name: "Secure Gate",        description: "Face recognition and unknown person tracking",        page_key: "secure_gate" },
  { name: "Transport",          description: "License plate / ANPR detection module",               page_key: "transport" },
];

const FEATURE_SEEDS = [
  // Traffic Management (category index 0)
  { name: "no_parking",        description: "No Parking Violation Detection",  model_path: "ws://110.227.253.23:8000/ws",                  category_key: "traffic" },
  { name: "in_out",            description: "Vehicle In & Out Count",           model_path: "ws://110.227.253.23:5001/ws",                  category_key: "traffic" },
  { name: "ai_incident",       description: "AI Incident Detection",            model_path: "ws://110.227.253.23:8010/ws",                  category_key: "traffic" },
  // Heavy Vehicle (category index 1)
  { name: "cement_mixer",      description: "Cement Mixer Detection",           model_path: "ws://110.227.253.23:9010/cementmixer/ws",     category_key: "heavy_vehicle" },
  { name: "excavator",         description: "Excavator Detection",              model_path: "ws://110.227.253.23:9011/excavator/ws",        category_key: "heavy_vehicle" },
  { name: "roller_compactor",  description: "Roller Compactor Detection",       model_path: "ws://110.227.253.23:9012/rollercompactor/ws", category_key: "heavy_vehicle" },
  { name: "tower_crane",       description: "Tower Crane Detection",            model_path: "ws://110.227.253.23:9013/towercrane/ws",      category_key: "heavy_vehicle" },
  { name: "dump_truck",        description: "Dump Truck Detection",             model_path: "ws://110.227.253.23:9014/dumptruck/ws",       category_key: "heavy_vehicle" },
  // Secure Gate (category index 2)
  { name: "face_auth",         description: "Face Recognition / Secure Gate",  model_path: "ws://110.227.253.23:8040/ws",                  category_key: "secure_gate" },
  { name: "unknown_person",    description: "Unknown Person Tracking",          model_path: "ws://110.227.253.23:8040/ws",                  category_key: "secure_gate" },
  // Transport (category index 3)
  { name: "anpr",              description: "License Plate / ANPR Detection",  model_path: "ws://110.227.253.23:8030/ws",                  category_key: "transport" },
];

/* ---------- SEED FUNCTION (called at server startup) ---------- */
export async function ensureCategoriesSeeded() {
  try {
    // Ensure categories table has data
    const catCount = await pool.query(`SELECT COUNT(*) FROM categories`).catch(() => ({ rows: [{ count: "0" }] }));
    
    if (parseInt(catCount.rows[0].count, 10) === 0) {
      for (const cat of CATEGORY_SEEDS) {
        await pool.query(
          `INSERT INTO categories (name, description) 
           VALUES ($1, $2) 
           ON CONFLICT DO NOTHING`,
          [cat.name, cat.description]
        ).catch(() => {});
      }
      console.log("✅ Categories seeded");
    }

    // Add page_key column to categories if it doesn't exist
    await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS page_key VARCHAR(50)`).catch(() => {});

    // Update page_keys for existing categories
    for (const cat of CATEGORY_SEEDS) {
      await pool.query(
        `UPDATE categories SET page_key = $1 WHERE name = $2`,
        [cat.page_key, cat.name]
      ).catch(() => {});
    }

    // Check if features table has data
    const featCount = await pool.query(`SELECT COUNT(*) FROM features`).catch(() => ({ rows: [{ count: "0" }] }));
    
    if (parseInt(featCount.rows[0].count, 10) === 0) {
      // Get category IDs by name
      const catRows = await pool.query(`SELECT category_id, name FROM categories`).catch(() => ({ rows: [] }));
      const catMap = {};
      catRows.rows.forEach(c => {
        // Map by page_key (derived from name)
        const seed = CATEGORY_SEEDS.find(s => s.name === c.name);
        if (seed) catMap[seed.page_key] = c.category_id;
      });

      for (const feat of FEATURE_SEEDS) {
        const catId = catMap[feat.category_key];
        if (!catId) continue;
        await pool.query(
          `INSERT INTO features (name, description, model_path, category_id, isactive)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT DO NOTHING`,
          [feat.name, feat.description, feat.model_path, catId]
        ).catch(() => {});
      }
      console.log("✅ Features seeded");
    }
  } catch (err) {
    console.error("❌ ensureCategoriesSeeded error:", err.message);
  }
}

/* ---------- CRUD ---------- */
export async function getAllCategories() {
  return pool.query(`
    SELECT 
      c.category_id AS id,
      c.name,
      c.description,
      c.page_key,
      c.isactive,
      c.created_at,
      COUNT(f.feature_id) AS features_count
    FROM categories c
    LEFT JOIN features f ON f.category_id = c.category_id AND f.isactive = true
    GROUP BY c.category_id
    ORDER BY c.category_id ASC
  `);
}

export async function createCategory({ name, description, page_key }) {
  return pool.query(
    `INSERT INTO categories (name, description, page_key, isactive)
     VALUES ($1, $2, $3, true)
     RETURNING category_id AS id, name, description, page_key, isactive, created_at`,
    [name, description || null, page_key || null]
  );
}

export async function updateCategory(id, { name, description, page_key, isactive }) {
  return pool.query(
    `UPDATE categories
     SET name        = COALESCE($1, name),
         description = COALESCE($2, description),
         page_key    = COALESCE($3, page_key),
         isactive    = COALESCE($4, isactive)
     WHERE category_id = $5
     RETURNING category_id AS id, name, description, page_key, isactive`,
    [name || null, description || null, page_key || null, isactive ?? null, id]
  );
}

export async function deleteCategory(id) {
  return pool.query(
    `DELETE FROM categories WHERE category_id = $1 RETURNING category_id AS id`,
    [id]
  );
}
