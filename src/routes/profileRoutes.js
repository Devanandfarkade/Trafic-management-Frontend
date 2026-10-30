import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
} from "../controllers/profileController.js";

const router = express.Router();

/* ============================================================
 * PROFILE ENDPOINTS (AUTH REQUIRED)
 * ============================================================
 */

// Get current user profile
router.get("/me", authMiddleware, getProfile);
router.get("/", authMiddleware, getProfile);

// Update profile information (full_name, phone, about_me, gender)
router.put("/update", authMiddleware, updateProfile);
router.put("/", authMiddleware, updateProfile);

// Upload profile image / avatar
router.post(
  "/avatar",
  authMiddleware,
  upload.single("avatar"),
  uploadAvatar
);

// Security tab: change password
router.post("/change-password", authMiddleware, changePassword);

export default router;
