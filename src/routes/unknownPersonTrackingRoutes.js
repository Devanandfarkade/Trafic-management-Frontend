import express from "express";
import { createPerson, listPersons } from "../controllers/unknownPersonTrackingController.js";
import { processUnknownPersonImage } from "../middlewares/unknownPersonTrackingMiddleware.js";

const router = express.Router();

/* ============================================================
 * UNKNOWN PERSON TRACKING ROUTES
 * Mounted at: /api/unknown-person-tracking
 * ============================================================ */

// POST /api/unknown-person-tracking/persons
router.post("/persons", express.json({ limit: "50mb" }), processUnknownPersonImage, createPerson);

// GET /api/unknown-person-tracking/persons
router.get("/persons", listPersons);

export default router;
