import { pool } from "../config/db.js";

/* ============================================================
 * REPORT MODEL
 * Handles DB queries across traffic management modules
 * ============================================================ */

/**
 * Helper to build search condition
 */
function buildSearchCondition(search, fields, idxStart) {
  if (!search) return { sql: "", params: [], nextIdx: idxStart };
  const pattern = `%${search.trim()}%`;
  const conditions = fields.map((field) => `${field} ILIKE $${idxStart}`);
  return {
    sql: `(${conditions.join(" OR ")})`,
    params: [pattern],
    nextIdx: idxStart + 1,
  };
}

/* ============================================================
 * 1. NO PARKING REPORTS
 * ============================================================ */
export async function getNoParkingReports({ startDate, endDate, search, page = 1, limit = 1000 } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (startDate && endDate) {
    conditions.push(`DATE(v.detected_at) >= $${idx++} AND DATE(v.detected_at) <= $${idx++}`);
    values.push(startDate, endDate);
  } else if (startDate) {
    conditions.push(`DATE(v.detected_at) >= $${idx++}`);
    values.push(startDate);
  } else if (endDate) {
    conditions.push(`DATE(v.detected_at) <= $${idx++}`);
    values.push(endDate);
  }

  if (search) {
    const searchRes = buildSearchCondition(
      search,
      ["v.plate", "v.location", "cam.name", "v.status"],
      idx
    );
    conditions.push(searchRes.sql);
    values.push(...searchRes.params);
    idx = searchRes.nextIdx;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIdx = idx++;
  const offsetIdx = idx;
  values.push(limit, offset);

  const query = `
    SELECT DISTINCT ON (v.id)
      v.id,
      v.violation_id,
      v.tracker_id,
      v.plate,
      v.stationary,
      v.time,
      v.detected_at,
      v.status,
      v.violation_image_path,
      COALESCE(loc.name, v.location, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      cam.name AS camera_name,
      cam.camera_code,
      vh.registration_number AS vehicle_registration,
      vh.vehicle_type,
      vh.owner_name
    FROM no_parking_violations v
    LEFT JOIN cameras cam
      ON (cam.rtsp_url = v.rtsp_url OR cam.camera_code = v.camera OR cam.name = v.camera)
    LEFT JOIN locations loc
      ON (loc.location_id = cam.location_id OR loc.name = v.location)
    LEFT JOIN vehicles vh
      ON vh.vehicle_id = v.vehicle_id
    ${where}
    ORDER BY v.id DESC, v.detected_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT v.id) AS total
    FROM no_parking_violations v
    LEFT JOIN cameras cam
      ON (cam.rtsp_url = v.rtsp_url OR cam.camera_code = v.camera OR cam.name = v.camera)
    LEFT JOIN locations loc
      ON (loc.location_id = cam.location_id OR loc.name = v.location)
    ${where}
  `;

  const [res, countRes] = await Promise.all([
    pool.query(query, values),
    pool.query(countQuery, values.slice(0, values.length - 2)),
  ]);

  return {
    rows: res.rows,
    total: parseInt(countRes.rows[0]?.total || 0, 10),
  };
}

export async function getNoParkingReportById(id) {
  const numericId = parseInt(id, 10);
  const isNum = !isNaN(numericId) && String(numericId) === String(id).trim();
  const query = `
    SELECT
      v.*,
      COALESCE(loc.name, v.location, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      cam.name AS camera_name,
      cam.camera_code,
      vh.registration_number AS vehicle_registration,
      vh.vehicle_type,
      vh.owner_name
    FROM no_parking_violations v
    LEFT JOIN cameras cam
      ON (cam.rtsp_url = v.rtsp_url OR cam.camera_code = v.camera OR cam.name = v.camera)
    LEFT JOIN locations loc
      ON (loc.location_id = cam.location_id OR loc.name = v.location)
    LEFT JOIN vehicles vh
      ON vh.vehicle_id = v.vehicle_id
    WHERE ${isNum ? "v.id = $1 OR v.violation_id = $2" : "v.violation_id = $1"}
    LIMIT 1
  `;
  const values = isNum ? [numericId, String(id)] : [String(id)];
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

/* ============================================================
 * 2. IN / OUT COUNT REPORTS
 * ============================================================ */
export async function getInOutReports({ startDate, endDate, search, page = 1, limit = 1000 } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (startDate && endDate) {
    conditions.push(`DATE(e.event_time) >= $${idx++} AND DATE(e.event_time) <= $${idx++}`);
    values.push(startDate, endDate);
  } else if (startDate) {
    conditions.push(`DATE(e.event_time) >= $${idx++}`);
    values.push(startDate);
  } else if (endDate) {
    conditions.push(`DATE(e.event_time) <= $${idx++}`);
    values.push(endDate);
  }

  if (search) {
    const searchRes = buildSearchCondition(
      search,
      ["e.vehicle_type", "e.vehicle_display", "e.direction", "e.camera", "loc.name"],
      idx
    );
    conditions.push(searchRes.sql);
    values.push(...searchRes.params);
    idx = searchRes.nextIdx;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIdx = idx++;
  const offsetIdx = idx;
  values.push(limit, offset);

  const query = `
    SELECT
      e.id,
      e.event_id,
      e.stream_id,
      e.track_id,
      e.vehicle_type,
      e.vehicle_display,
      e.direction,
      e.direction_arrow,
      e.direction_text,
      e.camera,
      e.image_path,
      e.time_str,
      e.event_timestamp,
      e.event_time,
      COALESCE(loc.name, e.camera, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      cam.name AS camera_name
    FROM in_out_events e
    LEFT JOIN cameras cam
      ON (cam.rtsp_url = e.camera OR cam.camera_code = e.camera OR cam.name = e.camera)
    LEFT JOIN locations loc
      ON loc.location_id = cam.location_id
    ${where}
    ORDER BY e.event_time DESC, e.id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM in_out_events e
    LEFT JOIN cameras cam
      ON (cam.rtsp_url = e.camera OR cam.camera_code = e.camera OR cam.name = e.camera)
    LEFT JOIN locations loc
      ON loc.location_id = cam.location_id
    ${where}
  `;

  const [res, countRes] = await Promise.all([
    pool.query(query, values),
    pool.query(countQuery, values.slice(0, values.length - 2)),
  ]);

  return {
    rows: res.rows,
    total: parseInt(countRes.rows[0]?.total || 0, 10),
  };
}

export async function getInOutReportById(id) {
  const numericId = parseInt(id, 10);
  const isNum = !isNaN(numericId) && String(numericId) === String(id).trim();
  const query = `
    SELECT
      e.*,
      COALESCE(loc.name, e.camera, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      cam.name AS camera_name
    FROM in_out_events e
    LEFT JOIN cameras cam
      ON (cam.rtsp_url = e.camera OR cam.camera_code = e.camera OR cam.name = e.camera)
    LEFT JOIN locations loc
      ON loc.location_id = cam.location_id
    WHERE ${isNum ? "e.id = $1 OR e.event_id = $2" : "e.event_id = $1"}
    LIMIT 1
  `;
  const values = isNum ? [numericId, String(id)] : [String(id)];
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

/* ============================================================
 * 3. AI INCIDENT REPORTS
 * ============================================================ */
export async function getIncidentReports({ startDate, endDate, search, page = 1, limit = 1000 } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (startDate && endDate) {
    conditions.push(`DATE(i.detected_at) >= $${idx++} AND DATE(i.detected_at) <= $${idx++}`);
    values.push(startDate, endDate);
  } else if (startDate) {
    conditions.push(`DATE(i.detected_at) >= $${idx++}`);
    values.push(startDate);
  } else if (endDate) {
    conditions.push(`DATE(i.detected_at) <= $${idx++}`);
    values.push(endDate);
  }

  if (search) {
    const searchRes = buildSearchCondition(
      search,
      ["i.severity", "i.incident_type", "i.status", "loc.name", "cam.name"],
      idx
    );
    conditions.push(searchRes.sql);
    values.push(...searchRes.params);
    idx = searchRes.nextIdx;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIdx = idx++;
  const offsetIdx = idx;
  values.push(limit, offset);

  const query = `
    SELECT
      i.incident_id AS id,
      i.event_id,
      i.incident_type,
      i.severity,
      i.vehicles_involved,
      i.detected_at,
      i.status,
      COALESCE(loc.name, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      cam.name AS camera_name,
      cam.camera_code,
      ev.image_path
    FROM incidents i
    LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
    LEFT JOIN locations loc ON i.location_id = loc.location_id
    LEFT JOIN evidences ev ON i.event_id = ev.event_id AND ev.evidence_type = 'IMAGE'
    ${where}
    ORDER BY i.detected_at DESC, i.incident_id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM incidents i
    LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
    LEFT JOIN locations loc ON i.location_id = loc.location_id
    ${where}
  `;

  const [res, countRes] = await Promise.all([
    pool.query(query, values),
    pool.query(countQuery, values.slice(0, values.length - 2)),
  ]);

  return {
    rows: res.rows,
    total: parseInt(countRes.rows[0]?.total || 0, 10),
  };
}

export async function getIncidentReportById(id) {
  const numericId = parseInt(id, 10);
  const isNum = !isNaN(numericId) && String(numericId) === String(id).trim();
  const query = `
    SELECT
      i.incident_id AS id,
      i.event_id,
      i.incident_type,
      i.severity,
      i.vehicles_involved,
      i.detected_at,
      i.status,
      COALESCE(loc.name, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      cam.name AS camera_name,
      cam.camera_code,
      ev.image_path
    FROM incidents i
    LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
    LEFT JOIN locations loc ON i.location_id = loc.location_id
    LEFT JOIN evidences ev ON i.event_id = ev.event_id AND ev.evidence_type = 'IMAGE'
    WHERE ${isNum ? "i.incident_id = $1::bigint" : "i.incident_id::text = $1"}
    LIMIT 1
  `;
  const result = await pool.query(query, [isNum ? numericId : String(id)]);
  return result.rows[0] || null;
}

/* ============================================================
 * 4. HEAVY VEHICLE REPORTS
 * ============================================================ */
export async function getHeavyVehicleReports({ startDate, endDate, search, page = 1, limit = 1000 } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (startDate && endDate) {
    conditions.push(`DATE(hvv.detected_at) >= $${idx++} AND DATE(hvv.detected_at) <= $${idx++}`);
    values.push(startDate, endDate);
  } else if (startDate) {
    conditions.push(`DATE(hvv.detected_at) >= $${idx++}`);
    values.push(startDate);
  } else if (endDate) {
    conditions.push(`DATE(hvv.detected_at) <= $${idx++}`);
    values.push(endDate);
  }

  if (search) {
    const searchRes = buildSearchCondition(
      search,
      ["hvv.vehicle_type", "hvv.status", "loc.name", "cam.name"],
      idx
    );
    conditions.push(searchRes.sql);
    values.push(...searchRes.params);
    idx = searchRes.nextIdx;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIdx = idx++;
  const offsetIdx = idx;
  values.push(limit, offset);

  const query = `
    SELECT
      hvv.violation_id AS id,
      hvv.event_id,
      hvv.vehicle_type,
      hvv.confidence,
      hvv.detected_at,
      hvv.status,
      COALESCE(loc.name, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      cam.name AS camera_name,
      cam.camera_code,
      ev.image_path
    FROM heavy_vehicle_violations hvv
    LEFT JOIN cameras cam ON hvv.camera_id = cam.camera_id
    LEFT JOIN locations loc ON (hvv.location_id = loc.location_id OR cam.location_id = loc.location_id)
    LEFT JOIN evidences ev ON hvv.event_id = ev.event_id AND ev.evidence_type = 'IMAGE'
    ${where}
    ORDER BY hvv.detected_at DESC, hvv.violation_id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM heavy_vehicle_violations hvv
    LEFT JOIN cameras cam ON hvv.camera_id = cam.camera_id
    LEFT JOIN locations loc ON (hvv.location_id = loc.location_id OR cam.location_id = loc.location_id)
    ${where}
  `;

  const [res, countRes] = await Promise.all([
    pool.query(query, values),
    pool.query(countQuery, values.slice(0, values.length - 2)),
  ]);

  return {
    rows: res.rows,
    total: parseInt(countRes.rows[0]?.total || 0, 10),
  };
}

export async function getHeavyVehicleReportById(id) {
  const numericId = parseInt(id, 10);
  const isNum = !isNaN(numericId) && String(numericId) === String(id).trim();
  const query = `
    SELECT
      hvv.violation_id AS id,
      hvv.event_id,
      hvv.vehicle_type,
      hvv.confidence,
      hvv.detected_at,
      hvv.status,
      COALESCE(loc.name, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      cam.name AS camera_name,
      cam.camera_code,
      ev.image_path
    FROM heavy_vehicle_violations hvv
    LEFT JOIN cameras cam ON hvv.camera_id = cam.camera_id
    LEFT JOIN locations loc ON (hvv.location_id = loc.location_id OR cam.location_id = loc.location_id)
    LEFT JOIN evidences ev ON hvv.event_id = ev.event_id AND ev.evidence_type = 'IMAGE'
    WHERE ${isNum ? "hvv.violation_id = $1::bigint" : "hvv.violation_id::text = $1"}
    LIMIT 1
  `;
  const result = await pool.query(query, [isNum ? numericId : String(id)]);
  return result.rows[0] || null;
}

/* ============================================================
 * 5. OVERALL REPORT SUMMARY STATS
 * ============================================================ */
export async function getReportSummaryStats({ startDate, endDate } = {}) {
  const dateConds = (table, dateCol) => {
    if (startDate && endDate) return `WHERE DATE(${dateCol}) >= '${startDate}' AND DATE(${dateCol}) <= '${endDate}'`;
    if (startDate) return `WHERE DATE(${dateCol}) >= '${startDate}'`;
    if (endDate) return `WHERE DATE(${dateCol}) <= '${endDate}'`;
    return "";
  };

  const [noParking, inOut, incident, heavyVehicle] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total FROM no_parking_violations ${dateConds("no_parking_violations", "detected_at")}`),
    pool.query(`SELECT COUNT(*) AS total FROM in_out_events ${dateConds("in_out_events", "event_time")}`),
    pool.query(`SELECT COUNT(*) AS total FROM incidents ${dateConds("incidents", "detected_at")}`),
    pool.query(`SELECT COUNT(*) AS total FROM heavy_vehicle_violations ${dateConds("heavy_vehicle_violations", "detected_at")}`),
  ]);

  return {
    no_parking: parseInt(noParking.rows[0]?.total || 0, 10),
    in_out: parseInt(inOut.rows[0]?.total || 0, 10),
    incident: parseInt(incident.rows[0]?.total || 0, 10),
    heavy_vehicle: parseInt(heavyVehicle.rows[0]?.total || 0, 10),
  };
}
