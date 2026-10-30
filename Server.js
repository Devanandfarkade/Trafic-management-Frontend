import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";

import userRoutes from "./src/routes/userRoutes.js";
import profileRoutes from "./src/routes/profileRoutes.js";
import noParkingRoutes from "./src/routes/noParkingRoutes.js";
import inOutRoutes from "./src/routes/inOutRoutes.js";
import cameraRoutes from "./src/routes/cameraRoutes.js";
import locationRoutes from "./src/routes/locationRoutes.js";
import incidentRoutes from "./src/routes/incidentRoutes.js";
import sidemenuRoutes from "./src/routes/sidemenuRoutes.js";
import secureGateRoutes from "./src/routes/secureGateRoutes.js";
import alertRoutes from "./src/routes/alertRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import unknownPersonTrackingRoutes from "./src/routes/unknownPersonTrackingRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";
import featureRoutes from "./src/routes/featureRoutes.js";
import heavyVehicleRoutes from "./src/routes/heavyVehicleRoutes.js";
import secureGateTransportRoutes from "./src/routes/secureGateTransportRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import reportRoutes from "./src/routes/reportRoutes.js";
import criminalRegistrationRoutes from "./src/routes/criminalRegistrationRoutes.js";
import criminalDetectionRoutes from "./src/routes/criminalDetectionRoutes.js";

import { errorHandler } from "./src/middlewares/errorHandler.js";
import { pool } from "./src/config/db.js";

const app = express();

/* ================= CORS CONFIGURATION ================= */
app.use(
  cors({
    origin: (origin, callback) => callback(null, true), // allow any origin while supporting credentials
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

/* ================= REQUEST PARSING MIDDLEWARE ================= */
// Increased limit to 50MB to handle base64-encoded images from Python backend
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ================= UPLOADS DIRECTORY & STATIC SERVING ================= */
const uploadsRoot = path.resolve("uploads");
const uploadDirs = [
  "profile",
  "no-parking-detections",
  "in-out-detections",
  "incidents",
  "Secure-Gate-Person",
  "unknown-person-tracking",
  "heavy-vehicles",
  "Secure-Gate-Transport",
  "criminalRegistration",
  "criminalDetection",
];
uploadDirs.forEach((dir) => {
  const dirPath = path.join(uploadsRoot, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created: uploads/${dir}`);
  }
});
// Serve all uploads as static files with proper video streaming and CORS headers
app.use(
  "/uploads",
  express.static(uploadsRoot, {
    acceptRanges: true,
    cacheControl: true,
    maxAge: 0,
    setHeaders: (res, filePath) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      if (filePath.endsWith(".mp4")) {
        res.setHeader("Content-Type", "video/mp4");
      }
    },
  })
);

/* ================= API ROUTES ================= */
app.use("/api/users", userRoutes);
app.use("/api/auth", userRoutes); // Alias for auth routes
app.use("/api/profile", profileRoutes);
app.use("/api/no-parking", noParkingRoutes);
app.use("/api/in-out", inOutRoutes);
app.use("/api/cameras", cameraRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/ai-incident", incidentRoutes);
app.use("/api/sidemenu", sidemenuRoutes);
app.use("/api/secure-gate", secureGateRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/unknown-person-tracking", unknownPersonTrackingRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/heavy-vehicle", heavyVehicleRoutes);
app.use("/api/secure-gate-transport", secureGateTransportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/criminal-registration", criminalRegistrationRoutes);
app.use("/api/criminal-detection", criminalDetectionRoutes);

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Live Traffic Management Auth Backend is running 🚦🚀",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "Live Traffic Management API",
    status: "healthy",
  });
});

/* ================= GLOBAL ERROR HANDLER ================= */
app.use(errorHandler);

/* ================= SERVER START ================= */
import { seedNewModulesAndFeatures } from "./src/scripts/seedNewModulesAndFeatures.js";

const PORT = process.env.PORT || 8001;
app.listen(PORT, async () => {
  console.log(`\n======================================`);
  console.log(`✅ Auth Backend running on port ${PORT}`);
  console.log(`======================================\n`);
  seedNewModulesAndFeatures().catch(e => console.warn("Seeder notice:", e.message));
});

export default app;
