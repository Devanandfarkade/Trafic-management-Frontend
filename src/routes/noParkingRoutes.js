import express from "express";
import {
  createViolation,
  listViolations,
  getStats,
  updateStatus,
} from "../controllers/noParkingController.js";
import { noParkingMiddleware } from "../middlewares/noParkingMiddleware.js";

const router = express.Router();

/* ============================================================
 * NO PARKING VIOLATION ROUTES
 * Mounted at: /api/no-parking
 * ============================================================ */

/*
 * POST   /api/no-parking/violations
 * Runs noParkingMiddleware to decode base64 image and save JPEG file to uploads\no-parking-detections\
 * Sets req.body.violation_image_path = uploads\no-parking-detections\violation_<timestamp>_<random>.jpg
 */
router.post("/violations", noParkingMiddleware, createViolation);

/* GET    /api/no-parking/violations  — Frontend fetches violation list */
router.get("/violations", listViolations);

/* GET    /api/no-parking/stats       — Summary counts */
router.get("/stats", getStats);

/* PATCH  /api/no-parking/violations/:id/status  — Update resolution */
router.patch("/violations/:id/status", updateStatus);

export default router;
