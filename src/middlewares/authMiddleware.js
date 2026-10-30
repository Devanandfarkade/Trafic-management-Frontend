import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  try {
    // =================================================
    // DEV MODE BYPASS (ONLY NON-PRODUCTION)
    // =================================================
    if (
      process.env.NODE_ENV !== "production" &&
      req.headers["x-user-id"]
    ) {
      const id = Number(req.headers["x-user-id"]);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid x-user-id header",
        });
      }

      req.user = {
        sub: id,
        user_id: id,
        email: req.headers["x-user-email"] || "dev@local.test",
        role: "Admin",
        role_id: 1,
      };

      return next();
    }

    // =================================================
    // JWT AUTH
    // =================================================
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token required (Bearer <token>)",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET not configured in environment");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = Number(decoded.sub || decoded.user_id || decoded.id);

    req.user = {
      sub: userId,
      user_id: userId,
      email: decoded.email,
      full_name: decoded.full_name,
      role: decoded.role,
      role_id: decoded.role_id,
    };

    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please refresh token or log in again.",
        isExpired: true,
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authorization token",
    });
  }
}

