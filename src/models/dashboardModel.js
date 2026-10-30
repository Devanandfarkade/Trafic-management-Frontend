import { pool } from "../config/db.js";

/* ============================================================
 * DASHBOARD MODEL
 * Aggregates metrics across cameras, in/out vehicles,
 * no-parking violations, heavy vehicles, and incidents.
 * ============================================================ */

function buildFilterClauses(columnName, fromDate, toDate, cameraId, locationId, zoneId, camAlias = 'c') {
  const params = [];
  let paramIdx = 1;
  let dateClause = '';
  let camClause = '';

  if (fromDate && toDate) {
    if (fromDate === toDate) {
      dateClause = ` AND DATE(${columnName}) = $${paramIdx}::date`;
      params.push(fromDate);
      paramIdx++;
    } else {
      dateClause = ` AND DATE(${columnName}) >= $${paramIdx}::date AND DATE(${columnName}) <= $${paramIdx + 1}::date`;
      params.push(fromDate, toDate);
      paramIdx += 2;
    }
  } else if (fromDate) {
    dateClause = ` AND DATE(${columnName}) = $${paramIdx}::date`;
    params.push(fromDate);
    paramIdx++;
  } else if (toDate) {
    dateClause = ` AND DATE(${columnName}) <= $${paramIdx}::date`;
    params.push(toDate);
    paramIdx++;
  }

  if (cameraId) {
    camClause += ` AND (${camAlias}.camera_code = $${paramIdx} OR ${camAlias}.camera_id::text = $${paramIdx})`;
    params.push(String(cameraId));
    paramIdx++;
  } else {
    if (locationId) {
      camClause += ` AND ${camAlias}.location_id = $${paramIdx}`;
      params.push(locationId);
      paramIdx++;
    }
    if (zoneId) {
      camClause += ` AND ${camAlias}.zone_id = $${paramIdx}`;
      params.push(zoneId);
      paramIdx++;
    }
  }

  return { dateClause, camClause, params };
}

export async function getDashboardStats(fromDate, toDate, zoneId = null, locationId = null, cameraId = null) {
  // 1. In-Out vehicles count
  const inOutFilters = buildFilterClauses('e.event_time', fromDate, toDate, cameraId, locationId, zoneId, 'c');
  const inOutQuery = `
    SELECT
      COUNT(*) FILTER (WHERE e.direction = 'in')  AS total_in,
      COUNT(*) FILTER (WHERE e.direction = 'out') AS total_out,
      COUNT(*)                                  AS total
    FROM in_out_events e
    LEFT JOIN cameras c ON (c.rtsp_url = e.stream_id OR c.camera_code = e.stream_id OR c.name = e.camera OR c.camera_code = e.camera OR (c.camera_id)::text = e.camera)
    WHERE 1=1 ${inOutFilters.dateClause} ${inOutFilters.camClause}
  `;

  // 2. Violations count
  const violFilters = buildFilterClauses('v.detected_at', fromDate, toDate, cameraId, locationId, zoneId, 'c');
  const violationsQuery = `
    SELECT
      COUNT(*)                                      AS total,
      COUNT(*) FILTER (WHERE v.status = 'UNRESOLVED') AS pending,
      COUNT(*) FILTER (WHERE v.status = 'RESOLVED')   AS resolved,
      COUNT(*) FILTER (WHERE v.status = 'REJECTED')   AS rejected
    FROM no_parking_violations v
    LEFT JOIN cameras c ON (c.rtsp_url = v.rtsp_url OR c.camera_code = v.camera OR c.name = v.camera OR c.camera_code = v.stream_id OR (c.camera_id)::text = v.camera)
    WHERE 1=1 ${violFilters.dateClause} ${violFilters.camClause}
  `;

  // 3. Cameras total and active
  const camFiltersOnly = buildFilterClauses('c.created_at', null, null, cameraId, locationId, zoneId, 'c');
  const camerasQuery = `
    SELECT
      COUNT(*)                                                AS total,
      COUNT(*) FILTER (WHERE isactive = true)                 AS active,
      COUNT(*) FILTER (WHERE isactive = false)                AS inactive
    FROM cameras c
    WHERE 1=1 ${camFiltersOnly.camClause}
  `;

  // 4. Cameras active with traffic activity
  const activeCamerasTodayQuery = `
    SELECT COUNT(DISTINCT cam_id) AS active_today
    FROM (
      SELECT COALESCE(v.camera, v.stream_id) AS cam_id 
      FROM no_parking_violations v 
      LEFT JOIN cameras c ON (c.rtsp_url = v.rtsp_url OR c.camera_code = v.camera OR c.name = v.camera OR c.camera_code = v.stream_id OR (c.camera_id)::text = v.camera)
      WHERE (v.camera IS NOT NULL OR v.stream_id IS NOT NULL) ${violFilters.dateClause} ${violFilters.camClause}
      UNION
      SELECT CAST(h.camera_id AS text) AS cam_id 
      FROM heavy_vehicle_violations h
      LEFT JOIN cameras c ON (c.camera_id = h.camera_id)
      WHERE h.camera_id IS NOT NULL ${buildFilterClauses('h.detected_at', fromDate, toDate, cameraId, locationId, zoneId, 'c').dateClause} ${buildFilterClauses('h.detected_at', fromDate, toDate, cameraId, locationId, zoneId, 'c').camClause}
      UNION
      SELECT COALESCE(e.camera, e.stream_id) AS cam_id 
      FROM in_out_events e
      LEFT JOIN cameras c ON (c.rtsp_url = e.stream_id OR c.camera_code = e.stream_id OR c.name = e.camera OR c.camera_code = e.camera OR (c.camera_id)::text = e.camera)
      WHERE (e.camera IS NOT NULL OR e.stream_id IS NOT NULL) ${inOutFilters.dateClause} ${inOutFilters.camClause}
    ) t
  `;

  // 5. Heavy vehicle detections
  const heavyFilters = buildFilterClauses('h.detected_at', fromDate, toDate, cameraId, locationId, zoneId, 'c');
  const heavyQuery = `
    SELECT
      COUNT(*)                                     AS total,
      COUNT(*) FILTER (WHERE h.status = 'DETECTED') AS detected,
      COUNT(*) FILTER (WHERE h.status = 'RESOLVED') AS resolved
    FROM heavy_vehicle_violations h
    LEFT JOIN cameras c ON (c.camera_id = h.camera_id)
    WHERE h.isactive = true ${heavyFilters.dateClause} ${heavyFilters.camClause}
  `;

  // 6. Active/Unresolved Alerts
  const incFilters = buildFilterClauses('i.detected_at', fromDate, toDate, cameraId, locationId, zoneId, 'c');
  const alertsTodayQuery = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT v.id 
      FROM no_parking_violations v 
      LEFT JOIN cameras c ON (c.rtsp_url = v.rtsp_url OR c.camera_code = v.camera OR c.name = v.camera OR c.camera_code = v.stream_id OR (c.camera_id)::text = v.camera)
      WHERE (v.status = 'UNRESOLVED' OR v.status IS NULL) ${violFilters.dateClause} ${violFilters.camClause}
      UNION ALL
      SELECT h.violation_id 
      FROM heavy_vehicle_violations h
      LEFT JOIN cameras c ON (c.camera_id = h.camera_id)
      WHERE (h.status = 'UNRESOLVED' OR h.status = 'DETECTED') ${heavyFilters.dateClause} ${heavyFilters.camClause}
      UNION ALL
      SELECT i.incident_id 
      FROM incidents i
      LEFT JOIN cameras c ON (c.camera_id = i.camera_id)
      WHERE (i.status = 'UNRESOLVED' OR i.status = 'DETECTED') ${incFilters.dateClause} ${incFilters.camClause}
    ) a
  `;

  const [inOutRes, violationsRes, camerasRes, activeCamsRes, heavyRes, alertsRes] = await Promise.all([
    pool.query(inOutQuery, inOutFilters.params),
    pool.query(violationsQuery, violFilters.params),
    pool.query(camerasQuery, camFiltersOnly.params),
    pool.query(activeCamerasTodayQuery, violFilters.params),
    pool.query(heavyQuery, heavyFilters.params),
    pool.query(alertsTodayQuery, violFilters.params),
  ]);

  return {
    inOut: inOutRes.rows[0] || { total_in: 0, total_out: 0, total: 0 },
    violations: violationsRes.rows[0] || { total: 0, pending: 0, resolved: 0, rejected: 0 },
    cameras: camerasRes.rows[0] || { total: 0, active: 0, inactive: 0 },
    activeCamerasToday: parseInt(activeCamsRes.rows[0]?.active_today || 0, 10),
    heavyVehicles: heavyRes.rows[0] || { total: 0, detected: 0, resolved: 0 },
    alertsToday: parseInt(alertsRes.rows[0]?.total || 0, 10),
  };
}

/* ============================================================
 * GET IN/OUT VEHICLE COUNT SUMMARY
 * ============================================================ */
export async function getDashboardInOutSummary(fromDate, toDate, zoneId = null, locationId = null, cameraId = null) {
  const filters = buildFilterClauses('e.event_time', fromDate, toDate, cameraId, locationId, zoneId, 'c');

  const query = `
    SELECT
      e.vehicle_type,
      e.direction,
      COUNT(*) AS count
    FROM in_out_events e
    LEFT JOIN cameras c ON (c.rtsp_url = e.stream_id OR c.camera_code = e.stream_id OR c.name = e.camera OR c.camera_code = e.camera OR (c.camera_id)::text = e.camera)
    WHERE 1=1 ${filters.dateClause} ${filters.camClause}
    GROUP BY e.vehicle_type, e.direction
  `;
  const totalsQuery = `
    SELECT
      COUNT(*) FILTER (WHERE e.direction = 'in')  AS total_in,
      COUNT(*) FILTER (WHERE e.direction = 'out') AS total_out,
      COUNT(*)                                  AS total
    FROM in_out_events e
    LEFT JOIN cameras c ON (c.rtsp_url = e.stream_id OR c.camera_code = e.stream_id OR c.name = e.camera OR c.camera_code = e.camera OR (c.camera_id)::text = e.camera)
    WHERE 1=1 ${filters.dateClause} ${filters.camClause}
  `;

  const [rowRes, totalsRes] = await Promise.all([
    pool.query(query, filters.params),
    pool.query(totalsQuery, filters.params),
  ]);

  return {
    rows: rowRes.rows,
    totals: totalsRes.rows[0] || { total_in: 0, total_out: 0, total: 0 },
  };
}

/* ============================================================
 * GET HEAVY VEHICLE DETECTIONS OVERVIEW
 * ============================================================ */
export async function getDashboardHeavyVehicleSummary(fromDate, toDate, zoneId = null, locationId = null, cameraId = null) {
  const filters = buildFilterClauses('h.detected_at', fromDate, toDate, cameraId, locationId, zoneId, 'c');

  const query = `
    SELECT
      h.vehicle_type,
      COUNT(*) AS total
    FROM heavy_vehicle_violations h
    LEFT JOIN cameras c ON (c.camera_id = h.camera_id)
    WHERE h.isactive = true ${filters.dateClause} ${filters.camClause}
    GROUP BY h.vehicle_type
    ORDER BY total DESC
  `;
  const totalQuery = `
    SELECT COUNT(*) AS total
    FROM heavy_vehicle_violations h
    LEFT JOIN cameras c ON (c.camera_id = h.camera_id)
    WHERE h.isactive = true ${filters.dateClause} ${filters.camClause}
  `;

  const [rowsRes, totalRes] = await Promise.all([
    pool.query(query, filters.params),
    pool.query(totalQuery, filters.params),
  ]);

  return {
    rows: rowsRes.rows,
    total: parseInt(totalRes.rows[0]?.total || 0, 10),
  };
}

/* ============================================================
 * GET LIVE VIOLATIONS
 * ============================================================ */
export async function getDashboardLiveViolations(fromDate, toDate, limit = 20, zoneId = null, locationId = null, cameraId = null) {
  const filters = buildFilterClauses('v.detected_at', fromDate, toDate, cameraId, locationId, zoneId, 'cam');
  
  const limitIdx = filters.params.length + 1;
  const paramsWithLimit = [...filters.params, limit];

  const query = `
    SELECT DISTINCT ON (v.id)
      v.*,
      COALESCE(loc.name, v.location, 'Unknown') AS location,
      loc.latitude,
      loc.longitude,
      cam.camera_id,
      vh.registration_number AS vehicle_registration,
      vh.vehicle_type,
      vh.owner_name
    FROM no_parking_violations v
    LEFT JOIN cameras cam
      ON (cam.rtsp_url = v.rtsp_url OR cam.camera_code = v.camera OR cam.name = v.camera OR cam.camera_code = v.stream_id OR (cam.camera_id)::text = v.camera)
    LEFT JOIN locations loc
      ON (loc.location_id = cam.location_id OR loc.name = v.location)
    LEFT JOIN vehicles vh
      ON vh.vehicle_id = v.vehicle_id
    WHERE 1=1 ${filters.dateClause} ${filters.camClause}
    ORDER BY v.id DESC, v.detected_at DESC
    LIMIT $${limitIdx}
  `;

  const res = await pool.query(query, paramsWithLimit);
  return res.rows;
}


