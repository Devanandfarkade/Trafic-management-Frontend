import { pool } from "../config/db.js";
import { getISTTimestamp } from "../utils/dateUtils.js";

/* ============================================================
 * INSERT PERSON DETECTION LOG (Reusing secure_gate_persons)
 * ============================================================ */
export async function insertUnknownPersonLog(data) {
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
 * GET ALL UNKNOWN PERSON LOGS (GROUPED)
 * ============================================================ */
export async function getUnknownPersons(filters = {}) {
  const { date, from_date, to_date, from, to, startDate, endDate } = filters;
  const fromVal = from_date || from || startDate;
  const toVal = to_date || to || endDate;

  let dateFilter = "";
  let params = [];

  if (fromVal && toVal) {
    dateFilter = `AND DATE(p.detected_at) >= $1 AND DATE(p.detected_at) <= $2`;
    params.push(fromVal, toVal);
  } else if (fromVal) {
    dateFilter = `AND DATE(p.detected_at) >= $1`;
    params.push(fromVal);
  } else if (toVal) {
    dateFilter = `AND DATE(p.detected_at) <= $1`;
    params.push(toVal);
  } else if (date && date !== "all") {
    dateFilter = `AND DATE(p.detected_at) = $1`;
    params.push(date);
  }

  // We only want tracking events from cameras dedicated to unknown_person_tracking
  const query = `
    SELECT 
      p.person_id,
      json_agg(
        json_build_object(
          'id', p.id,
          'event_time', to_char(p.detected_at, 'HH12:MI AM'),
          'camera_name', COALESCE(c.name, 'Unknown Camera'),
          'photo_url', p.image_path,
          'status', p.status
        ) ORDER BY p.detected_at ASC
      ) as evidence_logs
    FROM secure_gate_persons p
    JOIN cameras c ON p.camera_id = c.camera_id
    JOIN camera_feature_mappings cfm ON c.camera_id = cfm.camera_id AND cfm.isactive = true
    JOIN features f ON cfm.feature_id = f.feature_id
    WHERE f.name = 'unknown_person'
    ${dateFilter}
    GROUP BY p.person_id
    ORDER BY MAX(p.detected_at) DESC
  `;

  const { rows } = await pool.query(query, params);
  
  // Transform to the structure expected by the frontend
  return {
    rows: rows.map(r => {
      // Find the first non-null photo to use as profile photo
      const profileLog = r.evidence_logs.find(log => log.photo_url) || r.evidence_logs[0];
      return {
        person_id: r.person_id,
        name: r.person_id, // "ID_1" etc.
        profile_photo: profileLog?.photo_url || null,
        evidence_logs: r.evidence_logs
      };
    })
  };
}
