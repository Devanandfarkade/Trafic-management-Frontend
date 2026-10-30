import { pool } from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { getISTTimestamp } from "../utils/dateUtils.js";

/* ============================================================
 * HEAVY VEHICLE MODEL
 * Uses existing heavy_vehicle_violations + traffic_events + evidences
 * ============================================================ */

export async function insertHeavyVehicleDetection({
  camera,
  vehicle_type,
  confidence,
  image_path,
  rtsp_url,
  detected_at,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const istNow = getISTTimestamp(detected_at);

    // 1. Look up camera by code or RTSP URL
    const camRes = await client.query(
      `SELECT camera_id, location_id FROM cameras 
       WHERE camera_code = $1 OR rtsp_url = $1 OR name = $1 
       LIMIT 1`,
      [camera]
    );
    // If not found by code, try rtsp_url directly
    let cameraId = camRes.rows[0]?.camera_id || null;
    let locationId = camRes.rows[0]?.location_id || null;

    if (!cameraId && rtsp_url) {
      const camByRtsp = await client.query(
        `SELECT camera_id, location_id FROM cameras WHERE rtsp_url = $1 LIMIT 1`,
        [rtsp_url]
      );
      cameraId = camByRtsp.rows[0]?.camera_id || null;
      locationId = camByRtsp.rows[0]?.location_id || null;
    }

    // 2. Insert into traffic_events
    const eventRes = await client.query(
      `INSERT INTO traffic_events
         (camera_id, location_id, event_type, event_timestamp, severity, status, isactive)
       VALUES ($1, $2, 'HEAVY_VEHICLE', $3::timestamp, 'MODERATE', 'DETECTED', true)
       RETURNING event_id`,
      [cameraId, locationId, istNow]
    );
    const eventId = eventRes.rows[0]?.event_id;

    // 3. Insert into heavy_vehicle_violations
    const hvRes = await client.query(
      `INSERT INTO heavy_vehicle_violations
         (event_id, camera_id, vehicle_type, confidence, location_id, detected_at, status, isactive)
       VALUES ($1, $2, $3, $4, $5, $6::timestamp, 'DETECTED', true)
       RETURNING violation_id AS id, vehicle_type, confidence, detected_at, status`,
      [eventId, cameraId, vehicle_type || "unknown", confidence || 0, locationId, istNow]
    );
    const violation = hvRes.rows[0];

    // 4. Insert evidence if image provided
    if (image_path && eventId) {
      await client.query(
        `INSERT INTO evidences (event_id, camera_id, evidence_type, captured_at, image_path, isactive)
         VALUES ($1, $2, 'IMAGE', $3::timestamp, $4, true)`,
        [eventId, cameraId, istNow, image_path]
      );
    }

    await client.query("COMMIT");

    violation.image_path = image_path || null;
    violation.camera = camera;
    return { rows: [violation] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getHeavyVehicleDetections({ camera, vehicle_type, date, from_date, to_date, from, to, startDate, endDate, status, page = 1, limit = 50, zoneId, locationId } = {}) {
  const fromVal = from_date || from || startDate;
  const toVal = to_date || to || endDate;
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (camera) { conditions.push(`(cam.camera_code = $${idx} OR cam.name = $${idx} OR cam.camera_id::text = $${idx})`); values.push(camera); idx++; }
  if (vehicle_type) { conditions.push(`hvv.vehicle_type = $${idx++}`); values.push(vehicle_type); }
  if (status) { conditions.push(`hvv.status = $${idx++}`); values.push(status); }
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

  if (fromVal && toVal) {
    conditions.push(`DATE(hvv.detected_at) >= $${idx++} AND DATE(hvv.detected_at) <= $${idx++}`);
    values.push(fromVal, toVal);
  } else if (fromVal) {
    conditions.push(`DATE(hvv.detected_at) >= $${idx++}`);
    values.push(fromVal);
  } else if (toVal) {
    conditions.push(`DATE(hvv.detected_at) <= $${idx++}`);
    values.push(toVal);
  } else if (date && date !== "all") {
    conditions.push(`DATE(hvv.detected_at) = $${idx++}`);
    values.push(date);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIdx = idx++;
  const offsetIdx = idx;
  values.push(limit, offset);

  return pool.query(
    `SELECT
       hvv.violation_id AS id,
       hvv.vehicle_type,
       hvv.confidence,
       hvv.detected_at,
       hvv.status,
       COALESCE(loc.name, 'Unknown') AS location,
       COALESCE(z.name, 'Unknown') AS zone,
       COALESCE(cam.name, cam.camera_code, 'Unknown') AS camera,
       loc.latitude,
       loc.longitude,
       cam.name AS camera_name,
       cam.camera_code,
       e.image_path
     FROM heavy_vehicle_violations hvv
     LEFT JOIN cameras cam ON hvv.camera_id = cam.camera_id
     LEFT JOIN locations loc ON (hvv.location_id = loc.location_id OR cam.location_id = loc.location_id)
     LEFT JOIN zones z ON cam.zone_id = z.zone_id
     LEFT JOIN evidences e ON hvv.event_id = e.event_id AND e.evidence_type = 'IMAGE'
     ${where}
     ORDER BY hvv.detected_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );
}

export async function getHeavyVehicleStats(date, camera, zoneId, locationId) {
  const conditions = ["hvv.isactive = true"];
  const values = [];
  let idx = 1;

  if (date && date !== "all") {
    conditions.push(`DATE(hvv.detected_at) = $${idx++}`);
    values.push(date);
  }
  if (camera) {
    conditions.push(`(cam.camera_code = $${idx} OR cam.name = $${idx} OR cam.camera_id::text = $${idx})`);
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

  const where = `WHERE ${conditions.join(" AND ")}`;

  const result = await pool.query(
    `SELECT
       hvv.vehicle_type,
       COUNT(*)                                          AS total,
       COUNT(*) FILTER (WHERE hvv.status = 'DETECTED')      AS detected,
       COUNT(*) FILTER (WHERE hvv.status = 'RESOLVED')      AS resolved
     FROM heavy_vehicle_violations hvv
     LEFT JOIN cameras cam ON hvv.camera_id = cam.camera_id
     ${where}
     GROUP BY hvv.vehicle_type
     ORDER BY total DESC`,
    values
  );

  const totalResult = await pool.query(
    `SELECT COUNT(*) AS total_detected
     FROM heavy_vehicle_violations hvv
     LEFT JOIN cameras cam ON hvv.camera_id = cam.camera_id
     ${where}`,
    values
  );

  return {
    rows: result.rows,
    total: parseInt(totalResult.rows[0]?.total_detected || 0),
  };
}
