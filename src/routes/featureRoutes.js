import express from "express";
import {
  listFeatures, createFeature, updateFeature, deleteFeature,
  getCameraFeatures, setCameraFeatures, toggleFeatureMapping,
} from "../controllers/featureController.js";

const router = express.Router();

// Features CRUD
router.get("/", listFeatures);                                     // GET /api/features?category_id=2
router.post("/", express.json(), createFeature);                   // POST /api/features
router.put("/:id", express.json(), updateFeature);                 // PUT /api/features/:id
router.delete("/:id", deleteFeature);                              // DELETE /api/features/:id

// Camera-Feature Mapping
router.get("/camera/:camera_id", getCameraFeatures);               // GET /api/features/camera/:id
router.post("/camera/:camera_id", express.json(), setCameraFeatures); // POST /api/features/camera/:id
router.patch("/mapping/:mapping_id/toggle", express.json(), toggleFeatureMapping); // PATCH /api/features/mapping/:id/toggle

export default router;
