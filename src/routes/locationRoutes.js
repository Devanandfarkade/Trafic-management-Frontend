import express from "express";
import {
  listLocations, createLocation, updateLocation, deleteLocation, listCameraLocations,
  listZones, createZone, updateZone, deleteZone, listLocationsByZone,
} from "../controllers/locationController.js";

const router = express.Router();

/* ============================================================
 * ZONE ROUTES — /api/locations/zones/*
 * ============================================================ */
router.get("/zones", listZones);
router.post("/zones", express.json(), createZone);
router.put("/zones/:id", express.json(), updateZone);
router.delete("/zones/:id", deleteZone);

/* ============================================================
 * LOCATION ROUTES — /api/locations
 * ============================================================ */
router.get("/", listLocations);
router.post("/", express.json(), createLocation);
router.put("/:id", express.json(), updateLocation);
router.delete("/:id", deleteLocation);

// Locations filtered by zone (for Camera Management cascade dropdown)
router.get("/by-zone/:zone_id", listLocationsByZone);

// Camera distinct locations (for filter dropdowns in monitoring pages)
router.get("/cameras", listCameraLocations);
router.get("/cameras/:module_type", listCameraLocations);

export default router;

