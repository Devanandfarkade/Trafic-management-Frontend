import { pool } from "../config/db.js";

/* ============================================================
 * DROPDOWN LOOKUP: Crime Categories
 * ============================================================ */
export async function getCrimeCategories() {
  try {
    const result = await pool.query(`
      SELECT 
        crime_category_id AS id,
        category_name AS name,
        is_active
      FROM public.crime_categories
      ORDER BY category_name ASC
    `);
    return result.rows;
  } catch (error) {
    console.warn("⚠️ Fallback query for crime_categories:", error.message);
    const fallback = await pool.query(`SELECT * FROM public.crime_categories`);
    return fallback.rows.map(r => ({
      id: r.crime_category_id || r.id,
      name: r.category_name || r.name,
      is_active: r.is_active ?? true
    }));
  }
}

export async function createCrimeCategory(categoryName) {
  const cleanName = String(categoryName || "").trim();
  if (!cleanName) {
    throw new Error("Category name is required");
  }

  if (/\d/.test(cleanName)) {
    throw new Error("Category name cannot contain numbers. Only letters and text are allowed.");
  }

  const existing = await pool.query(
    `SELECT crime_category_id AS id, category_name AS name, is_active FROM public.crime_categories WHERE LOWER(category_name) = LOWER($1)`,
    [cleanName]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO public.crime_categories (category_name, is_active)
     VALUES ($1, true)
     RETURNING crime_category_id AS id, category_name AS name, is_active`,
    [cleanName]
  );
  return result.rows[0];
}

/* ============================================================
 * DROPDOWN LOOKUP: Crime Severity Levels
 * ============================================================ */
export async function getSeverityLevels() {
  try {
    const result = await pool.query(`
      SELECT * FROM public.crime_severity_levels
      ORDER BY severity_id ASC
    `);
    return result.rows.map(r => ({
      id: r.severity_id || r.id,
      name: r.severity_name || r.level_name || r.name || `Level ${r.severity_id}`,
      description: r.description || null
    }));
  } catch (error) {
    console.error("❌ Error fetching crime_severity_levels:", error.message);
    return [];
  }
}

/* ============================================================
 * GET ALL REGISTERED CRIMINALS
 * ============================================================ */
export async function getAllCriminals(filters = {}) {
  const { category_id, severity_id, search, from_date, to_date, limit = 100, offset = 0 } = filters;

  const conditions = ["cr.is_active = true"];
  const params = [];
  let paramIdx = 1;

  if (category_id && category_id !== "All") {
    conditions.push(`cr.crime_category_id = $${paramIdx++}`);
    params.push(category_id);
  }

  if (severity_id && severity_id !== "All") {
    conditions.push(`cr.severity_id = $${paramIdx++}`);
    params.push(severity_id);
  }

  if (search && search.trim()) {
    conditions.push(`(
      cr.first_name ILIKE $${paramIdx} OR
      cr.last_name ILIKE $${paramIdx} OR
      cr.criminal_record_code ILIKE $${paramIdx} OR
      cr.aadhaar_number ILIKE $${paramIdx} OR
      cr.aliases ILIKE $${paramIdx} OR
      cr.fir_number ILIKE $${paramIdx}
    )`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  if (from_date) {
    conditions.push(`cr.registration_date >= $${paramIdx++}`);
    params.push(from_date);
  }

  if (to_date) {
    conditions.push(`cr.registration_date <= $${paramIdx++}`);
    params.push(to_date);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      cr.criminal_id,
      cr.first_name,
      cr.last_name,
      cr.criminal_record_code,
      cr.registration_date,
      cr.crime_category_id,
      cr.severity_id,
      cr.fir_number,
      cr.known_area_location,
      cr.aliases,
      cr.identification_marks,
      cr.aadhaar_number,
      cr.camera_id,
      cr.zone_id,
      cr.location_id,
      cr.photo_path,
      cr.video_path,
      cr.is_active,
      cr.created_at,
      cr.created_by,
      cr.updated_at,
      cr.updated_by,
      cat.category_name,
      z.name AS zone_name,
      loc.name AS location_name
    FROM public.criminal_registration cr
    LEFT JOIN public.crime_categories cat ON cr.crime_category_id = cat.crime_category_id
    LEFT JOIN public.zones z ON cr.zone_id = z.zone_id
    LEFT JOIN public.locations loc ON cr.location_id = loc.location_id
    ${whereClause}
    ORDER BY cr.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

/* ============================================================
 * GET SINGLE CRIMINAL BY ID OR CODE
 * ============================================================ */
export async function getCriminalById(idOrCode) {
  const strId = String(idOrCode).trim();
  const isNumeric = /^\d+$/.test(strId);
  const condition = isNumeric
    ? "cr.criminal_id = $1::bigint OR cr.criminal_record_code = $1::text"
    : "cr.criminal_record_code = $1::text";

  const query = `
    SELECT
      cr.*,
      cat.category_name,
      z.name AS zone_name,
      loc.name AS location_name
    FROM public.criminal_registration cr
    LEFT JOIN public.crime_categories cat ON cr.crime_category_id = cat.crime_category_id
    LEFT JOIN public.zones z ON cr.zone_id = z.zone_id
    LEFT JOIN public.locations loc ON cr.location_id = loc.location_id
    WHERE (${condition}) AND cr.is_active = true
    LIMIT 1
  `;

  const result = await pool.query(query, [strId]);
  return result.rows[0] || null;
}

/* ============================================================
 * INSERT CRIMINAL RECORD
 * ============================================================ */
export async function createCriminal(data) {
  const {
    first_name,
    last_name,
    criminal_record_code,
    registration_date,
    crime_category_id,
    severity_id,
    fir_number,
    known_area_location,
    aliases,
    identification_marks,
    aadhaar_number,
    camera_id,
    zone_id,
    location_id,
    photo_path,
    video_path,
    created_by
  } = data;

  // Check if a record with this code already exists
  const existing = await pool.query(
    `SELECT criminal_id, is_active FROM public.criminal_registration WHERE criminal_record_code = $1`,
    [criminal_record_code]
  );

  if (existing.rows.length > 0) {
    if (!existing.rows[0].is_active) {
      // Reactivate and update the soft-deleted record
      return updateCriminal(existing.rows[0].criminal_id, {
        ...data,
        is_active: true
      });
    } else {
      const err = new Error("Criminal record code already exists. Please choose a different code.");
      err.code = "23505";
      throw err;
    }
  }

  const query = `
    INSERT INTO public.criminal_registration (
      first_name,
      last_name,
      criminal_record_code,
      registration_date,
      crime_category_id,
      severity_id,
      fir_number,
      known_area_location,
      aliases,
      identification_marks,
      aadhaar_number,
      camera_id,
      zone_id,
      location_id,
      photo_path,
      video_path,
      created_by,
      is_active
    ) VALUES (
      $1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, true
    )
    RETURNING *;
  `;

  const values = [
    first_name,
    last_name,
    criminal_record_code,
    registration_date || null,
    crime_category_id,
    severity_id,
    fir_number || null,
    known_area_location || null,
    aliases || null,
    identification_marks || null,
    aadhaar_number,
    camera_id || null,
    zone_id || null,
    location_id || null,
    photo_path || null,
    video_path || null,
    created_by || null
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/* ============================================================
 * UPDATE CRIMINAL RECORD
 * ============================================================ */
export async function updateCriminal(idOrCode, data) {
  const strId = String(idOrCode).trim();
  const isNumeric = /^\d+$/.test(strId);
  const whereCondition = isNumeric
    ? "criminal_id = $1::bigint OR criminal_record_code = $1::text"
    : "criminal_record_code = $1::text";

  const fields = [];
  const values = [strId];
  let idx = 2;

  const allowedFields = [
    "first_name",
    "last_name",
    "criminal_record_code",
    "registration_date",
    "crime_category_id",
    "severity_id",
    "fir_number",
    "known_area_location",
    "aliases",
    "identification_marks",
    "aadhaar_number",
    "camera_id",
    "zone_id",
    "location_id",
    "photo_path",
    "video_path",
    "is_active",
    "updated_by"
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${idx++}`);
      values.push(data[field]);
    }
  }

  // Always update updated_at timestamp
  fields.push(`updated_at = CURRENT_TIMESTAMP`);

  if (fields.length === 1) {
    // Only updated_at, nothing to update
    return getCriminalById(strId);
  }

  const query = `
    UPDATE public.criminal_registration
    SET ${fields.join(", ")}
    WHERE ${whereCondition}
    RETURNING *;
  `;

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

/* ============================================================
 * SOFT DELETE CRIMINAL RECORD
 * ============================================================ */
export async function deleteCriminal(idOrCode) {
  const strId = String(idOrCode).trim();
  const isNumeric = /^\d+$/.test(strId);
  const whereCondition = isNumeric
    ? "criminal_id = $1::bigint OR criminal_record_code = $1::text"
    : "criminal_record_code = $1::text";

  const query = `
    UPDATE public.criminal_registration
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE ${whereCondition}
    RETURNING criminal_id, criminal_record_code;
  `;

  const result = await pool.query(query, [strId]);
  return result.rows[0] || null;
}

/* ============================================================
 * AUTO-GENERATE NEXT CRIMINAL RECORD CODE
 * If DB has "CR-001", next code is "CR-002"
 * ============================================================ */
export async function getNextCriminalCode() {
  const result = await pool.query(`
    SELECT criminal_record_code 
    FROM public.criminal_registration
  `);

  let maxNum = 0;
  let prefix = "CR-";

  for (const row of result.rows) {
    const code = (row.criminal_record_code || "").trim();
    const match = code.match(/^(?:([A-Za-z]+-?))?(\d+)$/);
    if (match) {
      if (match[1]) {
        prefix = match[1].includes("-") ? match[1] : `${match[1]}-`;
      }
      const num = parseInt(match[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  const paddedNum = String(nextNum).padStart(3, "0");
  return `${prefix}${paddedNum}`;
}

