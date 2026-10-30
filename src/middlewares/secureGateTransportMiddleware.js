import fs from "fs";
import path from "path";
import crypto from "crypto";

export function processSecureGateTransportImages(req, res, next) {
  try {
    const uploadDir = path.join(process.cwd(), "uploads", "Secure-Gate-Transport");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const processImage = (base64String, prefix) => {
      if (!base64String) return null;
      // Strip potential data URL prefix
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
      const uniqueId = crypto.randomBytes(4).toString("hex");
      const fileName = `${prefix}_${Date.now()}_${uniqueId}.jpg`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, base64Data, "base64");
      return `uploads/Secure-Gate-Transport/${fileName}`;
    };

    if (req.body.entry_image_base64) {
      req.body.entry_image_path = processImage(req.body.entry_image_base64, "entry");
    }
    if (req.body.vehicle_image_base64) {
      req.body.vehicle_image_path = processImage(req.body.vehicle_image_base64, "vehicle");
    }
    if (req.body.plate_crop_base64) {
      req.body.plate_crop_path = processImage(req.body.plate_crop_base64, "plate_crop");
    }
    if (req.body.enhanced_plate_base64) {
      req.body.enhanced_plate_path = processImage(req.body.enhanced_plate_base64, "enhanced_plate");
    }
    if (req.body.best_result_base64) {
      req.body.best_result_path = processImage(req.body.best_result_base64, "best_result");
    }

    next();
  } catch (error) {
    console.error("❌ Error in secureGateTransportMiddleware:", error);
    next(); // Proceed anyway
  }
}
