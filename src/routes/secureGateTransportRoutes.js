import express from "express";
import { createLog, getLogs, deleteLog } from "../controllers/secureGateTransportController.js";
import { processSecureGateTransportImages } from "../middlewares/secureGateTransportMiddleware.js";

const router = express.Router();

/* ============================================================
 * SECURE GATE TRANSPORT ROUTES
 * Mounted at: /api/secure-gate-transport
 * ============================================================ */

// POST /api/secure-gate-transport/log — Add new transport log (from Python)
router.post("/log", processSecureGateTransportImages, createLog);

// GET /api/secure-gate-transport/logs — List all transport logs (paginated/filtered)
router.get("/logs", getLogs);

// DELETE /api/secure-gate-transport/logs/:id — Delete a log
router.delete("/logs/:id", deleteLog);

export default router;
