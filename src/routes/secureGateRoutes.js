import express from "express";
import { createPerson, listPersons } from "../controllers/secureGateController.js";
import { processSecureGateImage } from "../middlewares/secureGatePersonMiddleware.js";

const router = express.Router();

/* ============================================================
 * SECURE GATE ROUTES
 * Mounted at: /api/secure-gate
 * ============================================================ */

// POST /api/secure-gate/persons
router.post("/persons", express.json({ limit: "50mb" }), processSecureGateImage, createPerson);

// GET /api/secure-gate/persons
router.get("/persons", listPersons);

export default router;
