import * as UserService from "../services/userService.js";

/* ============================================================
 * 1. USER REGISTRATION / SIGN UP
 * ============================================================
 */
export async function registerUser(req, res) {
  try {
    const {
      full_name,
      email,
      password,
      confirmPassword,
      role_id,
    } = req.body;

    // Validation
    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const result = await UserService.registerUserService({
      full_name,
      email,
      password,
      confirmPassword,
      role_id: role_id || null,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("❌ Register Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: error.message,
    });
  }
}

/* ============================================================
 * 2. VERIFY EMAIL OTP
 * ============================================================
 */
export async function verifyEmailOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP code are required",
      });
    }

    const result = await UserService.verifyEmailOtpService(email, otp);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Verify OTP Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
      error: error.message,
    });
  }
}

/* ============================================================
 * 3. RESEND EMAIL OTP
 * ============================================================
 */
export async function resendEmailOtp(req, res) {
  try {
    const { email, purpose } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required",
      });
    }

    const result = await UserService.resendEmailOtpService(email, purpose || "signup");

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Resend OTP Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while resending OTP",
      error: error.message,
    });
  }
}

/* ============================================================
 * 4. SIGN IN / LOGIN
 * ============================================================
 */
export async function loginUser(req, res) {
  try {
    const { email, login, password, deviceName, deviceFingerprint } = req.body;

    if ((!email && !login) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await UserService.loginUserService({
      email: email || login,
      password,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip || req.socket.remoteAddress,
      deviceName,
      deviceFingerprint,
    });

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Login Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
}

/* ============================================================
 * 5. FORGOT PASSWORD (SEND OTP)
 * ============================================================
 */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required",
      });
    }

    const result = await UserService.forgotPasswordService(email);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Forgot Password Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during forgot password request",
      error: error.message,
    });
  }
}

/* ============================================================
 * 6. RESET PASSWORD (USING RESET TOKEN)
 * ============================================================
 */
export async function resetPassword(req, res) {
  try {
    const { reset_token, resetToken, newPassword, confirmPassword } = req.body;
    const token = reset_token || resetToken;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const result = await UserService.resetPasswordService(token, newPassword);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Reset Password Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during password reset",
      error: error.message,
    });
  }
}

/* ============================================================
 * 7. CHANGE PASSWORD (SECURITY TAB / PROFILE)
 * ============================================================
 */
export async function changePassword(req, res) {
  try {
    const userId = req.user?.sub || req.user?.user_id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in.",
      });
    }

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

    const result = await UserService.changePasswordService(
      userId,
      currentPassword,
      newPassword
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Change Password Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while changing password",
      error: error.message,
    });
  }
}

/* ============================================================
 * 8. REFRESH SESSION TOKEN
 * ============================================================
 */
export async function refreshSessionToken(req, res) {
  try {
    const { refresh_token, session_token } = req.body;
    const tokenToRefresh = refresh_token || session_token;

    if (!tokenToRefresh) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const result = await UserService.refreshSessionTokenService(
      tokenToRefresh,
      req.headers["user-agent"],
      req.ip || req.socket.remoteAddress
    );

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Refresh Token Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during token refresh",
      error: error.message,
    });
  }
}

/* ============================================================
 * 9. LOGOUT SESSION
 * ============================================================
 */
export async function logoutSession(req, res) {
  try {
    const { session_token, refresh_token } = req.body;
    const token = session_token || refresh_token;

    const result = await UserService.logoutSessionService(token);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Logout Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during logout",
      error: error.message,
    });
  }
}

/* ============================================================
 * 10. GET ACTIVE ROLES (DYNAMICALLY FROM DB)
 * ============================================================
 */
export async function getRoles(req, res) {
  try {
    const rolesRes = await UserService.getRolesService();
    return res.status(200).json(rolesRes);
  } catch (error) {
    console.error("❌ Get Roles Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error retrieving roles",
      error: error.message,
    });
  }
}

