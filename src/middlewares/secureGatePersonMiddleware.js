import fs from "fs";
import path from "path";
import crypto from "crypto";

export function processSecureGateImage(req, res, next) {
  try {
    const { image } = req.body;
    if (!image) {
      return next(); // No image, proceed
    }

    // Prepare uploads directory
    const uploadDir = path.join(process.cwd(), "uploads", "Secure-Gate-Person");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Determine Base64 data (it may or may not have a data:image/jpeg;base64, prefix)
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const uniqueId = crypto.randomBytes(4).toString("hex");
    const fileName = `person_${Date.now()}_${uniqueId}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, base64Data, "base64");

    // Add path to body so controller can save it to DB
    req.body.image_path = `uploads/Secure-Gate-Person/${fileName}`;

    next();
  } catch (error) {
    console.error("❌ Error in secureGatePersonMiddleware:", error);
    next(); // Proceed anyway, without image path
  }
}
