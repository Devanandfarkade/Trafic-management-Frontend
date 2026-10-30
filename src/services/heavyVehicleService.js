import * as HeavyVehicleModel from "../models/heavyVehicleModel.js";
import { getISTDate } from "../utils/dateUtils.js";

/* ============================================================
 * HEAVY VEHICLE SERVICE
 * Follows routes -> controllers -> services -> models structure
 * ============================================================ */

export async function createDetection(data) {
  const result = await HeavyVehicleModel.insertHeavyVehicleDetection(data);
  return {
    success: true,
    message: "Heavy vehicle detection recorded",
    detection: result.rows[0],
  };
}

export async function getDetections(filters = {}) {
  const result = await HeavyVehicleModel.getHeavyVehicleDetections(filters);
  return {
    success: true,
    count: result.rowCount,
    detections: result.rows,
  };
}

export async function getStats(date, camera, zoneId, locationId) {
  // If date not provided, default to current date in IST
  const targetDate = date === "all" ? null : (date || getISTDate());
  const { rows, total } = await HeavyVehicleModel.getHeavyVehicleStats(targetDate, camera, zoneId, locationId);

  // Build a mapped dictionary for ease of use in frontend stats cards
  const countsByType = {
    total: total || 0,
    cement_mixer: 0,
    excavator: 0,
    roller_compactor: 0,
    tower_crane: 0,
    dump_truck: 0,
  };

  rows.forEach((row) => {
    const key = (row.vehicle_type || "").toLowerCase().trim().replace(/ /g, "_");
    const count = parseInt(row.total || 0, 10);
    countsByType[key] = count;
  });

  return {
    success: true,
    date: targetDate || "all",
    counts: countsByType,
    stats: rows,
  };
}
