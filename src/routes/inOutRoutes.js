import express from "express";
import {
  createEvent,
  listEvents,
  getCounts,
} from "../controllers/inOutController.js";
import { inOutMiddleware } from "../middlewares/inOutMiddleware.js";

const router = express.Router();

/* ============================================================
 * IN-OUT DETECTION ROUTES
 * Mounted at: /api/in-out
 * ============================================================ */

/*
 * POST  /api/in-out/events
 * Runs inOutMiddleware to decode base64 image and save JPEG file to uploads\in-out-detections\
 * Sets req.body.image_path = uploads\in-out-detections\crossing_<timestamp>_<random>.jpg
 */
router.post("/events", inOutMiddleware, createEvent);

/* GET   /api/in-out/events   — Frontend fetches event log */
router.get("/events", listEvents);

/* GET   /api/in-out/counts   — Aggregated in/out counts by vehicle type */
router.get("/counts", getCounts);

export default router;
