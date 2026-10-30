import { pool } from "../config/db.js";

/* ============================================================
 * DROPDOWN LOOKUP: Detection Statuses
 * ============================================================ */
export async function getDetectionStatuses() {
  const result = await pool.query(`
    SELECT status_id, status_name, is_active
    FROM public.criminal_detection_statuses
    WHERE is_active = true
    ORDER BY status_id ASC
  `);
  return result.rows;
}

/* ============================================================
 * CREATE CRIMINAL DETECTION RECORD
 * ============================================================ */
export async function createDetection(data) {
  let {
    criminal_id,
    detected_name,
    detected_alias,
    aadhaar_number,
    mugshot_path,
    is_matched,
    match_confidence,
    crime_category_id,
    severity_id,
    status_id,
    fir_number,
    camera_id,
    zone_id,
    location_id,
    detection_time,
    video_path,
    snapshot_path,
    created_by,
  } = data;

  // Clean Aadhaar if provided (must be strictly 12 digits or null to satisfy DB CHECK constraint)
  const cleanAadhaar = aadhaar_number
    ? String(aadhaar_number).replace(/\D/g, "")
    : null;
  let validAadhaar = cleanAadhaar && cleanAadhaar.length === 12 ? cleanAadhaar : null;

  const empId = (data.emp_id || data.employee_id || data.empId || "").toString().trim();

  // If criminal_id is not directly supplied, attempt automatic match from criminal_registration
  if (!criminal_id) {
    let reg = null;

    // 1. Try matching by emp_id (Python face recognition label)
    if (empId) {
      // Check criminal_record_code
      let regMatch = await pool.query(
        `SELECT * FROM public.criminal_registration 
         WHERE (criminal_record_code ILIKE $1 OR criminal_record_code ILIKE $2)
           AND is_active = true 
         ORDER BY criminal_id DESC LIMIT 1`,
        [empId, `%${empId}%`]
      );

      // Check numeric criminal_id
      if (regMatch.rows.length === 0 && !isNaN(parseInt(empId))) {
        regMatch = await pool.query(
          `SELECT * FROM public.criminal_registration 
           WHERE criminal_id = $1 AND is_active = true 
           ORDER BY criminal_id DESC LIMIT 1`,
          [parseInt(empId)]
        );
      }

      // Check aadhaar
      const cleanEmpAadhaar = empId.replace(/\D/g, "");
      if (regMatch.rows.length === 0 && cleanEmpAadhaar.length === 12) {
        regMatch = await pool.query(
          `SELECT * FROM public.criminal_registration 
           WHERE aadhaar_number = $1 AND is_active = true 
           ORDER BY criminal_id DESC LIMIT 1`,
          [cleanEmpAadhaar]
        );
      }

      // Check name (replace underscores with spaces)
      if (regMatch.rows.length === 0) {
        const normalizedName = empId.replace(/[_-]+/g, " ").trim();
        regMatch = await pool.query(
          `SELECT * FROM public.criminal_registration 
           WHERE (
             LOWER(TRIM(CONCAT(first_name, ' ', last_name))) ILIKE LOWER($1)
             OR LOWER(TRIM(first_name)) ILIKE LOWER($1)
             OR LOWER(TRIM(last_name)) ILIKE LOWER($1)
           ) AND is_active = true 
           ORDER BY criminal_id DESC LIMIT 1`,
          [normalizedName]
        );
      }

      if (regMatch.rows.length > 0) {
        reg = regMatch.rows[0];
      }
    }

    // 2. Try matching by valid Aadhaar
    if (!reg && validAadhaar) {
      const regMatch = await pool.query(
        `SELECT * FROM public.criminal_registration 
         WHERE aadhaar_number = $1 AND is_active = true 
         ORDER BY criminal_id DESC LIMIT 1`,
        [validAadhaar]
      );
      if (regMatch.rows.length > 0) {
        reg = regMatch.rows[0];
      }
    }

    // 3. Try matching by detected_name
    if (!reg && detected_name && detected_name.trim() && detected_name !== "Unidentified Suspect") {
      const cleanDetName = detected_name.replace(/[_-]+/g, " ").trim();
      const regMatch = await pool.query(
        `SELECT * FROM public.criminal_registration 
         WHERE (
           LOWER(TRIM(CONCAT(first_name, ' ', last_name))) = LOWER(TRIM($1))
           OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) ILIKE LOWER(TRIM($2))
           OR LOWER(TRIM(first_name)) ILIKE LOWER(TRIM($1))
         ) AND is_active = true 
         ORDER BY criminal_id DESC LIMIT 1`,
        [cleanDetName, `%${cleanDetName}%`]
      );
      if (regMatch.rows.length > 0) {
        reg = regMatch.rows[0];
      }
    }

    // Apply matched registration data
    if (reg) {
      criminal_id = reg.criminal_id;
      detected_name = detected_name && detected_name !== "Unidentified Suspect" ? detected_name : `${reg.first_name} ${reg.last_name}`.trim();
      detected_alias = detected_alias || reg.aliases;
      crime_category_id = crime_category_id || reg.crime_category_id;
      severity_id = severity_id || reg.severity_id;
      fir_number = fir_number || reg.fir_number;
      if (!validAadhaar && reg.aadhaar_number && reg.aadhaar_number.length === 12) {
        validAadhaar = reg.aadhaar_number;
      }
      is_matched = true;
    }
  }

  // Fallbacks for required foreign keys (category, severity, status)
  if (!crime_category_id) {
    const catRes = await pool.query(`SELECT crime_category_id FROM public.crime_categories LIMIT 1`);
    crime_category_id = catRes.rows[0]?.crime_category_id || 1;
  }

  if (!severity_id) {
    const sevRes = await pool.query(`SELECT severity_id FROM public.crime_severity_levels WHERE severity_name ILIKE 'Medium' LIMIT 1`);
    severity_id = sevRes.rows[0]?.severity_id || 1;
  }

  if (!status_id) {
    // Default to 'Alert Triggered' (status_id = 1)
    status_id = 1;
  }

  // Validate and resolve camera_id
  if (camera_id) {
    let camCheck = null;
    if (!isNaN(parseInt(camera_id))) {
      camCheck = await pool.query(
        `SELECT camera_id, zone_id, location_id, name, camera_code, camera_name 
         FROM public.cameras WHERE camera_id = $1`,
        [parseInt(camera_id)]
      );
    }
    if (!camCheck || camCheck.rows.length === 0) {
      camCheck = await pool.query(
        `SELECT camera_id, zone_id, location_id, name, camera_code, camera_name 
         FROM public.cameras 
         WHERE camera_code ILIKE $1 OR name ILIKE $1 OR camera_name ILIKE $1 LIMIT 1`,
        [`%${camera_id}%`]
      );
    }
    if (camCheck && camCheck.rows.length > 0) {
      camera_id = camCheck.rows[0].camera_id;
      zone_id = zone_id || camCheck.rows[0].zone_id;
      location_id = location_id || camCheck.rows[0].location_id;
    } else {
      camera_id = null;
    }
  } else {
    camera_id = null;
  }

  // Validate zone_id
  if (zone_id) {
    let zoneCheck = null;
    if (!isNaN(parseInt(zone_id))) {
      zoneCheck = await pool.query(`SELECT zone_id FROM public.zones WHERE zone_id = $1`, [parseInt(zone_id)]);
    }
    if (!zoneCheck || zoneCheck.rows.length === 0) {
      zoneCheck = await pool.query(`SELECT zone_id FROM public.zones WHERE name ILIKE $1 LIMIT 1`, [`%${zone_id}%`]);
    }
    zone_id = zoneCheck && zoneCheck.rows.length > 0 ? zoneCheck.rows[0].zone_id : null;
  } else {
    zone_id = null;
  }

  // Validate location_id
  if (location_id) {
    let locCheck = null;
    if (!isNaN(parseInt(location_id))) {
      locCheck = await pool.query(`SELECT location_id FROM public.locations WHERE location_id = $1`, [parseInt(location_id)]);
    }
    if (!locCheck || locCheck.rows.length === 0) {
      locCheck = await pool.query(`SELECT location_id FROM public.locations WHERE name ILIKE $1 LIMIT 1`, [`%${location_id}%`]);
    }
    location_id = locCheck && locCheck.rows.length > 0 ? locCheck.rows[0].location_id : null;
  } else {
    location_id = null;
  }

  // Match confidence validation
  let conf = match_confidence !== undefined && match_confidence !== null ? parseFloat(match_confidence) : null;
  if (conf !== null && (isNaN(conf) || conf < 0 || conf > 100)) {
    conf = Math.min(100, Math.max(0, isNaN(conf) ? 0 : conf));
  }

  const query = `
    INSERT INTO public.criminal_detections (
      criminal_id,
      detected_name,
      detected_alias,
      aadhaar_number,
      mugshot_path,
      is_matched,
      match_confidence,
      crime_category_id,
      severity_id,
      status_id,
      fir_number,
      camera_id,
      zone_id,
      location_id,
      detection_time,
      video_path,
      snapshot_path,
      is_active,
      created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
      COALESCE($15::timestamptz, CURRENT_TIMESTAMP),
      $16, $17, true, $18
    )
    RETURNING detection_id;
  `;

  const values = [
    criminal_id || null,
    detected_name || "Unidentified Suspect",
    detected_alias || null,
    validAadhaar,
    mugshot_path || null,
    is_matched ?? (criminal_id ? true : false),
    conf,
    crime_category_id,
    severity_id,
    status_id,
    fir_number || null,
    camera_id ? parseInt(camera_id) : null,
    zone_id ? parseInt(zone_id) : null,
    location_id ? parseInt(location_id) : null,
    detection_time || null,
    video_path || null,
    snapshot_path || null,
    created_by || null,
  ];

  const result = await pool.query(query, values);
  const newId = result.rows[0].detection_id;

  return getDetectionById(newId);
}

/* ============================================================
 * GET SINGLE DETECTION BY ID (WITH FULL JOINS)
 * ============================================================ */
export async function getDetectionById(detectionId) {
  const query = `
    SELECT 
      cd.detection_id,
      cd.criminal_id,
      cd.detected_name,
      cd.detected_alias,
      cd.aadhaar_number,
      cd.mugshot_path,
      cd.is_matched,
      cd.match_confidence,
      cd.crime_category_id,
      cd.severity_id,
      cd.status_id,
      cd.fir_number,
      cd.camera_id,
      cd.zone_id,
      cd.location_id,
      cd.detection_time,
      cd.video_path,
      cd.snapshot_path,
      cd.is_active,
      cd.created_at,
      cd.updated_at,
      cat.category_name,
      sev.severity_name,
      st.status_name,
      COALESCE(cam.name, cam.camera_name, cam.camera_code, CASE WHEN cd.camera_id IS NOT NULL THEN 'CAM-' || cd.camera_id ELSE NULL END) AS camera_name,
      COALESCE(loc.name, cam_loc.name) AS location_name,
      COALESCE(z.name, cam_z.name) AS zone_name,
      cr.criminal_record_code,
      cr.first_name AS reg_first_name,
      cr.last_name AS reg_last_name,
      cr.photo_path AS reg_photo_path,
      cr.video_path AS reg_video_path
    FROM public.criminal_detections cd
    LEFT JOIN public.criminal_registration cr ON (
      (cd.criminal_id IS NOT NULL AND cd.criminal_id = cr.criminal_id)
      OR (cd.aadhaar_number IS NOT NULL AND cd.aadhaar_number = cr.aadhaar_number)
    )
    LEFT JOIN public.crime_categories cat ON cd.crime_category_id = cat.crime_category_id
    LEFT JOIN public.crime_severity_levels sev ON cd.severity_id = sev.severity_id
    LEFT JOIN public.criminal_detection_statuses st ON cd.status_id = st.status_id
    LEFT JOIN public.cameras cam ON cd.camera_id = cam.camera_id
    LEFT JOIN public.zones z ON cd.zone_id = z.zone_id
    LEFT JOIN public.locations loc ON cd.location_id = loc.location_id
    LEFT JOIN public.zones cam_z ON cam.zone_id = cam_z.zone_id
    LEFT JOIN public.locations cam_loc ON cam.location_id = cam_loc.location_id
    WHERE cd.detection_id = $1;
  `;

  const result = await pool.query(query, [detectionId]);
  return result.rows[0] || null;
}

/* ============================================================
 * GET ALL DETECTIONS WITH SEARCH & FILTERS
 * ============================================================ */
export async function getAllDetections(filters = {}) {
  const {
    search,
    category_id,
    severity_id,
    status_id,
    camera_id,
    zone_id,
    location_id,
    is_matched,
    from_date,
    to_date,
    limit = 100,
    offset = 0,
  } = filters;

  const conditions = ["cd.is_active = true"];
  const params = [];
  let paramIdx = 1;

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      cd.detected_name ILIKE $${paramIdx} OR
      cd.detected_alias ILIKE $${paramIdx} OR
      cd.aadhaar_number ILIKE $${paramIdx} OR
      cd.fir_number ILIKE $${paramIdx} OR
      cr.criminal_record_code ILIKE $${paramIdx} OR
      cam.name ILIKE $${paramIdx} OR
      cam.camera_code ILIKE $${paramIdx} OR
      loc.name ILIKE $${paramIdx} OR
      cam_loc.name ILIKE $${paramIdx} OR
      z.name ILIKE $${paramIdx} OR
      cam_z.name ILIKE $${paramIdx} OR
      cat.category_name ILIKE $${paramIdx}
    )`);
    paramIdx++;
  }

  if (category_id && category_id !== "All") {
    params.push(category_id);
    conditions.push(`cd.crime_category_id = $${paramIdx++}`);
  }

  if (severity_id && severity_id !== "All") {
    params.push(severity_id);
    conditions.push(`cd.severity_id = $${paramIdx++}`);
  }

  if (status_id && status_id !== "All") {
    params.push(status_id);
    conditions.push(`cd.status_id = $${paramIdx++}`);
  }

  if (camera_id && camera_id !== "All") {
    params.push(camera_id);
    conditions.push(`cd.camera_id = $${paramIdx++}`);
  }

  if (zone_id && zone_id !== "All") {
    params.push(zone_id);
    conditions.push(`cd.zone_id = $${paramIdx++}`);
  }

  if (location_id && location_id !== "All") {
    params.push(location_id);
    conditions.push(`cd.location_id = $${paramIdx++}`);
  }

  if (is_matched !== undefined && is_matched !== null && is_matched !== "All") {
    params.push(is_matched === true || is_matched === "true");
    conditions.push(`cd.is_matched = $${paramIdx++}`);
  }

  if (from_date) {
    params.push(`${from_date} 00:00:00`);
    conditions.push(`cd.detection_time >= $${paramIdx++}::timestamp`);
  }

  if (to_date) {
    params.push(`${to_date} 23:59:59`);
    conditions.push(`cd.detection_time <= $${paramIdx++}::timestamp`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  // Query Total Count
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM public.criminal_detections cd
    LEFT JOIN public.criminal_registration cr ON cd.criminal_id = cr.criminal_id
    LEFT JOIN public.crime_categories cat ON cd.crime_category_id = cat.crime_category_id
    LEFT JOIN public.cameras cam ON cd.camera_id = cam.camera_id
    LEFT JOIN public.zones z ON cd.zone_id = z.zone_id
    LEFT JOIN public.locations loc ON cd.location_id = loc.location_id
    LEFT JOIN public.zones cam_z ON cam.zone_id = cam_z.zone_id
    LEFT JOIN public.locations cam_loc ON cam.location_id = cam_loc.location_id
    ${whereClause}
  `;
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || 0);

  // Query Rows with joins
  const query = `
    SELECT 
      cd.detection_id,
      cd.criminal_id,
      cd.detected_name,
      cd.detected_alias,
      cd.aadhaar_number,
      cd.mugshot_path,
      cd.is_matched,
      cd.match_confidence,
      cd.crime_category_id,
      cd.severity_id,
      cd.status_id,
      cd.fir_number,
      cd.camera_id,
      cd.zone_id,
      cd.location_id,
      cd.detection_time,
      cd.video_path,
      cd.snapshot_path,
      cd.is_active,
      cd.created_at,
      cat.category_name,
      sev.severity_name,
      st.status_name,
      COALESCE(cam.name, cam.camera_name, cam.camera_code, CASE WHEN cd.camera_id IS NOT NULL THEN 'CAM-' || cd.camera_id ELSE NULL END) AS camera_name,
      COALESCE(loc.name, cam_loc.name) AS location_name,
      COALESCE(z.name, cam_z.name) AS zone_name,
      cr.criminal_record_code,
      cr.first_name AS reg_first_name,
      cr.last_name AS reg_last_name,
      cr.photo_path AS reg_photo_path,
      cr.video_path AS reg_video_path
    FROM public.criminal_detections cd
    LEFT JOIN public.criminal_registration cr ON (
      (cd.criminal_id IS NOT NULL AND cd.criminal_id = cr.criminal_id)
      OR (cd.aadhaar_number IS NOT NULL AND cd.aadhaar_number = cr.aadhaar_number)
    )
    LEFT JOIN public.crime_categories cat ON cd.crime_category_id = cat.crime_category_id
    LEFT JOIN public.crime_severity_levels sev ON cd.severity_id = sev.severity_id
    LEFT JOIN public.criminal_detection_statuses st ON cd.status_id = st.status_id
    LEFT JOIN public.cameras cam ON cd.camera_id = cam.camera_id
    LEFT JOIN public.zones z ON cd.zone_id = z.zone_id
    LEFT JOIN public.locations loc ON cd.location_id = loc.location_id
    LEFT JOIN public.zones cam_z ON cam.zone_id = cam_z.zone_id
    LEFT JOIN public.locations cam_loc ON cam.location_id = cam_loc.location_id
    ${whereClause}
    ORDER BY cd.detection_time DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  params.push(limit, offset);
  const result = await pool.query(query, params);

  return {
    total,
    rows: result.rows,
  };
}

/* ============================================================
 * GET DETECTION STATS (KPI METRICS)
 * ============================================================ */
export async function getDetectionStats() {
  const query = `
    SELECT 
      COUNT(*) AS total_detections,
      COUNT(*) FILTER (WHERE detection_time::date = CURRENT_DATE) AS today_detections,
      COUNT(*) FILTER (WHERE is_matched = true) AS matched_detections,
      COUNT(*) FILTER (WHERE severity_id = 1 AND detection_time::date = CURRENT_DATE) AS critical_today,
      COUNT(DISTINCT camera_id) FILTER (WHERE detection_time::date = CURRENT_DATE) AS active_cameras_today
    FROM public.criminal_detections
    WHERE is_active = true;
  `;
  const result = await pool.query(query);
  return result.rows[0] || {};
}

/* ============================================================
 * UPDATE DETECTION STATUS
 * ============================================================ */
export async function updateDetectionStatus(detectionId, statusId, updatedBy = null) {
  const query = `
    UPDATE public.criminal_detections
    SET 
      status_id = $1,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = $2
    WHERE detection_id = $3 AND is_active = true
    RETURNING detection_id;
  `;
  const result = await pool.query(query, [statusId, updatedBy, detectionId]);
  if (result.rows.length === 0) return null;
  return getDetectionById(detectionId);
}

/* ============================================================
 * UPDATE DETECTION VIDEO EVIDENCE
 * ============================================================ */
export async function updateDetectionVideo(detectionId, videoPath) {
  const query = `
    UPDATE public.criminal_detections
    SET 
      video_path = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE detection_id = $2 AND is_active = true
    RETURNING detection_id;
  `;
  const result = await pool.query(query, [videoPath, detectionId]);
  if (result.rows.length === 0) return null;
  return getDetectionById(detectionId);
}

/* ============================================================
 * SOFT DELETE DETECTION
 * ============================================================ */
export async function deleteDetection(detectionId) {
  const query = `
    UPDATE public.criminal_detections
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE detection_id = $1
    RETURNING detection_id;
  `;
  const result = await pool.query(query, [detectionId]);
  return result.rows[0] || null;
}
