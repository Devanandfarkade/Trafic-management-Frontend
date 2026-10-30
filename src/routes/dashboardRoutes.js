import express from "express";
import {
  getStats,
  getInOutSummary,
  getHeavyVehicleSummary,
  getLiveViolations,
} from "../controllers/dashboardController.js";

const router = express.Router();

/* GET /api/dashboard/stats?date=YYYY-MM-DD */
router.get("/stats", getStats);

/* GET /api/dashboard/in-out-summary?date=YYYY-MM-DD */
router.get("/in-out-summary", getInOutSummary);

/* GET /api/dashboard/heavy-vehicle-summary?date=YYYY-MM-DD */
router.get("/heavy-vehicle-summary", getHeavyVehicleSummary);

/* GET /api/dashboard/live-violations?date=YYYY-MM-DD&limit=20 */
router.get("/live-violations", getLiveViolations);

export default router;

