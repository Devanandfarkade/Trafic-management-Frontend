import { pool } from "../config/db.js";
import { getISTTimestamp } from "../utils/dateUtils.js";


/* ============================================================
 * UPSERT VEHICLE
 * If plate is detected (not null/UNKNOWN/empty):
 *   - INSERT INTO vehicles (registration_number) ON CONFLICT DO NOTHING
 *   - Return the vehicle_id (new or existing)
 * If plate is unknown: return null
 * ============================================================ */
const UNKNOWN_PLATES = new Set(["UNKNOWN", "UNDETECTED", "N/A", "", null, undefined]);

export async function upsertVehicle(plate) {
  const normalized = (plate || "").trim().toUpperCase();
  if (!normalized || UNKNOWN_PLATES.has(normalized)) return null;

  try {
    // Try insert — if registration_number already exists, DO NOTHING
    const insertRes = await pool.query(
      `INSERT INTO vehicles (registration_number)
       VALUES ($1)
       ON CONFLICT (registration_number) DO NOTHING
       RETURNING vehicle_id`,
      [normalized]
    );

    if (insertRes.rows.length > 0) {
      const newId = insertRes.rows[0].vehicle_id;
      console.log(`🚗 New vehicle registered: ${normalized} → vehicle_id=${newId}`);
      return newId;
    }

    // Already existed — fetch its ID
    const existing = await pool.query(
      `SELECT vehicle_id FROM vehicles WHERE registration_number = $1`,
      [normalized]
    );

    const existingId = existing.rows[0]?.vehicle_id ?? null;
    console.log(`🔍 Existing vehicle: ${normalized} → vehicle_id=${existingId}`);
    return existingId;
  } catch (err) {
    console.warn(`⚠️ Could not upsert vehicle for plate "${normalized}":`, err.message);
    return null;
  }
}

/* ============================================================
 * INSERT VIOLATION
 * Automatically upserts vehicle and stores vehicle_id FK.
 * tracker_id = Python's raw tracking integer (kept for reference).
 * vehicle_id = FK → vehicles.vehicle_id (null if plate unknown).
 * ============================================================ */
export async function insertViolation({
  violation_id,
  stream_id,
  vehicle_id: raw_tracker_id,  // Python tracker ID (random int from YOLO/tracking)
  tracker_id: passed_tracker_id,
  plate,
  stationary,
  time,
  camera,
  location,
  rtsp_url,
  detector_confidence,
  best_confidence,
  ocr_confidence,
  violation_image_path,
  vehicle_image,
  plate_crop,
  enhanced_plate,
  best_result,
  violation_image,
  status = "UNRESOLVED",
}) {
  // Resolve DB vehicle ID from the license plate
  const vehicle_id = await upsertVehicle(plate);
  const tracker_id = passed_tracker_id || (raw_tracker_id != null ? String(raw_tracker_id) : null);

  let cameraId = null;
  let locationId = null;

  if (stream_id || camera) {
    try {
      const camResult = await pool.query(
        `SELECT camera_id, location_id FROM cameras WHERE rtsp_url IN ($1, $2) OR camera_code IN ($1, $2) OR name IN ($1, $2) OR (camera_id)::text IN ($1, $2) LIMIT 1`,
        [stream_id || null, camera || stream_id || null]
      );
      if (camResult.rows[0]) {
        cameraId = camResult.rows[0].camera_id;
        locationId = camResult.rows[0].location_id;
      }
    } catch (err) {
      console.error("Error looking up camera_id/location_id:", err);
    }
  }

  const result = await pool.query(
    `INSERT INTO no_parking_violations
       (violation_id, stream_id, tracker_id, vehicle_id, plate, stationary, time,
        camera, location, rtsp_url, detector_confidence, best_confidence, ocr_confidence,
        violation_image_path, vehicle_image, plate_crop, enhanced_plate,
        best_result, violation_image, status, camera_id, location_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     ON CONFLICT (violation_id) DO UPDATE
       SET violation_image_path = COALESCE(EXCLUDED.violation_image_path, no_parking_violations.violation_image_path),
           plate        = COALESCE(EXCLUDED.plate, no_parking_violations.plate),
           vehicle_id   = COALESCE(EXCLUDED.vehicle_id, no_parking_violations.vehicle_id),
           tracker_id   = COALESCE(EXCLUDED.tracker_id, no_parking_violations.tracker_id),
           stationary   = COALESCE(EXCLUDED.stationary, no_parking_violations.stationary),
           location     = COALESCE(EXCLUDED.location, no_parking_violations.location),
           rtsp_url     = COALESCE(EXCLUDED.rtsp_url, no_parking_violations.rtsp_url),
           camera_id    = COALESCE(EXCLUDED.camera_id, no_parking_violations.camera_id),
           location_id  = COALESCE(EXCLUDED.location_id, no_parking_violations.location_id)
     RETURNING *`,
    [
      violation_id || null,
      stream_id || null,
      tracker_id,
      vehicle_id,                                       // FK to vehicles (bigint or null)
      plate || null,
      stationary || null,
      getISTTimestamp(time),
      camera || stream_id || null,
      location || null,
      rtsp_url || null,
      detector_confidence || 0,
      best_confidence || 0,
      ocr_confidence || 0,
      violation_image_path || null,
      vehicle_image || null,
      plate_crop || null,
      enhanced_plate || null,
      best_result || null,
      violation_image || null,
      status,
      cameraId,
      locationId
    ]
  );
  return result;
}

/* ============================================================
 * SELECT — JOINs cameras + vehicles tables for enriched response
 * ============================================================ */
export async function getViolations({ camera, stream_id, status, date, from_date, to_date, from, to, startDate, endDate, page = 1, limit = 50, zoneId, locationId } = {}) {
  const fromVal = from_date || from || startDate;
  const toVal = to_date || to || endDate;
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (camera) { conditions.push(`(v.camera = $${idx} OR v.stream_id = $${idx} OR cam.camera_code = $${idx} OR cam.camera_id::text = $${idx})`); values.push(camera); idx++; }
  if (stream_id) { conditions.push(`v.stream_id = $${idx++}`); values.push(stream_id); }
  if (status) { conditions.push(`v.status = $${idx++}`); values.push(status); }
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
    conditions.push(`DATE(v.detected_at) >= $${idx++} AND DATE(v.detected_at) <= $${idx++}`);
    values.push(fromVal, toVal);
  } else if (fromVal) {
    conditions.push(`DATE(v.detected_at) >= $${idx++}`);
    values.push(fromVal);
  } else if (toVal) {
    conditions.push(`DATE(v.detected_at) <= $${idx++}`);
    values.push(toVal);
  } else if (date && date !== "all") {
    conditions.push(`DATE(v.detected_at) = $${idx++}`);
    values.push(date);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIdx = idx++;
  const offsetIdx = idx;
  values.push(limit, offset);

  return pool.query(
    `SELECT DISTINCT ON (v.id)
       v.*,
       COALESCE(loc.name, v.location, 'Unknown')           AS location,
       COALESCE(z.name, 'Unknown')                         AS zone,
       COALESCE(cam.name, cam.camera_code, v.camera, 'Unknown') AS camera,
       loc.latitude,
       loc.longitude,
       cam.camera_id,
       vh.registration_number                              AS vehicle_registration,
       vh.vehicle_type,
       vh.owner_name
     FROM no_parking_violations v
     LEFT JOIN cameras cam
       ON (cam.rtsp_url = v.rtsp_url OR cam.camera_code = v.camera OR cam.name = v.camera)
     LEFT JOIN locations loc
       ON (loc.location_id = cam.location_id OR loc.name = v.location)
     LEFT JOIN zones z ON loc.zone_id = z.zone_id
     LEFT JOIN vehicles vh
       ON vh.vehicle_id = v.vehicle_id
     ${where}
     ORDER BY v.id DESC, v.detected_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );
}

/* ============================================================
 * STATS
 * ============================================================ */
export async function getStats(camera, date, zoneId, locationId) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (camera) {
    conditions.push(`(v.camera = $${idx} OR v.stream_id = $${idx} OR cam.camera_code = $${idx} OR cam.camera_id::text = $${idx})`);
    values.push(camera);
    idx++;
  }

  if (date && date !== "all") {
    conditions.push(`DATE(v.detected_at) = $${idx++}`);
    values.push(date);
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

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE TRUE)                  AS total,
       COUNT(*) FILTER (WHERE v.status = 'UNRESOLVED') AS pending,
       COUNT(*) FILTER (WHERE v.status = 'RESOLVED')   AS resolved,
       COUNT(*) FILTER (WHERE v.status = 'REJECTED')   AS rejected
     FROM no_parking_violations v
     LEFT JOIN cameras cam ON (cam.rtsp_url = v.rtsp_url OR cam.camera_code = v.camera OR cam.name = v.camera)
     LEFT JOIN locations loc ON (loc.location_id = cam.location_id OR loc.name = v.location)
     LEFT JOIN zones z ON loc.zone_id = z.zone_id
     ${where}`,
    values
  );
}

export async function updateViolationStatus(id, status) {
  const numericId = parseInt(id, 10);
  const isNum = !isNaN(numericId);
  return pool.query(
    `UPDATE no_parking_violations
     SET status = $1
     WHERE ($2::int IS NOT NULL AND id = $2::int) OR violation_id = $3::text
     RETURNING *`,
    [status, isNum ? numericId : null, String(id)]
  );
}
