import express from "express";
import {
  registerUser,
  verifyEmailOtp,
  resendEmailOtp,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshSessionToken,
  logoutSession,
  getRoles,
} from "../controllers/userController.js";
import { getProfile } from "../controllers/profileController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/* ============================================================
 * AUTHENTICATION ENDPOINTS
 * ============================================================
 */

/* SIGN UP / REGISTRATION */
router.post("/register", registerUser);

/* OTP VERIFICATION & RESEND */
router.post("/verify-email-otp", verifyEmailOtp);
router.post("/resend-otp", resendEmailOtp);

/* SIGN IN / LOGIN */
router.post("/login", loginUser);

/* FORGOT & RESET PASSWORD */
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

/* PASSWORD CHANGE (AUTH REQUIRED) */
router.post("/change-password", authMiddleware, changePassword);

/* SESSION MANAGEMENT */
router.post("/refresh-token", refreshSessionToken);
router.post("/logout", logoutSession);

/* DYNAMIC ROLES LOOKUP */
router.get("/roles", getRoles);

/* CONVENIENCE ALIASES */
router.get("/profile", authMiddleware, getProfile);

export default router;

