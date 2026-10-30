import express from "express";
import {
  createIncident,
  listIncidents,
  getIncidentById,
  getStats,
  updateStatus,
} from "../controllers/incidentController.js";
import { processIncidentImage } from "../middlewares/incidentMiddleware.js";

const router = express.Router();

/* ============================================================
 * INCIDENT ROUTES
 * Mounted at: /api/ai-incident
 * ============================================================ */

// POST /api/ai-incident/incidents — Add new AI Incident
router.post("/incidents", express.json({ limit: "50mb" }), processIncidentImage, createIncident);

// GET /api/ai-incident/incidents — List all incidents (paginated/filtered)
router.get("/incidents", listIncidents);

// GET /api/ai-incident/incidents/:id — Get incident by id
router.get("/incidents/:id", getIncidentById);

// GET /api/ai-incident/stats — Get summary stats
router.get("/stats", getStats);

// PATCH /api/ai-incident/incidents/:id/status — Update incident status
router.patch("/incidents/:id/status", express.json(), updateStatus);

export default router;
