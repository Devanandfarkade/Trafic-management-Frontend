import { pool } from "../config/db.js";
import { getISTTimestamp } from "../utils/dateUtils.js";

/* ============================================================
 * INSERT PERSON DETECTION LOG
 * ============================================================ */
export async function insertPersonLog(data) {
  const { person_id, camera, status, time, image_path } = data;

  const client = await pool.connect();
  try {
    // Resolve camera_id and location_id from the camera URL or code
    const camRes = await client.query(
      `SELECT camera_id, location_id FROM cameras WHERE camera_code = $1 OR rtsp_url = $1 LIMIT 1`,
      [camera]
    );
    const cameraId = camRes.rows[0]?.camera_id || null;
    const locationId = camRes.rows[0]?.location_id || null;

    const res = await client.query(
      `INSERT INTO secure_gate_persons 
        (person_id, camera_id, location_id, status, image_path, detected_at, isactive)
       VALUES ($1, $2, $3, $4, $5, $6::timestamp, true)
       RETURNING id, person_id, status, detected_at, image_path`,
      [person_id, cameraId, locationId, status, image_path, getISTTimestamp(time)]
    );

    return { rows: res.rows };
  } finally {
    client.release();
  }
}

/* ============================================================
 * GET ALL PERSON LOGS (PAGINATED)
 * ============================================================ */
export async function getPersons(filters) {
  const { limit = 50, page = 1, search = "" } = filters;
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      s.id,
      s.person_id AS id_label,
      s.status,
      s.image_path,
      s.detected_at,
      c.name AS camera,
      l.name AS location
    FROM secure_gate_persons s
    LEFT JOIN cameras c ON s.camera_id = c.camera_id
    LEFT JOIN locations l ON s.location_id = l.location_id
    WHERE s.isactive = true
  `;

  const values = [];
  let paramCount = 1;

  if (search) {
    query += ` AND (s.person_id ILIKE $${paramCount} OR s.status ILIKE $${paramCount})`;
    values.push(`%${search}%`);
    paramCount++;
  }
  
  if (filters.cameraId) {
    query += ` AND (c.camera_id::text = $${paramCount} OR c.camera_code = $${paramCount} OR c.rtsp_url = $${paramCount})`;
    values.push(filters.cameraId);
    paramCount++;
  }
  
  if (filters.locationId) {
    query += ` AND c.location_id = $${paramCount}`;
    values.push(filters.locationId);
    paramCount++;
  }
  
  if (filters.zoneId) {
    query += ` AND c.zone_id = $${paramCount}`;
    values.push(filters.zoneId);
    paramCount++;
  }

  query += ` ORDER BY s.detected_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  values.push(limit, offset);

  return pool.query(query, values);
}
