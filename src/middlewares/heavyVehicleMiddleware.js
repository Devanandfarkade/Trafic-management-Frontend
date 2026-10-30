import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure heavy-vehicles uploads directory exists
const uploadDir = path.join(__dirname, "../../uploads/heavy-vehicles");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const processHeavyVehicleImage = (req, res, next) => {
  try {
    const { image_base64 } = req.body;

    if (image_base64) {
      const base64Data = image_base64.replace(/^data:image\/(jpeg|png|jpg);base64,/, "");
      const fileName = `hv_${Date.now()}_${uuidv4().split("-")[0]}.jpg`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, base64Data, "base64");

      // Store relative path in DB (matching the static serve path)
      req.body.image_path = `uploads/heavy-vehicles/${fileName}`;
      delete req.body.image_base64;
    }

    next();
  } catch (error) {
    console.error("Error processing heavy vehicle image:", error);
    next(); // proceed even if image save fails
  }
};
