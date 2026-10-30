import { pool } from "../config/db.js";

/* ============================================================
 * ZONES CRUD (formerly Premises)
 * ============================================================ */
export async function getAllZones() {
  return pool.query(`
    SELECT
      zone_id AS id,
      name,
      description,
      type,
      location,
      property,
      isactive,
      created_at
    FROM zones
    ORDER BY name ASC
  `);
}

export async function createZone({ name, description, type, location, property }) {
  return pool.query(
    `INSERT INTO zones (name, description, type, location, property, isactive)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING zone_id AS id, name, description, type, location, property, isactive`,
    [name, description || null, type || null, location || null, property || null]
  );
}

export async function updateZone(id, { name, description, type, location, property, isactive }) {
  return pool.query(
    `UPDATE zones
     SET name        = COALESCE($1, name),
         description = COALESCE($2, description),
         type        = COALESCE($3, type),
         location    = COALESCE($4, location),
         property    = COALESCE($5, property),
         isactive    = COALESCE($6, isactive)
     WHERE zone_id = $7
     RETURNING zone_id AS id, name, description, type, location, property, isactive`,
    [name || null, description || null, type || null, location || null, property || null, isactive ?? null, id]
  );
}

export async function deleteZone(id) {
  return pool.query(
    `DELETE FROM zones WHERE zone_id = $1 RETURNING zone_id AS id`,
    [id]
  );
}

/* ============================================================
 * LOCATIONS CRUD (with lat/lng + zone_id)
 * ============================================================ */
export async function getAllLocations() {
  return pool.query(`
    SELECT
      loc.location_id AS id,
      loc.zone_id,
      z.name AS zone_name,
      loc.name,
      loc.description,
      loc.address,
      loc.city,
      loc.state,
      loc.country,
      loc.latitude,
      loc.longitude,
      loc.location_type,
      loc.isactive,
      loc.created_at,
      COUNT(c.camera_id)::int AS cameras_count
    FROM locations loc
    LEFT JOIN zones z ON loc.zone_id = z.zone_id
    LEFT JOIN cameras c ON c.location_id = loc.location_id
    GROUP BY loc.location_id, z.name
    ORDER BY loc.name ASC
  `);
}

export async function getLocationsByZoneId(zoneId) {
  return pool.query(
    `SELECT
       location_id AS id,
       zone_id,
       name,
       description,
       address,
       city,
       state,
       country,
       latitude,
       longitude,
       location_type,
       isactive
     FROM locations
     WHERE zone_id = $1
     ORDER BY name ASC`,
    [zoneId]
  );
}

export async function createLocation({ name, description, city, state, country, zone_id, latitude, longitude, address, location_type, isactive = true }) {
  return pool.query(
    `INSERT INTO locations (zone_id, name, description, address, city, state, country, latitude, longitude, location_type, isactive)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING location_id AS id, zone_id, name, description, address, city, state, country, latitude, longitude, location_type, isactive`,
    [
      zone_id || null,
      name,
      description || null,
      address || null,
      city || "Baramati",
      state || "Maharashtra",
      country || "India",
      latitude || null,
      longitude || null,
      location_type || null,
      isactive ?? true,
    ]
  );
}

export async function updateLocation(id, { name, description, city, state, country, zone_id, latitude, longitude, address, location_type, isactive }) {
  return pool.query(
    `UPDATE locations
     SET name          = COALESCE($1, name),
         description   = COALESCE($2, description),
         city          = COALESCE($3, city),
         state         = COALESCE($4, state),
         country       = COALESCE($5, country),
         zone_id       = COALESCE($6, zone_id),
         latitude      = COALESCE($7, latitude),
         longitude     = COALESCE($8, longitude),
         address       = COALESCE($9, address),
         location_type = COALESCE($10, location_type),
         isactive      = COALESCE($11, isactive)
     WHERE location_id = $12
     RETURNING location_id AS id, zone_id, name, description, city, state, country, latitude, longitude, isactive`,
    [name || null, description || null, city || null, state || null, country || null,
     zone_id || null, latitude || null, longitude || null, address || null,
     location_type || null, isactive ?? null, id]
  );
}

export async function deleteLocation(id) {
  return pool.query(
    `DELETE FROM locations WHERE location_id = $1 RETURNING location_id AS id`,
    [id]
  );
}

/* ============================================================
 * GET DISTINCT CAMERA LOCATIONS (for filter dropdowns)
 * ============================================================ */
export async function getCameraLocations(moduleType) {
  if (moduleType) {
    return pool.query(
      `SELECT DISTINCT loc.name AS location
       FROM cameras c
       LEFT JOIN locations loc ON c.location_id = loc.location_id
       WHERE EXISTS (
         SELECT 1 FROM camera_feature_mappings cfm
         JOIN features f ON cfm.feature_id = f.feature_id
         WHERE cfm.camera_id = c.camera_id AND cfm.isactive = true AND f.name = $1
       ) 
       AND loc.name IS NOT NULL AND c.is_active = true
       ORDER BY location ASC`,
      [moduleType]
    );
  }
  return pool.query(
    `SELECT DISTINCT loc.name AS location
     FROM cameras c
     LEFT JOIN locations loc ON c.location_id = loc.location_id
     WHERE loc.name IS NOT NULL AND c.is_active = true
     ORDER BY location ASC`
  );
}

