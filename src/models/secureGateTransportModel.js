import { pool } from "../config/db.js";
import { getISTTimestamp } from "../utils/dateUtils.js";

/* ============================================================
 * INSERT LOG
 * Resolves camera_id from the cameras table via RTSP URL lookup
 * (same pattern as secureGateModel.js)
 * ============================================================ */
export async function insertLog(data) {
  const client = await pool.connect();
  try {
    // Resolve camera_id and location_id from the stream's RTSP URL sent by Python
    let cameraId = data.camera_id || null;
    let locationId = data.location_id || null;
    if ((!cameraId || !locationId) && data.stream_id) {
      const camRes = await client.query(
        `SELECT camera_id, location_id FROM cameras WHERE rtsp_url = $1 OR camera_code = $1 LIMIT 1`,
        [data.stream_id]
      );
      if (!cameraId) cameraId = camRes.rows[0]?.camera_id || null;
      if (!locationId) locationId = camRes.rows[0]?.location_id || null;
    }

    const query = `
      INSERT INTO secure_gate_transport (
        camera_id, location_id, entry_id, stream_id, vehicle_id, plate, time, timestamp,
        detector_confidence, best_confidence, ocr_confidence,
        vehicle_image, plate_crop, enhanced_plate, best_result, entry_image
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING *;
    `;
    const values = [
      cameraId,
      locationId,
      data.entry_id,
      data.stream_id,
      data.vehicle_id,
      data.plate,
      getISTTimestamp(data.time),
      getISTTimestamp(data.timestamp),
      data.detector_confidence || 0,
      data.best_confidence || 0,
      data.ocr_confidence || 0,
      data.vehicle_image_path || null,
      data.plate_crop_path || null,
      data.enhanced_plate_path || null,
      data.best_result_path || null,
      data.entry_image_path || null,
    ];
    const res = await client.query(query, values);
    return { rows: res.rows };
  } finally {
    client.release();
  }
}

/* ============================================================
 * GET LOGS
 * ============================================================ */
export async function getLogs(filters = {}) {
  let query = `SELECT sgt.*, cam.name AS camera_name FROM secure_gate_transport sgt LEFT JOIN cameras cam ON sgt.camera_id = cam.camera_id OR (cam.rtsp_url = sgt.stream_id OR cam.camera_code = sgt.stream_id)`;
  let countQuery = `SELECT COUNT(*) FROM secure_gate_transport sgt LEFT JOIN cameras cam ON sgt.camera_id = cam.camera_id OR (cam.rtsp_url = sgt.stream_id OR cam.camera_code = sgt.stream_id)`;
  const values = [];
  const whereClauses = [];

  if (filters.stream_id) {
    values.push(filters.stream_id);
    whereClauses.push(`(sgt.stream_id = $${values.length} OR cam.camera_id::text = $${values.length})`);
  }

  if (filters.plate) {
    values.push(`%${filters.plate}%`);
    whereClauses.push(`sgt.plate ILIKE $${values.length}`);
  }

  if (filters.locationId) {
    values.push(filters.locationId);
    whereClauses.push(`cam.location_id = $${values.length}`);
  }

  if (filters.zoneId) {
    values.push(filters.zoneId);
    whereClauses.push(`cam.zone_id = $${values.length}`);
  }

  if (whereClauses.length > 0) {
    const whereStr = ` WHERE ` + whereClauses.join(" AND ");
    query += whereStr;
    countQuery += whereStr;
  }

  query += ` ORDER BY sgt.created_at DESC`;

  const limit = filters.limit ? parseInt(filters.limit) : 50;
  const page = filters.page ? parseInt(filters.page) : 1;
  const offset = (page - 1) * limit;

  const countValues = [...values]; // Values for count query
  
  values.push(limit);
  query += ` LIMIT $${values.length}`;
  
  values.push(offset);
  query += ` OFFSET $${values.length}`;

  const [dataResult, countResult] = await Promise.all([
    pool.query(query, values),
    pool.query(countQuery, countValues)
  ]);

  return { rows: dataResult.rows, count: parseInt(countResult.rows[0].count) };
}

/* ============================================================
 * DELETE LOG
 * ============================================================ */
export async function deleteLog(id) {
  return pool.query(`DELETE FROM secure_gate_transport WHERE log_id = $1 RETURNING log_id`, [id]);
}
