import multer from "multer";
import path from "path";
import fs from "fs";

const uploadPath = path.resolve("uploads/profile");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadPath,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const userId = req.user?.sub || "unknown";
    cb(null, `user_${userId}_${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only image files allowed"), false);
};

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
});
