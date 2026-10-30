import * as ProfileService from "../services/profileService.js";

/* ============================================================
 * 1. GET PROFILE INFORMATION
 * ============================================================
 */
export async function getProfile(req, res) {
  try {
    const userId = req.user?.sub || req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const data = await ProfileService.getUserProfileService(userId);

    if (!data.success) {
      return res.status(404).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("❌ Get Profile Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error retrieving profile",
      error: err.message,
    });
  }
}

/* ============================================================
 * 2. UPDATE PROFILE INFORMATION
 * ============================================================
 */
export async function updateProfile(req, res) {
  try {
    const userId = req.user?.sub || req.user?.user_id;
    const { full_name, phone, about_me, gender } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const result = await ProfileService.updateProfileService(userId, {
      full_name,
      phone,
      about_me,
      gender,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("❌ Update Profile Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error updating profile",
      error: err.message,
    });
  }
}

/* ============================================================
 * 3. UPLOAD PROFILE AVATAR
 * ============================================================
 */
export async function uploadAvatar(req, res) {
  try {
    const userId = req.user?.sub || req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided. Please upload an image (png, jpg, jpeg, webp).",
      });
    }

    const avatarUrl = `/uploads/profile/${req.file.filename}`;
    const result = await ProfileService.updateAvatarService(userId, avatarUrl);

    return res.status(200).json(result);
  } catch (err) {
    console.error("❌ Upload Avatar Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error uploading avatar",
      error: err.message,
    });
  }
}

/* ============================================================
 * 4. CHANGE PASSWORD (SECURITY TAB)
 * ============================================================
 */
export async function changePassword(req, res) {
  try {
    const userId = req.user?.sub || req.user?.user_id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one uppercase letter (A-Z)",
      });
    }

    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one lowercase letter (a-z)",
      });
    }

    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one number (0-9)",
      });
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one special character (!@#$%^&*...)",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as current password",
      });
    }

    const result = await ProfileService.changePasswordService(
      userId,
      currentPassword,
      newPassword
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("❌ Change Password Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error changing password",
      error: err.message,
    });
  }
}
