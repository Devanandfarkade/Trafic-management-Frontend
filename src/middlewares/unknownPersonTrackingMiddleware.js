import fs from "fs";
import path from "path";
import crypto from "crypto";

export function processUnknownPersonImage(req, res, next) {
  try {
    const { image } = req.body;
    if (!image) {
      return next(); // No image, proceed
    }

    // Prepare uploads directory
    const uploadDir = path.join(process.cwd(), "uploads", "unknown-person-tracking");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Determine Base64 data (it may or may not have a data:image/jpeg;base64, prefix)
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const uniqueId = crypto.randomBytes(4).toString("hex");
    const fileName = `tracking_${Date.now()}_${uniqueId}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, base64Data, "base64");

    // Add path to body so controller can save it to DB
    req.body.image_path = `uploads/unknown-person-tracking/${fileName}`;

    next();
  } catch (error) {
    console.error("❌ Error in unknownPersonTrackingMiddleware:", error);
    next(); // Proceed anyway, without image path
  }
}
