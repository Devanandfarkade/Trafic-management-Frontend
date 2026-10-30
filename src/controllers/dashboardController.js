import * as DashboardService from "../services/dashboardService.js";

/* ============================================================
 * DASHBOARD CONTROLLER
 * GET /api/dashboard/stats?date=YYYY-MM-DD&from_date=...&to_date=...
 * ============================================================ */

export async function getStats(req, res) {
  try {
    const { date, from_date, to_date, fromDate, toDate, zone_id, location_id, camera_id } = req.query;
    const fDate = from_date || fromDate;
    const tDate = to_date || toDate;
    const result = await DashboardService.getStats(date, fDate, tDate, zone_id, location_id, camera_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ DashboardController.getStats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching dashboard stats",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/dashboard/in-out-summary
 * ============================================================ */
export async function getInOutSummary(req, res) {
  try {
    const { date, from_date, to_date, fromDate, toDate, zone_id, location_id, camera_id } = req.query;
    const fDate = from_date || fromDate;
    const tDate = to_date || toDate;
    const result = await DashboardService.getInOutSummary(date, fDate, tDate, zone_id, location_id, camera_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ DashboardController.getInOutSummary:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching in/out summary",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/dashboard/heavy-vehicle-summary
 * ============================================================ */
export async function getHeavyVehicleSummary(req, res) {
  try {
    const { date, from_date, to_date, fromDate, toDate, zone_id, location_id, camera_id } = req.query;
    const fDate = from_date || fromDate;
    const tDate = to_date || toDate;
    const result = await DashboardService.getHeavyVehicleSummary(date, fDate, tDate, zone_id, location_id, camera_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ DashboardController.getHeavyVehicleSummary:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching heavy vehicle summary",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/dashboard/live-violations
 * ============================================================ */
export async function getLiveViolations(req, res) {
  try {
    const { date, from_date, to_date, fromDate, toDate, limit, zone_id, location_id, camera_id } = req.query;
    const fDate = from_date || fromDate;
    const tDate = to_date || toDate;
    const result = await DashboardService.getLiveViolations(date, fDate, tDate, parseInt(limit) || 20, zone_id, location_id, camera_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ DashboardController.getLiveViolations:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching live violations",
      error: error.message,
    });
  }
}


