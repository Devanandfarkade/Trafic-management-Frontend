import { pool } from "../config/db.js";

/* ============================================================
 * LIVE TRAFFIC MANAGEMENT - USER MODEL (RAW SQL QUERIES ONLY)
 * ============================================================
 */

/* ==================== 1. USER LOOKUP ==================== */

// Find user by email (used for login, signup check, forgot password)
export const findUserByEmail = (email) => {
  return pool.query(
    `SELECT u.user_id, u.role_id, u.address_id, u.full_name, u.email, u.phone, 
            u.gender, u.password_hash, u.verification_status, u.is_verified, 
            u.is_active, u.created_at, u.last_login_at, u.about_me,
            CASE WHEN u.profile_image IS NOT NULL THEN convert_from(u.profile_image, 'UTF8') ELSE NULL END AS profile_image,
            r.role_name
     FROM users u
     LEFT JOIN roles r ON r.role_id = u.role_id
     WHERE LOWER(u.email) = LOWER($1)`,
    [email.trim()]
  );
};

// Find user by ID (used for token auth, session lookup)
export const findUserById = (userId) => {
  return pool.query(
    `SELECT u.user_id, u.role_id, u.address_id, u.full_name, u.email, u.phone, 
            u.gender, u.verification_status, u.is_verified, 
            u.is_active, u.created_at, u.last_login_at, u.about_me,
            CASE WHEN u.profile_image IS NOT NULL THEN convert_from(u.profile_image, 'UTF8') ELSE NULL END AS profile_image,
            r.role_name
     FROM users u
     LEFT JOIN roles r ON r.role_id = u.role_id
     WHERE u.user_id = $1`,
    [userId]
  );
};

// Get current password hash of a user
export const getUserPasswordHashById = (userId) => {
  return pool.query(
    "SELECT password_hash FROM users WHERE user_id = $1",
    [userId]
  );
};

/* ==================== 2. SIGN UP / REGISTRATION ==================== */

// Get all active roles dynamically from the database
export const getAllRoles = () => {
  return pool.query(
    "SELECT role_id, role_name, is_active FROM roles WHERE is_active = true ORDER BY role_id ASC"
  );
};

// Insert new registered user with dynamic role_id from roles table (defaults to Observer / active user role)
export const registerUser = ({ full_name, email, password_hash, role_id = null }) => {
  return pool.query(
    `INSERT INTO users (
        role_id, address_id, full_name, email, phone, gender, 
        password_hash, verification_status, is_active, is_verified, created_at
     )
     VALUES (
        COALESCE(
          $3,
          (SELECT role_id FROM roles WHERE role_name ILIKE '%observer%' AND is_active = true LIMIT 1),
          (SELECT role_id FROM roles WHERE role_name NOT ILIKE '%admin%' AND is_active = true ORDER BY role_id ASC LIMIT 1),
          (SELECT role_id FROM roles WHERE is_active = true ORDER BY role_id DESC LIMIT 1)
        ),
        0, $1, $2, NULL, 'Other', $4, 'PENDING', TRUE, FALSE, NOW()
     )
     RETURNING user_id, role_id, full_name, email, verification_status, is_active, created_at`,
    [full_name.trim(), email.trim().toLowerCase(), role_id, password_hash]
  );
};



// Mark user email verified
export const verifyUserEmail = (email) => {
  return pool.query(
    `UPDATE users 
     SET verification_status = 'VERIFIED', is_verified = TRUE, updated_at = NOW() 
     WHERE LOWER(email) = LOWER($1)
     RETURNING user_id, email, verification_status`,
    [email.trim()]
  );
};

export const markEmailVerified = verifyUserEmail;
export const createUser = registerUser;


// Update last login timestamp
export const updateLastLogin = (userId) => {
  return pool.query(
    "UPDATE users SET last_login_at = NOW() WHERE user_id = $1",
    [userId]
  );
};

export const findUserByLogin = findUserByEmail;

/* ==================== 3. EMAIL OTP QUERIES ==================== */

// Store OTP in email_otps table
export const storeOtp = (email, otp, purpose = "signup", expiresMinutes = 10) => {
  return pool.query(
    `INSERT INTO email_otps (email, otp, purpose, expires_at, used, created_at)
     VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval, FALSE, NOW())
     RETURNING otp_id, email, otp, purpose, expires_at`,
    [email.trim().toLowerCase(), String(otp).trim(), purpose, String(expiresMinutes)]
  );
};

export const storeEmailOtp = storeOtp;

// Find valid unused OTP
export const findValidOtp = (email, otp) => {
  return pool.query(
    `SELECT otp_id, email, otp, purpose, expires_at, used
     FROM email_otps
     WHERE LOWER(email) = LOWER($1)
       AND otp = $2
       AND used = FALSE
       AND expires_at > NOW()
     ORDER BY otp_id DESC
     LIMIT 1`,
    [email.trim(), String(otp).trim()]
  );
};

export const findValidEmailOtp = findValidOtp;

// Mark OTP as used
export const markOtpUsed = (otpId) => {
  return pool.query(
    "UPDATE email_otps SET used = TRUE WHERE otp_id = $1",
    [otpId]
  );
};

export const markEmailOtpUsed = markOtpUsed;


/* ==================== 4. PASSWORD RESET TOKENS ==================== */

// Store reset token
export const storePasswordResetToken = (token, email, expiresMinutes = 15) => {
  return pool.query(
    `INSERT INTO password_reset_tokens (reset_token, email, expires_at, used, created_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, FALSE, NOW())`,
    [token, email.trim().toLowerCase(), String(expiresMinutes)]
  );
};

// Find valid reset token
export const findValidPasswordResetToken = (token) => {
  return pool.query(
    `SELECT reset_token, email, expires_at, used
     FROM password_reset_tokens
     WHERE reset_token = $1
       AND used = FALSE
       AND expires_at > NOW()
     LIMIT 1`,
    [String(token).trim()]
  );
};

// Mark reset token used
export const markPasswordResetTokenUsed = (token) => {
  return pool.query(
    "UPDATE password_reset_tokens SET used = TRUE WHERE reset_token = $1",
    [String(token).trim()]
  );
};

// Update password by email (after forgot-password OTP & token verification)
export const updateUserPasswordByEmail = (email, passwordHash) => {
  return pool.query(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2)",
    [passwordHash, email.trim()]
  );
};

// Update password by user_id (security tab password change)
export const updateUserPasswordById = (userId, passwordHash) => {
  return pool.query(
    "UPDATE users SET password_hash = $1, updated_at = NOW(), updated_by = $2 WHERE user_id = $2",
    [passwordHash, userId]
  );
};

/* ==================== 5. SESSIONS ==================== */

// Create user session
export const createUserSession = (userId, sessionToken, userAgent = null, ipAddress = null) => {
  let validIp = null;
  if (ipAddress && typeof ipAddress === "string") {
    const cleaned = ipAddress.replace("::ffff:", "").trim();
    if (cleaned.length > 0 && cleaned !== "undefined") {
      validIp = cleaned;
    }
  }

  return pool.query(
    `INSERT INTO user_sessions (user_id, session_token, user_agent, ip_address, expires_at, created_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', NOW())
     RETURNING session_id, session_token, expires_at`,
    [userId, sessionToken, userAgent, validIp]
  );
};

// Find active session
export const findActiveSession = (sessionToken) => {
  return pool.query(
    `SELECT session_id, user_id, session_token, expires_at
     FROM user_sessions
     WHERE session_token = $1
       AND expires_at > NOW()`,
    [String(sessionToken).trim()]
  );
};

// Delete single session (logout)
export const deleteSession = (sessionToken) => {
  return pool.query(
    "DELETE FROM user_sessions WHERE session_token = $1",
    [String(sessionToken).trim()]
  );
};

// Delete all sessions for a user
export const deleteUserSessions = (userId) => {
  return pool.query("DELETE FROM user_sessions WHERE user_id = $1", [userId]);
};
