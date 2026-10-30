import express from "express";
import {
  getReports,
  getReportById,
  getReportStats,
} from "../controllers/reportController.js";

const router = express.Router();

/* ============================================================
 * REPORT ROUTES
 * Mounted at: /api/reports
 * ============================================================ */

/* GET /api/reports/stats — Aggregated count stats per module */
router.get("/stats", getReportStats);

/* GET /api/reports — Main report query list */
router.get("/", getReports);

/* GET /api/reports/:module — Specific module report list */
router.get("/:module", getReports);

/* GET /api/reports/:module/:id — Specific record view detail */
router.get("/:module/:id", getReportById);

export default router;
