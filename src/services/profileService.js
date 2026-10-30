import * as ProfileModel from "../models/profileModel.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

/**
 * Retrieve user profile information
 */
export async function getUserProfileService(userId) {
  try {
    const result = await ProfileModel.getUserProfile(userId);

    if (!result.rows.length) {
      return { success: false, message: "User profile not found" };
    }

    const profile = result.rows[0];

    return {
      success: true,
      profile: {
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        gender: profile.gender,
        about_me: profile.about_me,
        role_id: profile.role_id,
        role: profile.role_name || "User",
        profile_image: profile.profile_image,
        created_at: profile.created_at,
        last_login_at: profile.last_login_at,
      },
    };
  } catch (error) {
    console.error("❌ Error in getUserProfileService:", error);
    throw error;
  }
}

/**
 * Update user profile information (name, phone, about_me, gender)
 */
export async function updateProfileService(userId, data) {
  try {
    const result = await ProfileModel.updateUserProfile(userId, data);

    if (!result.rows.length) {
      return { success: false, message: "Failed to update profile" };
    }

    return {
      success: true,
      message: "Profile updated successfully",
      profile: result.rows[0],
    };
  } catch (error) {
    console.error("❌ Error in updateProfileService:", error);
    throw error;
  }
}

/**
 * Update user avatar URL
 */
export async function updateAvatarService(userId, avatarUrl) {
  try {
    await ProfileModel.updateAvatar(userId, avatarUrl);
    return {
      success: true,
      avatar: avatarUrl,
      profile_image: avatarUrl,
      message: "Avatar updated successfully",
    };
  } catch (error) {
    console.error("❌ Error in updateAvatarService:", error);
    throw error;
  }
}

/**
 * Change user password from profile security tab
 */
export async function changePasswordService(userId, currentPassword, newPassword) {
  try {
    if (!currentPassword || !newPassword) {
      return {
        success: false,
        message: "Current password and new password are required",
      };
    }

    // 1. Get stored password hash
    const passRes = await ProfileModel.getUserPasswordHash(userId);
    if (!passRes.rows.length) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const storedHash = passRes.rows[0].password_hash;

    // 2. Compare passwords
    const isMatch = await bcrypt.compare(currentPassword, storedHash);
    if (!isMatch) {
      return {
        success: false,
        message: "Current password is incorrect",
      };
    }

    // 3. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // 4. Update in database
    await ProfileModel.updateUserPassword(userId, hashedPassword);

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    console.error("❌ Error in changePasswordService:", error);
    throw error;
  }
}
