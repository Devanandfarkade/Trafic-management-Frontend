import express from "express";
import { createDetection, listDetections, getStats } from "../controllers/heavyVehicleController.js";
import { processHeavyVehicleImage } from "../middlewares/heavyVehicleMiddleware.js";

const router = express.Router();

router.post("/", express.json({ limit: "20mb" }), processHeavyVehicleImage, createDetection);
router.get("/", listDetections);
router.get("/stats", getStats);

export default router;
