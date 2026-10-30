import fs from "fs";
import path from "path";
import * as CriminalModel from "../models/criminalRegistrationModel.js";
import { transcodeToBrowserMp4 } from "../utils/videoTranscoder.js";

const UPLOAD_ROOT = path.resolve("uploads");
const FOLDER_NAME = "criminalRegistration";

// Formats criminal folder name: <name>_<adhar_number>
function getCriminalFolderName(firstName, lastName, aadhaarNumber) {
  const cleanFirst = (firstName || "").trim().replace(/\s+/g, "_");
  const cleanLast = (lastName || "").trim().replace(/\s+/g, "_");
  const namePart = [cleanFirst, cleanLast].filter(Boolean).join("_") || "criminal";
  const sanitizedName = namePart.replace(/[^a-zA-Z0-9_-]/g, "");
  const sanitizedAadhaar = String(aadhaarNumber || "").trim().replace(/[^0-9]/g, "");
  return `${sanitizedName}_${sanitizedAadhaar}`;
}

// Ensure directory exists: uploads/criminalRegistration/<name>_<adhar_number>
function ensureCriminalDir(folderName) {
  const dirPath = path.join(UPLOAD_ROOT, FOLDER_NAME, folderName);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

// Save image into uploads/criminalRegistration/<name>_<adhar_number>/photo.<ext>
function saveCriminalImage(file, base64Str, firstName, lastName, aadhaarNumber) {
  const folderName = getCriminalFolderName(firstName, lastName, aadhaarNumber);
  const criminalDir = ensureCriminalDir(folderName);

  // 1. Check uploaded multer file buffer
  if (file && file.buffer) {
    const ext = path.extname(file.originalname || "").replace(".", "") || "jpg";
    const cleanExt = ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase();
    const fileName = `photo.${cleanExt}`;
    const fullPath = path.join(criminalDir, fileName);
    fs.writeFileSync(fullPath, file.buffer);
    return `uploads/${FOLDER_NAME}/${folderName}/${fileName}`;
  }

  // 2. Check base64 string (webcam snapshot / FileReader data URL)
  if (base64Str && typeof base64Str === "string") {
    if (base64Str.startsWith("uploads/") || base64Str.startsWith("http://") || base64Str.startsWith("https://")) {
      return base64Str;
    }

    const match = base64Str.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    const mimeExt = match ? match[1] : "jpg";
    const cleanExt = mimeExt.toLowerCase() === "jpeg" ? "jpg" : mimeExt.toLowerCase();
    const base64Data = match ? match[2] : base64Str.replace(/^data:image\/\w+;base64,/, "");

    const fileName = `photo.${cleanExt}`;
    const fullPath = path.join(criminalDir, fileName);
    fs.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
    return `uploads/${FOLDER_NAME}/${folderName}/${fileName}`;
  }

  return null;
}

// Save video into uploads/criminalRegistration/<name>_<adhar_number>/video.<ext>
function saveCriminalVideo(file, base64Str, firstName, lastName, aadhaarNumber) {
  const folderName = getCriminalFolderName(firstName, lastName, aadhaarNumber);
  const criminalDir = ensureCriminalDir(folderName);

  // 1. Check uploaded multer file buffer
  if (file && file.buffer) {
    const ext = path.extname(file.originalname || "").replace(".", "") || "mp4";
    const cleanExt = ext.toLowerCase();
    const fileName = `video.${cleanExt}`;
    const fullPath = path.join(criminalDir, fileName);
    fs.writeFileSync(fullPath, file.buffer);
    transcodeToBrowserMp4(fullPath);
    return `uploads/${FOLDER_NAME}/${folderName}/${fileName}`;
  }

  // 2. Check base64 video string
  if (base64Str && typeof base64Str === "string") {
    if (base64Str.startsWith("uploads/") || base64Str.startsWith("http://") || base64Str.startsWith("https://")) {
      return base64Str;
    }

    const match = base64Str.match(/^data:video\/([a-zA-Z0-9]+);base64,(.+)$/);
    const mimeExt = match ? match[1] : "mp4";
    const cleanExt = mimeExt.toLowerCase();
    const base64Data = match ? match[2] : base64Str.replace(/^data:video\/\w+;base64,/, "");

    const fileName = `video.${cleanExt}`;
    const fullPath = path.join(criminalDir, fileName);
    fs.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
    transcodeToBrowserMp4(fullPath);
    return `uploads/${FOLDER_NAME}/${folderName}/${fileName}`;
  }

  return null;
}

/* ============================================================
 * GET /api/criminal-registration/meta
 * Returns categories and severities for dropdowns
 * ============================================================ */
export async function getDropdownMeta(req, res) {
  try {
    const [categories, severities, nextCode] = await Promise.all([
      CriminalModel.getCrimeCategories(),
      CriminalModel.getSeverityLevels(),
      CriminalModel.getNextCriminalCode(),
    ]);

    return res.status(200).json({
      success: true,
      categories,
      severities,
      nextCode,
    });
  } catch (error) {
    console.error("❌ Error fetching criminal registration metadata:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching registration metadata",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/criminal-registration/next-code
 * Auto-generates next sequential criminal record code
 * ============================================================ */
export async function getNextCode(req, res) {
  try {
    const nextCode = await CriminalModel.getNextCriminalCode();
    return res.status(200).json({
      success: true,
      nextCode,
    });
  } catch (error) {
    console.error("❌ Error generating next code:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating next criminal code",
      error: error.message,
    });
  }
}

/* ============================================================
 * POST /api/criminal-registration/categories
 * Add a new crime category to public.crime_categories
 * ============================================================ */
export async function addCategory(req, res) {
  try {
    const { category_name, name } = req.body;
    const categoryName = (category_name || name || "").trim();

    if (!categoryName) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    if (/\d/.test(categoryName)) {
      return res.status(400).json({
        success: false,
        message: "Category name cannot contain numbers. Only letters and text are allowed.",
      });
    }

    const newCategory = await CriminalModel.createCrimeCategory(categoryName);
    return res.status(201).json({
      success: true,
      message: "Crime category created successfully",
      category: newCategory,
    });
  } catch (error) {
    console.error("❌ Error adding crime category:", error);
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Category with this name already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error creating crime category",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/criminal-registration
 * Returns list of registered criminals with join info
 * ============================================================ */
export async function listCriminals(req, res) {
  try {
    const { category_id, severity_id, search, from_date, to_date, page = 1, limit = 100 } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [rows, severities] = await Promise.all([
      CriminalModel.getAllCriminals({
        category_id,
        severity_id,
        search,
        from_date,
        to_date,
        limit: parseInt(limit),
        offset,
      }),
      CriminalModel.getSeverityLevels(),
    ]);

    // Map severity names cleanly
    const severityMap = new Map(severities.map((s) => [String(s.id), s.name]));

    const records = rows.map((r) => ({
      criminal_id: r.criminal_id,
      id: r.criminal_record_code,
      code: r.criminal_record_code,
      firstName: r.first_name,
      lastName: r.last_name,
      criminal_record_code: r.criminal_record_code,
      registration_date: r.registration_date,
      joiningDate: r.registration_date ? new Date(r.registration_date).toISOString().split("T")[0] : null,
      crime_category_id: r.crime_category_id,
      crimeCategory: r.category_name || "General Offense",
      severity_id: r.severity_id,
      severity: severityMap.get(String(r.severity_id)) || "Medium",
      firNumber: r.fir_number || "N/A",
      fir_number: r.fir_number,
      location: r.known_area_location || r.location_name || "N/A",
      known_area_location: r.known_area_location,
      zone: r.zone_name || "General",
      zone_id: r.zone_id,
      location_id: r.location_id,
      camera_id: r.camera_id,
      aliases: r.aliases || "N/A",
      idMarks: r.identification_marks || "None reported",
      identification_marks: r.identification_marks,
      aadhaar_number: r.aadhaar_number,
      aadharNumber: r.aadhaar_number,
      photo: r.photo_path || null,
      photo_path: r.photo_path,
      video: r.video_path || null,
      video_path: r.video_path,
      status: r.is_active ? "ACTIVE WATCHLIST" : "INACTIVE",
      created_at: r.created_at,
    }));

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error("❌ Error listing criminals:", error);
    return res.status(500).json({
      success: false,
      message: "Server error listing criminals",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/criminal-registration/:id
 * ============================================================ */
export async function getCriminal(req, res) {
  try {
    const { id } = req.params;
    const criminal = await CriminalModel.getCriminalById(id);

    if (!criminal) {
      return res.status(404).json({
        success: false,
        message: "Criminal record not found",
      });
    }

    const severities = await CriminalModel.getSeverityLevels();
    const sev = severities.find((s) => String(s.id) === String(criminal.severity_id));

    return res.status(200).json({
      success: true,
      record: {
        ...criminal,
        severity_name: sev ? sev.name : "Medium",
      },
    });
  } catch (error) {
    console.error("❌ Error getting criminal details:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching criminal",
      error: error.message,
    });
  }
}

/* ============================================================
 * POST /api/criminal-registration
 * Register a new criminal record with photo and video upload
 * ============================================================ */
export async function registerCriminal(req, res) {
  try {
    const body = req.body;
    const files = req.files || {};

    const firstName = (body.first_name || body.firstName || "").trim();
    const lastName = (body.last_name || body.lastName || "").trim();
    const rawAadhaar = (body.aadhaar_number || body.aadharNumber || "").toString().trim();
    const cleanAadhaar = rawAadhaar.replace(/\D/g, "");

    // Validations
    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "First Name and Last Name are required.",
      });
    }

    if (/\d/.test(firstName) || /\d/.test(lastName)) {
      return res.status(400).json({
        success: false,
        message: "First Name and Last Name cannot contain numbers.",
      });
    }

    if (!cleanAadhaar || cleanAadhaar.length !== 12) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar Card Number must be exactly 12 digits.",
      });
    }

    const regDateInput = (body.registration_date || body.joiningDate || "").toString().trim();
    const todayStr = new Date().toISOString().split("T")[0];
    if (regDateInput && regDateInput > todayStr) {
      return res.status(400).json({
        success: false,
        message: "Registration Date cannot be in the future.",
      });
    }

    // Code: Auto-generated sequential code if left empty (e.g. CR-002 after CR-001)
    let criminalRecordCode = (body.criminal_record_code || body.code || "").trim();
    if (!criminalRecordCode) {
      criminalRecordCode = await CriminalModel.getNextCriminalCode();
    }

    // Resolve Category ID
    let crimeCategoryId = body.crime_category_id ? parseInt(body.crime_category_id) : null;
    const categories = await CriminalModel.getCrimeCategories();
    if (!crimeCategoryId) {
      const catName = (body.crime_category || body.crimeCategory || "").trim();
      const matchedCat = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
      if (matchedCat) {
        crimeCategoryId = matchedCat.id;
      } else if (categories.length > 0) {
        crimeCategoryId = categories[0].id;
      }
    }

    if (!crimeCategoryId) {
      return res.status(400).json({
        success: false,
        message: "Valid Crime Category is required.",
      });
    }

    // Resolve Severity ID
    let severityId = body.severity_id ? parseInt(body.severity_id) : null;
    const severities = await CriminalModel.getSeverityLevels();
    if (!severityId) {
      const sevName = (body.severity || "").trim();
      const matchedSev = severities.find((s) => s.name.toLowerCase() === sevName.toLowerCase());
      if (matchedSev) {
        severityId = matchedSev.id;
      } else if (severities.length > 0) {
        severityId = severities[0].id;
      }
    }

    if (!severityId) {
      return res.status(400).json({
        success: false,
        message: "Valid Threat / Severity Level is required.",
      });
    }

    // Process Image and Video files (Both are Mandatory)
    const photoFile = files["photo"]?.[0] || files["image"]?.[0];
    const base64Image = body.capturedImage || body.photo_base64 || body.photo || null;
    const photoPath = saveCriminalImage(photoFile, base64Image, firstName, lastName, cleanAadhaar);

    if (!photoPath) {
      return res.status(400).json({
        success: false,
        message: "Criminal profile photo is mandatory. Please capture or upload a photo.",
      });
    }

    const videoFile = files["video"]?.[0];
    const base64Video = body.video_base64 || body.video || null;
    const videoPath = saveCriminalVideo(videoFile, base64Video, firstName, lastName, cleanAadhaar);

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        message: "Surveillance video footage is mandatory. Please upload a video file.",
      });
    }

    // Camera / Zone / Location
    const cameraId = body.camera_id ? parseInt(body.camera_id) : null;
    const zoneId = body.zone_id ? parseInt(body.zone_id) : null;
    const locationId = body.location_id ? parseInt(body.location_id) : null;

    const newRecord = await CriminalModel.createCriminal({
      first_name: firstName,
      last_name: lastName,
      criminal_record_code: criminalRecordCode,
      registration_date: body.registration_date || body.joiningDate || new Date().toISOString().split("T")[0],
      crime_category_id: crimeCategoryId,
      severity_id: severityId,
      fir_number: body.fir_number || body.firNumber || null,
      known_area_location: body.known_area_location || body.location || null,
      aliases: body.aliases || null,
      identification_marks: body.identification_marks || body.idMarks || null,
      aadhaar_number: cleanAadhaar,
      camera_id: cameraId,
      zone_id: zoneId,
      location_id: locationId,
      photo_path: photoPath,
      video_path: videoPath,
      created_by: req.user?.id || req.user?.sub || null,
    });

    console.log(`✅ Criminal registered: ${newRecord.first_name} ${newRecord.last_name} (${newRecord.criminal_record_code})`);

    return res.status(201).json({
      success: true,
      message: "Criminal registered successfully",
      record: newRecord,
    });
  } catch (error) {
    console.error("❌ Error registering criminal:", error);
    // Handle unique constraint violation on criminal_record_code
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Criminal record code already exists. Please choose a different code.",
      });
    }
    // Handle check constraint violation
    if (error.code === "23514") {
      return res.status(400).json({
        success: false,
        message: "Aadhaar number check failed. It must be exactly 12 digits.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error registering criminal",
      error: error.message,
    });
  }
}

/* ============================================================
 * PUT /api/criminal-registration/:id
 * Update an existing criminal record
 * ============================================================ */
export async function updateCriminal(req, res) {
  try {
    const { id } = req.params;
    const body = req.body;
    const files = req.files || {};

    const existing = await CriminalModel.getCriminalById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Criminal record not found to update",
      });
    }

    const firstName = (body.first_name || body.firstName || existing.first_name).trim();
    const lastName = (body.last_name || body.lastName || existing.last_name).trim();
    const rawAadhaar = (body.aadhaar_number || body.aadharNumber || existing.aadhaar_number).toString().trim();
    const cleanAadhaar = rawAadhaar.replace(/\D/g, "");

    if (cleanAadhaar.length !== 12) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar Card Number must be exactly 12 digits.",
      });
    }

    // Process new Image/Video if provided
    let photoPath = existing.photo_path;
    const photoFile = files["photo"]?.[0] || files["image"]?.[0];
    const base64Image = body.capturedImage || body.photo_base64 || body.photo;
    if (photoFile || (base64Image && !base64Image.startsWith("uploads/"))) {
      const saved = saveCriminalImage(photoFile, base64Image, firstName, lastName, cleanAadhaar);
      if (saved) photoPath = saved;
    }

    let videoPath = existing.video_path;
    const videoFile = files["video"]?.[0];
    const base64Video = body.video_base64 || body.video;
    if (videoFile || (base64Video && !base64Video.startsWith("uploads/"))) {
      const saved = saveCriminalVideo(videoFile, base64Video, firstName, lastName, cleanAadhaar);
      if (saved) videoPath = saved;
    }

    // Resolve Category ID
    let crimeCategoryId = body.crime_category_id ? parseInt(body.crime_category_id) : existing.crime_category_id;
    if (body.crime_category || body.crimeCategory) {
      const catName = (body.crime_category || body.crimeCategory).trim();
      const categories = await CriminalModel.getCrimeCategories();
      const matchedCat = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
      if (matchedCat) crimeCategoryId = matchedCat.id;
    }

    // Resolve Severity ID
    let severityId = body.severity_id ? parseInt(body.severity_id) : existing.severity_id;
    if (body.severity) {
      const sevName = body.severity.trim();
      const severities = await CriminalModel.getSeverityLevels();
      const matchedSev = severities.find((s) => s.name.toLowerCase() === sevName.toLowerCase());
      if (matchedSev) severityId = matchedSev.id;
    }

    const regDateUpdate = (body.registration_date || body.joiningDate || "").toString().trim();
    const todayStrUpdate = new Date().toISOString().split("T")[0];
    if (regDateUpdate && regDateUpdate > todayStrUpdate) {
      return res.status(400).json({
        success: false,
        message: "Registration Date cannot be in the future.",
      });
    }

    const updated = await CriminalModel.updateCriminal(id, {
      first_name: firstName,
      last_name: lastName,
      criminal_record_code: body.criminal_record_code || body.code || existing.criminal_record_code,
      registration_date: body.registration_date || body.joiningDate || existing.registration_date,
      crime_category_id: crimeCategoryId,
      severity_id: severityId,
      fir_number: body.fir_number !== undefined ? body.fir_number : body.firNumber,
      known_area_location: body.known_area_location !== undefined ? body.known_area_location : body.location,
      aliases: body.aliases,
      identification_marks: body.identification_marks !== undefined ? body.identification_marks : body.idMarks,
      aadhaar_number: cleanAadhaar,
      camera_id: body.camera_id ? parseInt(body.camera_id) : existing.camera_id,
      zone_id: body.zone_id ? parseInt(body.zone_id) : existing.zone_id,
      location_id: body.location_id ? parseInt(body.location_id) : existing.location_id,
      photo_path: photoPath,
      video_path: videoPath,
      updated_by: req.user?.id || req.user?.sub || null,
    });

    return res.status(200).json({
      success: true,
      message: "Criminal record updated successfully",
      record: updated,
    });
  } catch (error) {
    console.error("❌ Error updating criminal:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating criminal",
      error: error.message,
    });
  }
}

/* ============================================================
 * DELETE /api/criminal-registration/:id
 * ============================================================ */
export async function deleteCriminal(req, res) {
  try {
    const { id } = req.params;
    const deleted = await CriminalModel.deleteCriminal(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Criminal record not found to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Criminal record deleted successfully",
      record: deleted,
    });
  } catch (error) {
    console.error("❌ Error deleting criminal:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting criminal",
      error: error.message,
    });
  }
}
