import { pool } from "../config/db.js";

/* ============================================================
 * INSERT INCIDENT (Normalized into traffic_events, incidents, evidences)
 * ============================================================ */
export async function insertIncident(data) {
  const {
    camera,
    severity,
    vehicle_count,
    time_str,
    image_path
  } = data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Get camera_id
    const camRes = await client.query(`SELECT camera_id, location_id FROM cameras WHERE camera_code = $1 OR rtsp_url = $1 LIMIT 1`, [camera]);
    const cameraId = camRes.rows[0]?.camera_id || null;
    const locationId = camRes.rows[0]?.location_id || null;

    if (!cameraId) {
      throw new Error(`Camera not found for code/url: ${camera}`);
    }

    // 2. Ensure traffic_events feature_id is nullable (migration)
    await client.query(`ALTER TABLE traffic_events ALTER COLUMN feature_id DROP NOT NULL`).catch(() => { });

    // 2.5 Prevent duplicates: Check if we already have an incident for this camera within the last 1 minute
    const dupeCheck = await client.query(
      `SELECT i.incident_id FROM incidents i WHERE i.camera_id = $1 AND i.severity = $2 AND i.detected_at >= NOW() - INTERVAL '1 minute' LIMIT 1`,
      [cameraId, severity || 'MODERATE']
    );
    if (dupeCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return { rows: [dupeCheck.rows[0]] }; // return existing to avoid error
    }

    // 3. Insert into traffic_events
    const eventRes = await client.query(
      `INSERT INTO traffic_events 
        (camera_id, location_id, event_type, event_timestamp, severity, status, isactive)
       VALUES ($1, $2, 'INCIDENT', NOW(), $3, 'DETECTED', true)
       RETURNING event_id`,
      [cameraId, locationId, severity || 'MODERATE']
    );
    const eventId = eventRes.rows[0].event_id;

    // 4. Insert into incidents
    const incRes = await client.query(
      `INSERT INTO incidents 
        (event_id, camera_id, location_id, incident_type, severity, detected_at, status, vehicles_involved, isactive)
       VALUES ($1, $2, $3, 'ACCIDENT', $4, NOW(), 'UNRESOLVED', $5, true)
       RETURNING incident_id AS id, severity, vehicles_involved, detected_at, status`,
      [eventId, cameraId, locationId, severity || 'MODERATE', vehicle_count || 0]
    );
    const incident = incRes.rows[0];

    // 5. Insert into evidences
    if (image_path) {
      await client.query(
        `INSERT INTO evidences 
          (event_id, camera_id, evidence_type, captured_at, image_path, isactive)
         VALUES ($1, $2, 'IMAGE', NOW(), $3, true)`,
        [eventId, cameraId, image_path]
      );
    }

    await client.query("COMMIT");

    // Attach image_path and location for the frontend
    incident.image_path = image_path;
    incident.location = data.location;
    return { rows: [incident] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* ============================================================
 * GET INCIDENTS
 * ============================================================ */
export async function getIncidents({ camera, status, date, from_date, to_date, from, to, startDate, endDate, page = 1, limit = 50, zoneId, locationId } = {}) {
  const fromVal = from_date || from || startDate;
  const toVal = to_date || to || endDate;
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (camera) { conditions.push(`(cam.camera_code = $${idx} OR cam.camera_id::text = $${idx})`); values.push(camera); idx++; }
  if (locationId) { 
    if (isNaN(Number(locationId))) {
      conditions.push(`loc.name = $${idx++}`);
    } else {
      conditions.push(`cam.location_id = $${idx++}`); 
    }
    values.push(locationId); 
  }
  if (zoneId) { 
    if (isNaN(Number(zoneId))) {
      conditions.push(`z.name = $${idx++}`);
    } else {
      conditions.push(`cam.zone_id = $${idx++}`); 
    }
    values.push(zoneId); 
  }
  if (status) { conditions.push(`i.status = $${idx++}`); values.push(status); }

  if (fromVal && toVal) {
    conditions.push(`DATE(i.detected_at) >= $${idx++} AND DATE(i.detected_at) <= $${idx++}`);
    values.push(fromVal, toVal);
  } else if (fromVal) {
    conditions.push(`DATE(i.detected_at) >= $${idx++}`);
    values.push(fromVal);
  } else if (toVal) {
    conditions.push(`DATE(i.detected_at) <= $${idx++}`);
    values.push(toVal);
  } else if (date) {
    conditions.push(`DATE(i.detected_at) = $${idx++}`);
    values.push(date);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIdx = idx++;
  const offsetIdx = idx;
  values.push(limit, offset);

  return pool.query(
    `SELECT
       i.incident_id AS id,
       i.severity,
       i.vehicles_involved,
       i.detected_at,
       i.status,
       COALESCE(loc.name, 'Unknown') AS location,
       COALESCE(z.name, 'Unknown') AS zone,
       COALESCE(cam.name, cam.camera_code, 'Unknown') AS camera,
       loc.latitude,
       loc.longitude,
       e.image_path
     FROM incidents i
     JOIN cameras cam ON i.camera_id = cam.camera_id
     LEFT JOIN locations loc ON i.location_id = loc.location_id
     LEFT JOIN zones z ON loc.zone_id = z.zone_id
     LEFT JOIN evidences e ON i.event_id = e.event_id AND e.evidence_type = 'IMAGE'
     ${where}
     ORDER BY i.detected_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );
}

/* ============================================================
 * GET INCIDENT BY ID
 * ============================================================ */
export async function getIncidentById(id) {
  return pool.query(
    `SELECT
       i.incident_id AS id,
       i.severity,
       i.vehicles_involved,
       i.detected_at,
       i.status,
       COALESCE(loc.name, 'Unknown') AS location,
       COALESCE(z.name, 'Unknown') AS zone,
       COALESCE(cam.name, cam.camera_code, 'Unknown') AS camera,
       loc.latitude,
       loc.longitude,
       e.image_path
     FROM incidents i
     JOIN cameras cam ON i.camera_id = cam.camera_id
     LEFT JOIN locations loc ON i.location_id = loc.location_id
     LEFT JOIN zones z ON loc.zone_id = z.zone_id
     LEFT JOIN evidences e ON i.event_id = e.event_id AND e.evidence_type = 'IMAGE'
     WHERE i.incident_id = $1`,
    [id]
  );
}

/* ============================================================
 * GET STATS
 * ============================================================ */
export async function getStats(camera, zoneId, locationId) {
  let conditions = [];
  const values = [];
  let idx = 1;

  if (camera) {
    conditions.push(`(cam.camera_code = $${idx} OR cam.camera_id::text = $${idx})`);
    values.push(camera);
    idx++;
  }
  if (locationId) {
    if (isNaN(Number(locationId))) {
      conditions.push(`loc.name = $${idx++}`);
    } else {
      conditions.push(`cam.location_id = $${idx++}`);
    }
    values.push(locationId);
  }
  if (zoneId) {
    if (isNaN(Number(zoneId))) {
      conditions.push(`z.name = $${idx++}`);
    } else {
      conditions.push(`cam.zone_id = $${idx++}`);
    }
    values.push(zoneId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE TRUE)                  AS total,
       COUNT(*) FILTER (WHERE i.severity = 'SEVERE')   AS severe,
       COUNT(*) FILTER (WHERE i.severity = 'MODERATE') AS moderate,
       COUNT(*) FILTER (WHERE i.severity = 'MINOR')    AS minor,
       COUNT(*) FILTER (WHERE i.severity = 'CONTACT')  AS contact
     FROM incidents i
     LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
     LEFT JOIN locations loc ON i.location_id = loc.location_id
     LEFT JOIN zones z ON loc.zone_id = z.zone_id
     ${whereClause}`,
    values
  );
}

export async function updateIncidentStatus(id, status) {
  const numericId = parseInt(id, 10);
  const isNum = !isNaN(numericId);
  return pool.query(
    `UPDATE incidents SET status = $1 WHERE incident_id = $2::bigint RETURNING incident_id AS id, status`,
    [status, isNum ? numericId : id]
  );
}
