import * as reportService from "../services/reportService.js";

/* ============================================================
 * REPORT CONTROLLER
 * HTTP Request Handlers for Reports Module
 * ============================================================ */

/**
 * GET /api/reports
 * Query Params: module, startDate, endDate, fromDate, toDate, search, page, limit
 */
export async function getReports(req, res) {
  try {
    const {
      module = "no_parking",
      startDate,
      endDate,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 1000,
    } = req.query;

    const moduleParam = req.params.module || module;
    const start = startDate || fromDate || "";
    const end = endDate || toDate || "";

    const result = await reportService.getReports({
      module: moduleParam,
      startDate: start,
      endDate: end,
      search,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 1000,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ reportController.getReports:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching report data",
      error: error.message,
    });
  }
}

/**
 * GET /api/reports/:module/:id
 * Path Params: module, id
 */
export async function getReportById(req, res) {
  try {
    const { module, id } = req.params;
    if (!module || !id) {
      return res.status(400).json({
        success: false,
        message: "Both module and id parameter are required",
      });
    }

    const result = await reportService.getReportById(module, id);
    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ reportController.getReportById:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching report details",
      error: error.message,
    });
  }
}

/**
 * GET /api/reports/stats
 * Query Params: startDate, endDate, fromDate, toDate
 */
export async function getReportStats(req, res) {
  try {
    const { startDate, endDate, fromDate, toDate } = req.query;
    const start = startDate || fromDate || "";
    const end = endDate || toDate || "";

    const result = await reportService.getReportStats({ startDate: start, endDate: end });
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ reportController.getReportStats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching report stats",
      error: error.message,
    });
  }
}
