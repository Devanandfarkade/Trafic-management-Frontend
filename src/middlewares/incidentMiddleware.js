import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the incidents uploads directory exists
const uploadDir = path.join(__dirname, "../../uploads/incidents");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const processIncidentImage = (req, res, next) => {
  try {
    const { image_base64 } = req.body;

    if (image_base64) {
      // Decode the base64 string
      const base64Data = image_base64.replace(/^data:image\/jpeg;base64,/, "");
      
      const fileName = `incident_${Date.now()}_${uuidv4().split('-')[0]}.jpg`;
      const filePath = path.join(uploadDir, fileName);

      fs.writeFileSync(filePath, base64Data, 'base64');
      
      // Add the relative path to be stored in DB
      req.body.image_path = `uploads/incidents/${fileName}`;
      
      // Clean up body so it doesn't get logged massively or passed along as a heavy string
      delete req.body.image_base64;
    }

    next();
  } catch (error) {
    console.error("Error processing incident image:", error);
    // Proceed even if image processing fails
    next();
  }
};
