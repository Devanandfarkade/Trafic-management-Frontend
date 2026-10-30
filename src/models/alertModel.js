import { pool } from "../config/db.js";

export async function getAlerts({ limit = 100, date, from_date, to_date, from, to, startDate, endDate } = {}) {
  const fromVal = from_date || from || startDate;
  const toVal = to_date || to || endDate;

  const dateConditions = [];
  const values = [];
  let idx = 1;

  if (fromVal && toVal) {
    dateConditions.push(`DATE(time) >= $${idx++} AND DATE(time) <= $${idx++}`);
    values.push(fromVal, toVal);
  } else if (fromVal) {
    dateConditions.push(`DATE(time) >= $${idx++}`);
    values.push(fromVal);
  } else if (toVal) {
    dateConditions.push(`DATE(time) <= $${idx++}`);
    values.push(toVal);
  } else if (date && date !== "all") {
    dateConditions.push(`DATE(time) = $${idx++}`);
    values.push(date);
  }

  const whereClause = dateConditions.length ? `WHERE ${dateConditions.join(" AND ")}` : "";
  const limitIdx = idx++;
  values.push(limit);

  const query = `
    SELECT * FROM (
      SELECT 
        'INC-' || i.incident_id AS id, 
        COALESCE(i.incident_type, 'Incident') AS type,
        COALESCE(loc.name, 'Unknown') AS loc,
        i.detected_at AS time,
        COALESCE(i.severity, 'Medium') AS severity,
        COALESCE(i.status, 'Open') AS status,
        e.image_path AS image
      FROM incidents i
      LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
      LEFT JOIN locations loc ON i.location_id = loc.location_id
      LEFT JOIN evidences e ON i.event_id = e.event_id AND e.evidence_type = 'IMAGE'
      WHERE i.detected_at IS NOT NULL
      
      UNION ALL
      
      SELECT
        'NP-' || np.id AS id,
        'No Parking Violation' AS type,
        COALESCE(np.location, 'Unknown') AS loc,
        np.detected_at AS time,
        'Medium' AS severity,
        COALESCE(np.status, 'Ticketed') AS status,
        np.violation_image AS image
      FROM no_parking_violations np
      WHERE np.detected_at IS NOT NULL
      
      UNION ALL
      
      SELECT
        'HV-' || hv.violation_id AS id,
        'Heavy Vehicle' AS type,
        COALESCE(loc.name, 'Unknown') AS loc,
        hv.detected_at AS time,
        'High' AS severity,
        COALESCE(hv.status, 'Ticketed') AS status,
        e.image_path AS image
      FROM heavy_vehicle_violations hv
      LEFT JOIN locations loc ON hv.location_id = loc.location_id
      LEFT JOIN evidences e ON hv.event_id = e.event_id AND e.evidence_type = 'IMAGE'
      WHERE hv.detected_at IS NOT NULL
    ) AS combined_alerts
    ${whereClause}
    ORDER BY time DESC
    LIMIT $${limitIdx};
  `;

  try {
    const res = await pool.query(query, values);
    return res.rows;
  } catch (error) {
    // If heavy_vehicle_violations doesn't exist or is different, fallback
    console.error("Error in getAlerts (trying fallback):", error.message);
    const fallbackQuery = `
      SELECT * FROM (
        SELECT 
          'INC-' || i.incident_id AS id, 
          COALESCE(i.incident_type, 'Incident') AS type,
          COALESCE(loc.name, 'Unknown') AS loc,
          i.detected_at AS time,
          COALESCE(i.severity, 'Medium') AS severity,
          COALESCE(i.status, 'Open') AS status,
          e.image_path AS image
        FROM incidents i
        LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
        LEFT JOIN locations loc ON i.location_id = loc.location_id
        LEFT JOIN evidences e ON i.event_id = e.event_id AND e.evidence_type = 'IMAGE'
        WHERE i.detected_at IS NOT NULL
        
        UNION ALL
        
        SELECT
          'NP-' || np.id AS id,
          'No Parking Violation' AS type,
          COALESCE(np.location, 'Unknown') AS loc,
          np.detected_at AS time,
          'Medium' AS severity,
          COALESCE(np.status, 'Ticketed') AS status,
          np.violation_image AS image
        FROM no_parking_violations np
        WHERE np.detected_at IS NOT NULL
      ) AS combined_alerts
      ${whereClause}
      ORDER BY time DESC
      LIMIT $${limitIdx};
    `;

    const fallbackRes = await pool.query(fallbackQuery, values);
    return fallbackRes.rows;
  }
}