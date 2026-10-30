import { pool } from "../config/db.js";

/* ============================================================
 * FEATURE MODEL
 * Handles features CRUD + camera_feature_mappings
 * ============================================================ */

/* ---------- FEATURES CRUD ---------- */
export async function getAllFeatures(categoryId = null, activeOnly = null) {
  const whereClauses = [];
  const params = [];
  let paramIdx = 1;

  if (categoryId) {
    whereClauses.push(`f.category_id = $${paramIdx++}`);
    params.push(categoryId);
  }
  if (activeOnly === true) {
    whereClauses.push(`f.isactive = true`);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return pool.query(`
    SELECT 
      f.feature_id AS id,
      f.name,
      f.description,
      f.model_path,
      f.isactive,
      f.category_id,
      c.category AS category_name,
      c.page_key AS category_page_key
    FROM features f
    LEFT JOIN categories c ON f.category_id = c.category_id
    ${whereStr}
    ORDER BY c.category_id ASC, f.feature_id ASC
  `, params);
}

export async function createFeature({ name, description, model_path, category_id, isactive = true }) {
  return pool.query(
    `INSERT INTO features (name, description, model_path, category_id, isactive)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING feature_id AS id, name, description, model_path, category_id, isactive`,
    [name, description || null, model_path || null, category_id || null, isactive]
  );
}

export async function updateFeature(id, { name, description, model_path, category_id, isactive }) {
  return pool.query(
    `UPDATE features
     SET name        = COALESCE($1, name),
         description = COALESCE($2, description),
         model_path  = COALESCE($3, model_path),
         category_id = COALESCE($4, category_id),
         isactive    = COALESCE($5, isactive)
     WHERE feature_id = $6
     RETURNING feature_id AS id, name, description, model_path, category_id, isactive`,
    [name || null, description || null, model_path || null, category_id || null, isactive ?? null, id]
  );
}

export async function deleteFeature(id) {
  return pool.query(
    `DELETE FROM features WHERE feature_id = $1 RETURNING feature_id AS id`,
    [id]
  );
}

/* ---------- CAMERA-FEATURE MAPPINGS ---------- */

/**
 * Get all features mapped to a specific camera (with toggle status)
 * Grouped by category for the Settings drawer
 */
export async function getFeaturesByCameraId(cameraId) {
  return pool.query(
    `SELECT 
       f.feature_id AS id,
       f.name,
       f.description,
       f.model_path,
       f.isactive,
       c.category AS category_name,
       c.page_key AS category_page_key,
       c.category_id,
       cfm.mapping_id,
       cfm.on_off_status
     FROM camera_feature_mappings cfm
     JOIN features f ON cfm.feature_id = f.feature_id
     LEFT JOIN categories c ON f.category_id = c.category_id
     WHERE cfm.camera_id = $1 AND cfm.isactive = true AND f.isactive = true
     ORDER BY c.category_id ASC, cfm.on_off_status DESC, f.feature_id ASC`,
    [cameraId]
  );
}

/**
 * Bulk set features for a camera (replaces all existing mappings)
 */
export async function bulkSetCameraFeatures(cameraId, featureIds) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Soft-delete existing active mappings for this camera
    await client.query(
      `UPDATE camera_feature_mappings SET isactive = false WHERE camera_id = $1`,
      [cameraId]
    );

    // Insert new mappings
    for (const featureId of featureIds) {
      // Try to reactivate existing mapping first
      const existing = await client.query(
        `UPDATE camera_feature_mappings 
         SET isactive = true, on_off_status = true
         WHERE camera_id = $1 AND feature_id = $2
         RETURNING mapping_id`,
        [cameraId, featureId]
      );

      if (existing.rowCount === 0) {
        await client.query(
          `INSERT INTO camera_feature_mappings 
             (camera_id, feature_id, on_off_status, isactive)
           VALUES ($1, $2, true, true)`,
          [cameraId, featureId]
        );
      }
    }

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Toggle on_off_status for a specific mapping
 */
export async function toggleFeatureMapping(mappingId, onOffStatus) {
  return pool.query(
    `UPDATE camera_feature_mappings
     SET on_off_status = $1
     WHERE mapping_id = $2
     RETURNING mapping_id, camera_id, feature_id, on_off_status`,
    [onOffStatus, mappingId]
  );
}

/**
 * Get cameras by category — sorted: cameras with ≥1 active feature first
 * Returns camera data with features[] array and has_active_feature flag
 */
export async function getCamerasByCategory(categoryId, zoneId = null, locationId = null) {
  return pool.query(
    `SELECT 
       c.camera_id AS id,
       c.camera_id,
       c.camera_code,
       c.name,
       c.rtsp_url,
       c.is_active,
       c.zone_id,
       z.name AS zone_name,
       COALESCE(loc.name, 'Unknown') AS location,
       loc.latitude,
       loc.longitude,
       BOOL_OR(cfm.on_off_status) AS has_active_feature,
       JSON_AGG(
         JSON_BUILD_OBJECT(
           'feature_id',   f.feature_id,
           'name',         f.name,
           'description',  f.description,
           'model_path',   f.model_path,
           'mapping_id',   cfm.mapping_id,
           'on_off_status', cfm.on_off_status
         ) ORDER BY cfm.on_off_status DESC, f.feature_id ASC
       ) AS features
     FROM cameras c
     JOIN camera_feature_mappings cfm ON c.camera_id = cfm.camera_id AND cfm.isactive = true
     JOIN features f ON cfm.feature_id = f.feature_id AND f.isactive = true
     JOIN categories cat ON f.category_id = cat.category_id AND cat.isactive = true
     LEFT JOIN locations loc ON c.location_id = loc.location_id
     LEFT JOIN zones z ON c.zone_id = z.zone_id
     WHERE cat.category_id = $1
       AND ($2::int IS NULL OR c.zone_id = $2::int)
       AND ($3::int IS NULL OR c.location_id = $3::int)
     GROUP BY c.camera_id, loc.name, loc.latitude, loc.longitude, z.name
     ORDER BY has_active_feature DESC, c.camera_id ASC`,
    [categoryId, zoneId, locationId]
  );
}

/**
 * Get ALL cameras (no category filter) — still includes features[] if any
 */
export async function getAllCamerasWithFeatures() {
  return pool.query(`
    SELECT 
      c.camera_id AS id,
      c.camera_code,
      c.name,
      c.rtsp_url,
      c.is_active,
      c.zone_id,
      z.name AS zone_name,
      COALESCE(loc.name, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      COALESCE(
        (SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'feature_id',   f2.feature_id,
            'name',         f2.name,
            'model_path',   f2.model_path,
            'mapping_id',   cfm2.mapping_id,
            'on_off_status', cfm2.on_off_status
          ) ORDER BY cfm2.on_off_status DESC, f2.feature_id ASC
        )
        FROM camera_feature_mappings cfm2
        JOIN features f2 ON cfm2.feature_id = f2.feature_id
        WHERE cfm2.camera_id = c.camera_id AND cfm2.isactive = true
        ), '[]'::json) AS features
    FROM cameras c
    LEFT JOIN locations loc ON c.location_id = loc.location_id
    LEFT JOIN zones z ON c.zone_id = z.zone_id
    ORDER BY c.camera_id DESC
  `);
}
