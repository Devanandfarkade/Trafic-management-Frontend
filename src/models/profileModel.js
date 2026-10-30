import { pool } from "../config/db.js";

/**
 * Get user profile information by user ID
 */
export function getUserProfile(userId) {
  return pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.phone, u.gender, u.about_me, 
            u.role_id, r.role_name,
            CASE WHEN u.profile_image IS NOT NULL THEN convert_from(u.profile_image, 'UTF8') ELSE NULL END AS profile_image,
            u.created_at, u.last_login_at
     FROM users u
     LEFT JOIN roles r ON r.role_id = u.role_id
     WHERE u.user_id = $1 AND u.is_active = true`,
    [userId]
  );
}

/**
 * Update user profile information (name, phone, about_me, gender)
 */
export function updateUserProfile(userId, data) {
  const { full_name, phone, about_me, gender } = data;
  return pool.query(
    `UPDATE users
     SET full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         about_me = COALESCE($3, about_me),
         gender = COALESCE($4, gender),
         updated_at = NOW(),
         updated_by = $5
     WHERE user_id = $5 AND is_active = true
     RETURNING user_id, full_name, email, phone, gender, about_me`,
    [
      full_name !== undefined ? full_name : null,
      phone !== undefined ? phone : null,
      about_me !== undefined ? about_me : null,
      gender !== undefined ? gender : null,
      userId,
    ]
  );
}

/**
 * Update user avatar path (stored in bytea column as UTF-8)
 */
export function updateAvatar(userId, avatarUrl) {
  return pool.query(
    `UPDATE users
     SET profile_image = convert_to($1, 'UTF8'),
         updated_at = NOW(),
         updated_by = $2
     WHERE user_id = $2
     RETURNING user_id`,
    [avatarUrl, userId]
  );
}

/**
 * Get user's current password hash for verification
 */
export function getUserPasswordHash(userId) {
  return pool.query(
    "SELECT password_hash FROM users WHERE user_id = $1",
    [userId]
  );
}

/**
 * Update user password
 */
export function updateUserPassword(userId, newPasswordHash) {
  return pool.query(
    `UPDATE users 
     SET password_hash = $1, 
         updated_at = NOW(), 
         updated_by = $2 
     WHERE user_id = $2`,
    [newPasswordHash, userId]
  );
}
