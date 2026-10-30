import express from "express";
import multer from "multer";
import {
  sseStream,
  createDetection,
  listDetections,
  getStats,
  getMeta,
  getDetection,
  updateStatus,
  deleteDetection,
  attachClip,
} from "../controllers/criminalDetectionController.js";

const router = express.Router();

// Configure Multer for file uploads (supports any field name without Multer unexpected field errors)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 150 * 1024 * 1024, // 150MB to support high-res video clips
  },
});

const mediaUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error("[CriminalDetection Multer Error]:", err);
      return res.status(400).json({ success: false, message: err.message, error: err });
    }
    if (Array.isArray(req.files)) {
      const fileMap = {};
      for (const file of req.files) {
        if (!fileMap[file.fieldname]) fileMap[file.fieldname] = [];
        fileMap[file.fieldname].push(file);
      }
      for (const [key, val] of Object.entries(fileMap)) {
        req.files[key] = val;
      }
    }
    next();
  });
};

/* ============================================================
 * CRIMINAL DETECTION API ROUTES
 * Mounted at: /api/criminal-detection
 * ============================================================ */

/* GET    /api/criminal-detection/stream     — Real-time Server-Sent Events (SSE) live threat feed */
router.get("/stream", sseStream);

/* GET    /api/criminal-detection/stats      — Real-time detection counters & KPIs */
router.get("/stats", getStats);

/* GET    /api/criminal-detection/meta       — Statuses, categories, severities metadata */
router.get("/meta", getMeta);

/* GET    /api/criminal-detection            — List all detection records with pagination & filters */
router.get("/", listDetections);

/* POST   /api/criminal-detection            — Ingest new criminal detection from Python/AI stream */
router.post("/", express.json({ limit: "50mb" }), mediaUpload, createDetection);

/* POST   /api/criminal-detection/:id/clip   — Attach video clip arriving from Python AI stream */
router.post("/:id/clip", express.json({ limit: "50mb" }), mediaUpload, attachClip);
router.post("/clip", express.json({ limit: "50mb" }), mediaUpload, attachClip);

/* GET    /api/criminal-detection/:id        — Get single detection record details */
router.get("/:id", getDetection);

/* PATCH  /api/criminal-detection/:id/status — Update detection alert status (Verified, Dispatched, etc.) */
router.patch("/:id/status", updateStatus);
router.put("/:id/status", updateStatus);

/* DELETE /api/criminal-detection/:id        — Soft delete detection record */
router.delete("/:id", deleteDetection);

export default router;
