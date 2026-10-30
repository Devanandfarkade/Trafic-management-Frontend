import { pool } from "../config/db.js";


export async function getAllCameras(moduleType = null, zoneId = null, locationId = null) {
  return pool.query(
    `SELECT DISTINCT ON (c.camera_id)
       c.camera_id AS id,
       c.camera_id,
       c.camera_code,
       c.name,
       c.rtsp_url,
       c.location_id,
       c.zone_id,
       z.name AS zone_name,
       COALESCE(loc.name, 'Unknown') AS location,
       loc.latitude,
       loc.longitude,
       c.is_active,
       COALESCE(
         (SELECT JSON_AGG(
           JSON_BUILD_OBJECT(
             'feature_id',    f2.feature_id,
             'name',          f2.name,
             'description',   f2.description,
             'model_path',    f2.model_path,
             'mapping_id',    cfm2.mapping_id,
             'on_off_status', cfm2.on_off_status
           ) ORDER BY cfm2.on_off_status DESC, f2.feature_id ASC
         )
         FROM camera_feature_mappings cfm2
         JOIN features f2 ON cfm2.feature_id = f2.feature_id
         WHERE cfm2.camera_id = c.camera_id AND cfm2.isactive = true
         ), '[]'::json) AS features
     FROM cameras c
     LEFT JOIN locations loc ON c.location_id = loc.location_id
     LEFT JOIN camera_feature_mappings cfm ON c.camera_id = cfm.camera_id AND cfm.isactive = true
     LEFT JOIN features f ON cfm.feature_id = f.feature_id AND f.isactive = true
     LEFT JOIN categories cat ON f.category_id = cat.category_id AND cat.isactive = true
     LEFT JOIN zones z ON c.zone_id = z.zone_id
     WHERE ($1::text IS NULL
        OR LOWER(f.name) = LOWER($1)
        OR LOWER(f.name) = LOWER(REPLACE(REPLACE($1, ' ', '_'), '-', '_'))
        OR LOWER(cat.page_key) = LOWER($1)
        OR LOWER(cat.page_key) = LOWER(REPLACE(REPLACE($1, ' ', '_'), '-', '_'))
        OR LOWER(cat.category) = LOWER($1)
        OR LOWER(cat.category) = LOWER(REGEXP_REPLACE($1, '(?i)\\s*detection', ''))
        OR LOWER(f.name) = LOWER(REGEXP_REPLACE(REPLACE(REPLACE($1, ' ', '_'), '-', '_'), '(?i)_detection', '')))
        AND ($2::int IS NULL OR c.zone_id = $2::int)
        AND ($3::int IS NULL OR c.location_id = $3::int)
     ORDER BY c.camera_id DESC`,
    [moduleType || null, zoneId || null, locationId || null]
  );
}

export async function insertCamera({
  zone_id,
  location_id,
  camera_code,
  name,
  rtsp_url,
}) {
  const finalCode = camera_code || `cam-${Date.now().toString().slice(-6)}`;
  const finalName = name || "Camera Stream";

  let validZoneId = zone_id;
  if (!validZoneId) {
    try {
      const pCheck = await pool.query(`SELECT zone_id FROM zones ORDER BY zone_id ASC LIMIT 1`);
      validZoneId = pCheck?.rows?.[0]?.zone_id;
    } catch (e) {}
  }

  let validLocationId = location_id;
  if (!validLocationId && validZoneId) {
    try {
      const lCheck = await pool.query(`SELECT location_id FROM locations WHERE zone_id = $1 ORDER BY location_id ASC LIMIT 1`, [validZoneId]);
      validLocationId = lCheck?.rows?.[0]?.location_id;
    } catch (e) {}
  }

  return pool.query(
    `INSERT INTO cameras (
       zone_id, location_id, name, camera_code, rtsp_url
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       camera_id AS id,
       camera_id,
       camera_code,
       name,
       rtsp_url,
       location_id,
       zone_id,
       is_active`,
    [
      validZoneId ? parseInt(validZoneId, 10) : null,
      validLocationId ? parseInt(validLocationId, 10) : null,
      finalName,
      finalCode,
      rtsp_url || "",
    ]
  );
}

export async function updateCamera(
  id,
  { name, rtsp_url, is_active, camera_code, location_id, zone_id }
) {
  const finalName = name;

  return pool.query(
    `UPDATE cameras
     SET name         = COALESCE($1, name),
         rtsp_url     = COALESCE($2, rtsp_url),
         is_active    = COALESCE($3, is_active),
         camera_code  = COALESCE($4, camera_code),
         location_id  = COALESCE($5::bigint, location_id),
         zone_id      = COALESCE($6::bigint, zone_id)
     WHERE camera_id = $7
     RETURNING
       camera_id AS id,
       camera_id,
       camera_code,
       name,
       rtsp_url,
       location_id,
       zone_id,
       is_active`,
    [
      finalName || null,
      rtsp_url || null,
      is_active !== undefined ? is_active : null,
      camera_code || null,
      location_id ? parseInt(location_id, 10) : null,
      zone_id ? parseInt(zone_id, 10) : null,
      id,
    ]
  );
}

export async function deleteCamera(id) {
  return pool.query(`DELETE FROM cameras WHERE camera_id = $1 RETURNING camera_id AS id`, [id]);
}
