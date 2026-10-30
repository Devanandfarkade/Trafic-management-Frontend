import express from "express";
import { getSidemenu } from "../controllers/sidemenuController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/sidemenu
// Requires authentication
router.get("/", authMiddleware, getSidemenu);

export default router;
