import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../..");
const uploadDir = path.join(backendRoot, "uploads", "in-out-detections");

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Middleware for In-Out Detections image processing.
 * Reads base64 string from req.body.image_base64, saves JPEG file
 * to uploads/in-out-detections/, sets req.body.image_path = uploads\in-out-detections\...
 */
export function inOutMiddleware(req, res, next) {
  try {
    if (Array.isArray(req.body)) {
      req.body = req.body.map(processInOutItem);
    } else if (req.body && typeof req.body === "object") {
      req.body = processInOutItem(req.body);
    }
    next();
  } catch (err) {
    console.error("❌ inOutMiddleware error:", err.message);
    next(err);
  }
}

function processInOutItem(item) {
  if (!item || !item.image_base64 || typeof item.image_base64 !== "string") {
    return item;
  }

  try {
    const base64Data = item.image_base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (!buffer || buffer.length < 4) {
      return item;
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const filename = `crossing_${timestamp}_${random}.jpg`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, buffer);

    const relativePath = `uploads\\in-out-detections\\${filename}`;
    const updated = { ...item, image_path: relativePath };
    delete updated.image_base64;

    return updated;
  } catch (err) {
    console.error("⚠️ Failed to save in-out event image:", err.message);
    return item;
  }
}
