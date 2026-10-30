# Live Traffic Management - API Routes Quick Reference

## BASE URL
`http://localhost:8001` (or your configured `PORT` in `.env`)

---

## AUTHENTICATION & USER ENDPOINTS (`/api/users` or `/api/auth`)

```http
POST /api/users/register
# Register new user (Full Name, Email, Password, Confirm Password) -> sends OTP

POST /api/users/verify-email-otp
# Verify 6-digit OTP for signup or password reset

POST /api/users/resend-otp
# Resend OTP code to user's email

POST /api/users/login
# User Sign In (Email + Password) -> returns JWT Token, Refresh Token, User details

POST /api/users/forgot-password
# Request Password Reset OTP -> sends 6-digit reset code to email

POST /api/users/reset-password
# Reset password using verified reset token

POST /api/users/change-password
# Change password (Requires Bearer Token)

POST /api/users/refresh-token
# Refresh expired JWT token using refresh_token

POST /api/users/logout
# Invalidate session and logout
```

---

## PROFILE ENDPOINTS (`/api/profile`)

```http
GET /api/profile/me
# Retrieve logged-in user profile (Requires Bearer Token)

PUT /api/profile/update
# Update profile details: full_name, phone, about_me, gender (Requires Bearer Token)

POST /api/profile/avatar
# Upload user profile image/avatar (Requires Bearer Token + multipart/form-data: avatar)

POST /api/profile/change-password
# Change password from Profile Security tab (Requires Bearer Token)
```

---

## STATIC MEDIA ACCESS

```http
GET /uploads/profile/{filename}
# Public access to uploaded avatar images
```

---

## HEALTH CHECK

```http
GET /
# Health and status check
```
