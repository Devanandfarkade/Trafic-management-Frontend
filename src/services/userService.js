import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import * as UserModel from "../models/userModel.js";
import { sendEmail, generateOtpEmailTemplate } from "../utils/mailer.js";

const SALT_ROUNDS = 12;

/* ============================================================
 * 1. USER REGISTRATION / SIGN UP
 * ============================================================
 */
export async function registerUserService({
  full_name,
  email,
  password,
  confirmPassword,
  role_id = null,
}) {
  try {
    // 1. Validation
    if (!full_name || !email || !password) {
      return {
        success: false,
        message: "Full name, email, and password are required",
      };
    }

    if (confirmPassword && password !== confirmPassword) {
      return {
        success: false,
        message: "Passwords do not match",
      };
    }

    if (password.length < 6) {
      return {
        success: false,
        message: "Password must be at least 6 characters long",
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return {
        success: false,
        message: "Invalid email address format",
      };
    }

    // 2. Check if user already exists
    const existing = await UserModel.findUserByEmail(email);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.verification_status === "VERIFIED" || user.is_verified) {
        return {
          success: false,
          message: "Email is already registered. Please sign in.",
        };
      } else {
        // User registered previously but not yet verified -> update password and resend OTP
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await UserModel.updateUserPasswordById(user.user_id, hashedPassword);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await UserModel.storeEmailOtp(email, otp, "signup", 10);

        await sendEmail(
          email,
          "Verify Your Account - Live Traffic Management",
          generateOtpEmailTemplate({
            otp,
            title: "Email Verification Code",
            message: "Thank you for creating an account with Live Traffic Management. Please enter the OTP below to complete your registration:",
          })
        );

        return {
          success: true,
          user_id: user.user_id,
          email: user.email,
          message: "A new verification OTP has been sent to your email address.",
        };
      }
    }

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Create User in Database (PENDING verification)
    const result = await UserModel.registerUser({
      full_name,
      email,
      password_hash: hashedPassword,
      role_id: role_id || null,
    });

    const newUser = result.rows[0];

    // 5. Generate 6-digit OTP and store in email_otps
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await UserModel.storeEmailOtp(email, otp, "signup", 10);

    // 6. Send Verification Email
    await sendEmail(
      email,
      "Verify Your Account - Live Traffic Management",
      generateOtpEmailTemplate({
        otp,
        title: "Email Verification Code",
        message: "Thank you for creating an account with Live Traffic Management. Please enter the OTP code below to verify your email and activate your account:",
      })
    );

    return {
      success: true,
      user_id: newUser.user_id,
      email: newUser.email,
      message: "Account created! Verification OTP has been sent to your email address.",
    };
  } catch (error) {
    console.error("❌ Register User Service Error:", error);
    return {
      success: false,
      message: "Registration failed: " + error.message,
    };
  }
}

/* ============================================================
 * 2. VERIFY EMAIL OTP (SIGNUP / RESET)
 * ============================================================
 */
export async function verifyEmailOtpService(email, otp) {
  try {
    if (!email || !otp) {
      return {
        success: false,
        message: "Email and OTP code are required",
      };
    }

    const otpRes = await UserModel.findValidEmailOtp(email, otp);
    if (!otpRes.rows.length) {
      return {
        success: false,
        message: "Invalid or expired OTP. Please request a new one.",
      };
    }

    const otpRecord = otpRes.rows[0];

    // Mark OTP as used
    await UserModel.markEmailOtpUsed(otpRecord.otp_id);

    // If purpose is signup, mark user as VERIFIED
    if (otpRecord.purpose === "signup") {
      await UserModel.markEmailVerified(email);

      return {
        success: true,
        message: "Email verified successfully! You can now sign in.",
        next: "login",
      };
    }

    // If purpose is reset, generate a secure reset token
    if (otpRecord.purpose === "reset") {
      const resetToken = crypto.randomBytes(32).toString("hex");
      await UserModel.storeResetToken(email, resetToken, 15);

      return {
        success: true,
        message: "OTP verified successfully. You may now reset your password.",
        reset_token: resetToken,
        next: "reset-password",
      };
    }

    return {
      success: true,
      message: "OTP verified successfully.",
    };
  } catch (error) {
    console.error("❌ Verify OTP Service Error:", error);
    return {
      success: false,
      message: "OTP verification failed: " + error.message,
    };
  }
}

/* ============================================================
 * 3. RESEND EMAIL OTP
 * ============================================================
 */
export async function resendEmailOtpService(email, purpose = "signup") {
  try {
    if (!email) {
      return {
        success: false,
        message: "Email address is required",
      };
    }

    const userRes = await UserModel.findUserByEmail(email);
    if (!userRes.rows.length) {
      return {
        success: false,
        message: "No account found with this email address",
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await UserModel.storeEmailOtp(email, otp, purpose, 10);

    const title = purpose === "reset" ? "Password Reset Code" : "Email Verification Code";
    const msg = purpose === "reset"
      ? "Here is your requested password reset OTP code:"
      : "Here is your new account verification OTP code:";

    await sendEmail(
      email,
      `${title} - Live Traffic Management`,
      generateOtpEmailTemplate({
        otp,
        title,
        message: msg,
      })
    );

    return {
      success: true,
      message: "A new OTP has been sent to your email address.",
    };
  } catch (error) {
    console.error("❌ Resend OTP Service Error:", error);
    return {
      success: false,
      message: "Failed to resend OTP: " + error.message,
    };
  }
}

/* ============================================================
 * 4. SIGN IN / LOGIN
 * ============================================================
 */
export async function loginUserService({
  login,
  email,
  password,
  userAgent = null,
  ipAddress = null,
  deviceName = null,
  deviceFingerprint = null,
}) {
  try {
    const loginIdentifier = (email || login || "").trim();

    if (!loginIdentifier || !password) {
      return {
        success: false,
        message: "Email and password are required",
      };
    }

    // 1. Find user in database
    const userRes = await UserModel.findUserByLogin(loginIdentifier);
    if (!userRes.rows.length) {
      return {
        success: false,
        message: "Invalid email or password",
      };
    }

    const user = userRes.rows[0];

    // 2. Check active status
    if (user.is_active === false) {
      return {
        success: false,
        message: "Account is disabled. Please contact the administrator.",
      };
    }

    // 3. Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return {
        success: false,
        message: "Invalid email or password",
      };
    }

    // 4. Update last login timestamp
    await UserModel.updateLastLogin(user.user_id);

    // 5. Generate JWT Access Token
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET environment variable is missing");
    }

    const tokenPayload = {
      sub: user.user_id,
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role_name || "User",
      role_id: user.role_id,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    // 6. Generate Session / Refresh Token
    const sessionToken = crypto.randomBytes(32).toString("hex");

    await UserModel.createUserSession(
      user.user_id,
      sessionToken,
      userAgent,
      ipAddress,
      deviceName,
      deviceFingerprint
    );

    return {
      success: true,
      message: "Login successful",
      token,
      session_token: sessionToken,
      refresh_token: sessionToken,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        about_me: user.about_me,
        role_id: user.role_id,
        role: user.role_name || "User",
        profile_image: user.profile_image,
        verification_status: user.verification_status,
      },
    };
  } catch (error) {
    console.error("❌ Login Service Error:", error);
    return {
      success: false,
      message: "An error occurred during login: " + error.message,
    };
  }
}

/* ============================================================
 * 5. FORGOT PASSWORD (SEND OTP)
 * ============================================================
 */
export async function forgotPasswordService(email) {
  try {
    if (!email) {
      return {
        success: false,
        message: "Email address is required",
      };
    }

    const userRes = await UserModel.findUserByEmail(email);
    if (!userRes.rows.length) {
      // Return clear error message
      return {
        success: false,
        message: "No account registered with this email address",
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await UserModel.storeEmailOtp(email, otp, "reset", 10);

    await sendEmail(
      email,
      "Password Reset Code - Live Traffic Management",
      generateOtpEmailTemplate({
        otp,
        title: "Password Reset Code",
        message: "We received a request to reset your password. Please use the following 6-digit OTP to proceed:",
      })
    );

    return {
      success: true,
      message: "Password reset OTP has been sent to your email address.",
    };
  } catch (error) {
    console.error("❌ Forgot Password Service Error:", error);
    return {
      success: false,
      message: "Failed to send reset OTP: " + error.message,
    };
  }
}

/* ============================================================
 * 6. RESET PASSWORD (USING RESET TOKEN)
 * ============================================================
 */
export async function resetPasswordService(resetToken, newPassword) {
  try {
    if (!resetToken || !newPassword) {
      return {
        success: false,
        message: "Reset token and new password are required",
      };
    }

    if (newPassword.length < 6) {
      return {
        success: false,
        message: "Password must be at least 6 characters long",
      };
    }

    // Verify reset token
    const tokenRes = await UserModel.findValidResetToken(resetToken);
    if (!tokenRes.rows.length) {
      return {
        success: false,
        message: "Invalid or expired password reset link/token",
      };
    }

    const tokenRecord = tokenRes.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update user password by email
    await UserModel.updateUserPasswordByEmail(tokenRecord.email, hashedPassword);

    // Mark reset token as used
    await UserModel.markResetTokenUsed(resetToken);

    // Invalidate old sessions for this user
    const userRes = await UserModel.findUserByEmail(tokenRecord.email);
    if (userRes.rows.length) {
      await UserModel.deleteUserSessions(userRes.rows[0].user_id);
    }

    return {
      success: true,
      message: "Password has been reset successfully. You can now sign in with your new password.",
    };
  } catch (error) {
    console.error("❌ Reset Password Service Error:", error);
    return {
      success: false,
      message: "Password reset failed: " + error.message,
    };
  }
}

/* ============================================================
 * 7. CHANGE PASSWORD (SECURITY TAB)
 * ============================================================
 */
export async function changePasswordService(userId, currentPassword, newPassword) {
  try {
    if (!userId || !currentPassword || !newPassword) {
      return {
        success: false,
        message: "Current password and new password are required",
      };
    }

    if (newPassword.length < 6) {
      return {
        success: false,
        message: "New password must be at least 6 characters long",
      };
    }

    // 1. Get stored password hash
    const passRes = await UserModel.getUserPasswordHashById(userId);
    if (!passRes.rows.length) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const storedHash = passRes.rows[0].password_hash;

    // 2. Compare current password
    const isMatch = await bcrypt.compare(currentPassword, storedHash);
    if (!isMatch) {
      return {
        success: false,
        message: "Current password is incorrect",
      };
    }

    // 3. Hash new password
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // 4. Update in database
    await UserModel.updateUserPasswordById(userId, newHash);

    // 5. Invalidate old sessions
    await UserModel.deleteUserSessions(userId);

    return {
      success: true,
      message: "Password updated successfully. Please sign in again if needed.",
    };
  } catch (error) {
    console.error("❌ Change Password Service Error:", error);
    return {
      success: false,
      message: "Error updating password: " + error.message,
    };
  }
}

/* ============================================================
 * 8. REFRESH SESSION TOKEN
 * ============================================================
 */
export async function refreshSessionTokenService(refreshToken, userAgent = null, ipAddress = null) {
  try {
    if (!refreshToken) {
      return {
        success: false,
        message: "Refresh token is required",
      };
    }

    const sessionRes = await UserModel.findActiveSession(refreshToken);
    if (!sessionRes.rows.length) {
      return {
        success: false,
        message: "Invalid or expired session. Please log in again.",
      };
    }

    const session = sessionRes.rows[0];
    const userId = session.user_id;

    // Delete old session
    await UserModel.deleteSession(refreshToken);

    // Create new session token
    const newSessionToken = crypto.randomBytes(32).toString("hex");
    await UserModel.createUserSession(userId, newSessionToken, userAgent, ipAddress);

    // Fetch user details for JWT
    const userRes = await UserModel.findUserById(userId);
    if (!userRes.rows.length) {
      return {
        success: false,
        message: "User account no longer exists",
      };
    }

    const user = userRes.rows[0];

    const tokenPayload = {
      sub: user.user_id,
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role_name || "User",
      role_id: user.role_id,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    return {
      success: true,
      token,
      refresh_token: newSessionToken,
      session_token: newSessionToken,
      user_id: user.user_id,
    };
  } catch (error) {
    console.error("❌ Refresh Token Service Error:", error);
    return {
      success: false,
      message: "Failed to refresh token: " + error.message,
    };
  }
}

/* ============================================================
 * 9. LOGOUT SESSION
 * ============================================================
 */
export async function logoutSessionService(sessionToken) {
  try {
    if (!sessionToken) {
      return {
        success: true,
        message: "Logged out",
      };
    }

    await UserModel.deleteSession(sessionToken);

    return {
      success: true,
      message: "Logged out successfully",
    };
  } catch (error) {
    console.error("❌ Logout Service Error:", error);
    return {
      success: false,
      message: "Logout failed: " + error.message,
    };
  }
}

/* ============================================================
 * 10. GET ACTIVE ROLES (DYNAMICALLY FROM DB)
 * ============================================================
 */
export async function getRolesService() {
  try {
    const roles = await UserModel.getAllRoles();
    return {
      success: true,
      roles: roles.rows,
    };
  } catch (error) {
    console.error("❌ Get Roles Service Error:", error);
    return {
      success: false,
      message: "Failed to fetch roles: " + error.message,
    };
  }
}


