import * as NoParkingModel from "../models/noParkingModel.js";
import { getISTDate } from "../utils/dateUtils.js";

/* ============================================================
 * ADD VIOLATION
 * Accepts the full violation object from Python no_parking_main.py:
 * {
 *   violation_id, stream_id, vehicle_id, plate,
 *   stationary, time,
 *   detector_confidence, best_confidence, ocr_confidence,
 *   violation_image_base64, vehicle_image, plate_crop,
 *   enhanced_plate, best_result, violation_image
 * }
 * Python sends this via REST POST or WebSocket latest_violation field
 * ============================================================ */
export async function addViolation(data) {
  const result = await NoParkingModel.insertViolation(data);
  const violation = result.rows[0] || null;
  return { success: true, violation };
}

/* ============================================================
 * GET VIOLATIONS (paginated, filterable by camera/stream_id/status/date)
 * ============================================================ */
export async function getViolations(filters = {}) {
  const result = await NoParkingModel.getViolations(filters);
  return {
    success: true,
    count: result.rowCount,
    violations: result.rows,
  };
}

/* ============================================================
 * GET STATS
 * Returns: { total, pending (UNRESOLVED), resolved, rejected }
 * Default to current date (today) in IST unless date='all'
 * ============================================================ */
export async function getStats(camera, date, zoneId, locationId) {
  const targetDate = date === "all" ? null : (date || getISTDate());
  const result = await NoParkingModel.getStats(camera, targetDate, zoneId, locationId);
  const row = result.rows[0] || {};
  return {
    success: true,
    date: targetDate || "all",
    stats: {
      total: parseInt(row.total || 0),
      pending: parseInt(row.pending || 0),
      resolved: parseInt(row.resolved || 0),
      rejected: parseInt(row.rejected || 0),
    },
  };
}

/* ============================================================
 * UPDATE VIOLATION STATUS
 * ============================================================ */
export async function updateViolationStatus(id, status) {
  const validStatuses = ["UNRESOLVED", "RESOLVED", "REJECTED", "PENDING", "ACKNOWLEDGED"];
  if (!validStatuses.includes(status)) {
    return {
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    };
  }
  const result = await NoParkingModel.updateViolationStatus(id, status);
  if (!result.rowCount) {
    return { success: false, message: "Violation not found" };
  }
  return { success: true, violation: result.rows[0] };
}
