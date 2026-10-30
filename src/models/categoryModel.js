import { pool } from "../config/db.js";

/* ============================================================
 * CATEGORY MODEL — manages categories (modules/pages)
 * Each category groups related features (e.g. Heavy Vehicle groups
 * cement_mixer, excavator, roller_compactor, tower_crane, dump_truck)
 * ============================================================ */


/* ---------- CRUD ---------- */
export async function getAllCategories(activeOnly = null) {
  const whereClause = activeOnly === true ? 'WHERE c.isactive = true' : '';
  return pool.query(`
    SELECT 
      c.category_id AS id,
      c.category AS name,
      '' AS description,
      c.page_key,
      c.isactive,
      c.created_at,
      COUNT(f.feature_id) AS features_count
    FROM categories c
    LEFT JOIN features f ON f.category_id = c.category_id AND f.isactive = true
    ${whereClause}
    GROUP BY c.category_id
    ORDER BY COALESCE(c.sequence_id, 999) ASC, c.category_id ASC
  `);
}

export async function createCategory({ name, description, page_key }) {
  return pool.query(
    `INSERT INTO categories (category, page_key, isactive)
     VALUES ($1, $2, true)
     RETURNING category_id AS id, category AS name, '' AS description, page_key, isactive, created_at`,
    [name, page_key || null]
  );
}

export async function updateCategory(id, { name, description, page_key, isactive }) {
  return pool.query(
    `UPDATE categories
     SET category    = COALESCE($1, category),
         page_key    = COALESCE($2, page_key),
         isactive    = COALESCE($3, isactive)
     WHERE category_id = $4
     RETURNING category_id AS id, category AS name, '' AS description, page_key, isactive`,
    [name || null, page_key || null, isactive ?? null, id]
  );
}

export async function deleteCategory(id) {
  return pool.query(
    `DELETE FROM categories WHERE category_id = $1 RETURNING category_id AS id`,
    [id]
  );
}
