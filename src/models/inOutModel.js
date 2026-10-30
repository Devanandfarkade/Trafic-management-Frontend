import { pool } from "../config/db.js";
import { getISTTimestamp } from "../utils/dateUtils.js";


/* ============================================================
 * INSERT — single event from Python WebSocket new_events
 * ============================================================ */
export async function insertEvent({
  event_id,
  stream_id,
  track_id,
  vehicle_type,
  vehicle_display,
  direction,
  direction_arrow,
  direction_text,
  camera,
  image_path,       // saved by saveBase64Image middleware (backslash path)
  time_str,
  timestamp,
  event_time,
}) {
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

  // Prevent duplicate insertions
  if (event_id) {
    const existing = await pool.query(`SELECT * FROM in_out_events WHERE event_id = $1`, [event_id]);
    if (existing.rows.length > 0) return existing;
  }
  if (track_id != null) {
    const existing = await pool.query(
      `SELECT * FROM in_out_events WHERE track_id = $1 AND (stream_id = $2 OR camera = $2) AND event_time >= NOW() - INTERVAL '1 minute' LIMIT 1`,
      [String(track_id), stream_id || camera]
    );
    if (existing.rows.length > 0) return existing;
  }

  return pool.query(
    `INSERT INTO in_out_events
       (event_id, stream_id, track_id, vehicle_type, vehicle_display,
        direction, direction_arrow, direction_text, camera, image_path,
        time_str, event_timestamp, event_time, camera_id, location_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      event_id || null,
      stream_id || null,
      track_id != null ? String(track_id) : null,
      vehicle_type || null,
      vehicle_display || null,
      direction || null,
      direction_arrow || (direction === "in" ? "⬇" : "⬆"),
      direction_text || (direction === "in" ? "IN" : "OUT"),
      camera || stream_id || null,
      image_path || null,
      getISTTimestamp(time_str || timestamp || event_time),
      getISTTimestamp(timestamp || event_time),
      getISTTimestamp(event_time || timestamp),
      cameraId,
      locationId,
    ]
  );
}

/* ============================================================
 * SELECT — paginated with optional filters
 * ============================================================ */
export async function getEvents({ camera, stream_id, vehicle_type, direction, date, from_date, to_date, from, to, startDate, endDate, page = 1, limit = 100, zoneId, locationId } = {}) {
  const fromVal = from_date || from || startDate;
  const toVal = to_date || to || endDate;
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (camera) { conditions.push(`(e.camera = $${idx} OR e.stream_id = $${idx} OR c.camera_code = $${idx} OR c.camera_id::text = $${idx})`); values.push(camera); idx++; }
  if (stream_id) { conditions.push(`e.stream_id = $${idx++}`); values.push(stream_id); }
  if (vehicle_type) { conditions.push(`e.vehicle_type = $${idx++}`); values.push(vehicle_type); }
  if (direction) { conditions.push(`e.direction = $${idx++}`); values.push(direction); }
  if (locationId) { 
    if (isNaN(Number(locationId))) {
      conditions.push(`loc.name = $${idx++}`);
    } else {
      conditions.push(`c.location_id = $${idx++}`); 
    }
    values.push(locationId); 
  }
  if (zoneId) { 
    if (isNaN(Number(zoneId))) {
      conditions.push(`z.name = $${idx++}`);
    } else {
      conditions.push(`c.zone_id = $${idx++}`); 
    }
    values.push(zoneId); 
  }

  if (fromVal && toVal) {
    conditions.push(`DATE(e.event_time) >= $${idx++} AND DATE(e.event_time) <= $${idx++}`);
    values.push(fromVal, toVal);
  } else if (fromVal) {
    conditions.push(`DATE(e.event_time) >= $${idx++}`);
    values.push(fromVal);
  } else if (toVal) {
    conditions.push(`DATE(e.event_time) <= $${idx++}`);
    values.push(toVal);
  } else if (date) {
    conditions.push(`DATE(e.event_time) = $${idx++}`);
    values.push(date);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIdx = idx++;
  const offsetIdx = idx;
  values.push(limit, offset);

  return pool.query(
    `SELECT e.*, 
       COALESCE(loc.name, 'Unknown') AS location,
       COALESCE(z.name, 'Unknown') AS zone,
       COALESCE(c.name, c.camera_code, e.camera, 'Unknown') AS camera
     FROM in_out_events e
     LEFT JOIN cameras c ON (c.rtsp_url = e.stream_id OR c.camera_code = e.stream_id OR c.name = e.camera OR c.camera_code = e.camera OR (c.camera_id)::text = e.camera)
     LEFT JOIN locations loc ON c.location_id = loc.location_id
     LEFT JOIN zones z ON c.zone_id = z.zone_id
     ${where}
     ORDER BY e.event_time DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );
}

/* ============================================================
 * COUNTS — aggregated matching Python's counts shape:
 * { car_in, car_out, bike_in, bike_out, bus_in, bus_out,
 *   truck_in, truck_out, total_in, total_out }
 * ============================================================ */
export async function getCounts({ camera, date, from_date, to_date, zoneId, locationId }) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (camera) { conditions.push(`(e.camera = $${idx} OR e.stream_id = $${idx} OR c.camera_code = $${idx} OR c.camera_id::text = $${idx})`); values.push(camera); idx++; }
  if (from_date && to_date) {
    conditions.push(`DATE(e.event_time) >= $${idx++} AND DATE(e.event_time) <= $${idx++}`);
    values.push(from_date, to_date);
  } else if (from_date) {
    conditions.push(`DATE(e.event_time) >= $${idx++}`);
    values.push(from_date);
  } else if (to_date) {
    conditions.push(`DATE(e.event_time) <= $${idx++}`);
    values.push(to_date);
  } else if (date) { 
    conditions.push(`DATE(e.event_time) = $${idx++}`); 
    values.push(date); 
  }
  if (locationId) { 
    if (isNaN(Number(locationId))) {
      conditions.push(`loc.name = $${idx++}`);
    } else {
      conditions.push(`c.location_id = $${idx++}`); 
    }
    values.push(locationId); 
  }
  if (zoneId) { 
    if (isNaN(Number(zoneId))) {
      conditions.push(`z.name = $${idx++}`);
    } else {
      conditions.push(`c.zone_id = $${idx++}`); 
    }
    values.push(zoneId); 
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get per-type counts
  const rowResult = await pool.query(
    `SELECT
       e.vehicle_type,
       e.direction,
       COUNT(*) AS count
     FROM in_out_events e
     LEFT JOIN cameras c ON (c.rtsp_url = e.stream_id OR c.camera_code = e.stream_id OR c.name = e.camera OR c.camera_code = e.camera OR (c.camera_id)::text = e.camera)
     LEFT JOIN locations loc ON c.location_id = loc.location_id
     LEFT JOIN zones z ON c.zone_id = z.zone_id
     ${where}
     GROUP BY e.vehicle_type, e.direction
     ORDER BY e.vehicle_type, e.direction`,
    values
  );

  // Also get totals
  const totalsResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE e.direction = 'in')  AS total_in,
       COUNT(*) FILTER (WHERE e.direction = 'out') AS total_out
     FROM in_out_events e
     LEFT JOIN cameras c ON (c.rtsp_url = e.stream_id OR c.camera_code = e.stream_id OR c.name = e.camera OR c.camera_code = e.camera OR (c.camera_id)::text = e.camera)
     LEFT JOIN locations loc ON c.location_id = loc.location_id
     LEFT JOIN zones z ON c.zone_id = z.zone_id
     ${where}`,
    values
  );

  return { rows: rowResult.rows, totals: totalsResult.rows[0] || { total_in: 0, total_out: 0 } };
}
