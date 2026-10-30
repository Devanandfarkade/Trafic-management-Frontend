import express from "express";
import multer from "multer";
import {
  getDropdownMeta,
  getNextCode,
  addCategory,
  listCriminals,
  getCriminal,
  registerCriminal,
  updateCriminal,
  deleteCriminal,
} from "../controllers/criminalRegistrationController.js";

const router = express.Router();

// Configure Multer with memory storage so we can safely read body fields (firstName, lastName, aadhaar)
// to name the files properly as <name>-<adharcard number>.<ext>
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 150 * 1024 * 1024, // 150MB limit to comfortably support video and image uploads
  },
});

const mediaUpload = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);

/* ============================================================
 * CRIMINAL REGISTRATION ROUTES
 * Mounted at: /api/criminal-registration
 * ============================================================ */

/* GET    /api/criminal-registration/meta       — Dropdown options (crime categories, severity levels, next code) */
router.get("/meta", getDropdownMeta);

/* GET    /api/criminal-registration/next-code  — Auto-generate next sequential code */
router.get("/next-code", getNextCode);

/* POST   /api/criminal-registration/categories — Add a new crime category */
router.post("/categories", addCategory);

/* GET    /api/criminal-registration            — List registered criminals */
router.get("/", listCriminals);

/* GET    /api/criminal-registration/:id        — Get single criminal details */
router.get("/:id", getCriminal);

/* POST   /api/criminal-registration            — Register a criminal with image and video upload */
router.post("/", mediaUpload, registerCriminal);

/* PUT    /api/criminal-registration/:id        — Update criminal record */
router.put("/:id", mediaUpload, updateCriminal);

/* DELETE /api/criminal-registration/:id        — Delete criminal record */
router.delete("/:id", deleteCriminal);

export default router;
