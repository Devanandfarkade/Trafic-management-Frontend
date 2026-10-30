import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../..");
const uploadDir = path.join(backendRoot, "uploads", "no-parking-detections");

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Middleware for No Parking Detections image processing.
 *
 * Python sends violation_image_base64 (base64 JPEG string).
 * This middleware:
 *  1. Decodes violation_image_base64 → saves .jpg to uploads/no-parking-detections/
 *  2. Sets req.body.violation_image_path = relative path for DB storage
 *  3. Removes violation_image_base64 from body (too large for DB)
 *
 * NOTE: Python also sends `vehicle_image` and `violation_image` as LOCAL file paths
 * on the Python server — those are NOT base64. We preserve them as-is.
 */
export function noParkingMiddleware(req, res, next) {
  try {
    if (Array.isArray(req.body)) {
      req.body = req.body.map(processNoParkingItem);
    } else if (req.body && typeof req.body === "object") {
      req.body = processNoParkingItem(req.body);
    }
    next();
  } catch (err) {
    console.error("❌ noParkingMiddleware error:", err.message);
    next(err);
  }
}

function processNoParkingItem(item) {
  if (!item) return item;

  // Only violation_image_base64 is the actual base64 image from Python.
  // vehicle_image and violation_image are LOCAL file paths on the Python server — NOT base64.
  const base64Data = item.violation_image_base64;

  if (!base64Data || typeof base64Data !== "string" || base64Data.trim() === "") {
    console.log(
      `⚠️ noParkingMiddleware: No base64 image (violation_image_base64) in payload for violation ${
        item.vehicle_id || item.violation_id || "unknown"
      }`
    );
    // Still clean up the field to avoid DB insertion errors
    const cleaned = { ...item };
    delete cleaned.violation_image_base64;
    return cleaned;
  }

  try {
    // Strip data URI prefix if present (e.g. "data:image/jpeg;base64,...")
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(raw, "base64");

    if (!buffer || buffer.length < 100) {
      console.warn(
        `⚠️ noParkingMiddleware: Buffer too small (${buffer?.length ?? 0} bytes) for violation ${
          item.vehicle_id || item.violation_id || "unknown"
        } — skipping image save`
      );
      const cleaned = { ...item };
      delete cleaned.violation_image_base64;
      return cleaned;
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const filename = `violation_${timestamp}_${random}.jpg`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, buffer);

    // Use forward-slash relative path for cross-platform URL serving
    const relativePath = `uploads/no-parking-detections/${filename}`;

    console.log(`📸 Image saved: ${relativePath} (${buffer.length} bytes)`);

    const updated = { ...item, violation_image_path: relativePath };
    // Remove the large base64 string — we store the file path instead
    delete updated.violation_image_base64;
    return updated;
  } catch (err) {
    console.error("⚠️ Failed to save no-parking violation image:", err.message);
    const cleaned = { ...item };
    delete cleaned.violation_image_base64;
    return cleaned;
  }
}
