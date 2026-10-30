import express from "express";
import {
  listCameras,
  getCamerasByModule,
  createCamera,
  updateCamera,
  deleteCamera,
} from "../controllers/cameraController.js";

const router = express.Router();

router.get("/", listCameras);
router.get("/module/:module_type", getCamerasByModule);
router.post("/", createCamera);
router.put("/:id", updateCamera);
router.patch("/:id", updateCamera);
router.delete("/:id", deleteCamera);

export default router;
