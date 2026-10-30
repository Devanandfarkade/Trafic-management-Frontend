import fs from "fs";
import path from "path";
import * as DetectionModel from "../models/criminalDetectionModel.js";
import * as CriminalModel from "../models/criminalRegistrationModel.js";
import { pool } from "../config/db.js";
import { transcodeToBrowserMp4 } from "../utils/videoTranscoder.js";

const UPLOAD_ROOT = path.resolve("uploads");
const FOLDER_NAME = "criminalDetection";

// Set of active SSE clients for real-time live streaming of detections
const sseClients = new Set();

/* ============================================================
 * HELPER: Format Criminal Detection Evidence File Name
 * Format: Criminal_name-Aadharcard_number_Image/Video_Timestamp
 * Saved directly in uploads/criminalDetection/ without subfolders
 * ============================================================ */
function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function getEvidenceFileName(detectedName, aadhaarNumber, type, ext) {
  const cleanName = (detectedName || "Suspect")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  const cleanAadhaar = String(aadhaarNumber || "")
    .trim()
    .replace(/\D/g, "") || "NA";

  const timestamp = formatTimestamp();
  const cleanExt = (ext || (type === "Image" ? "jpg" : "mp4")).replace(/^\./, "").toLowerCase();

  return `${cleanName}-${cleanAadhaar}_${type}_${timestamp}.${cleanExt}`;
}

// Ensures directory exists: uploads/criminalDetection directly
function getDetectionDir() {
  const dirPath = path.join(UPLOAD_ROOT, FOLDER_NAME);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

// Save mugshot photo directly into uploads/criminalDetection/Criminal_name-Aadharcard_number_Image/Face/Snapshot_Timestamp.<ext>
function saveDetectionImage(file, base64Str, detectedName, aadhaarNumber, subType = "Image") {
  const targetDir = getDetectionDir();

  // 1. Check uploaded multer file buffer
  if (file && file.buffer) {
    const ext = path.extname(file.originalname || "").replace(".", "") || "jpg";
    const cleanExt = ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase();
    const fileName = getEvidenceFileName(detectedName, aadhaarNumber, subType, cleanExt);
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, file.buffer);
    return `uploads/${FOLDER_NAME}/${fileName}`;
  }

  // 2. Check base64 string
  if (base64Str && typeof base64Str === "string") {
    if (base64Str.startsWith("uploads/") || base64Str.startsWith("http://") || base64Str.startsWith("https://")) {
      return base64Str;
    }

    const match = base64Str.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    const mimeExt = match ? match[1] : "jpg";
    const cleanExt = mimeExt.toLowerCase() === "jpeg" ? "jpg" : mimeExt.toLowerCase();
    const base64Data = match ? match[2] : base64Str.replace(/^data:image\/\w+;base64,/, "");

    const fileName = getEvidenceFileName(detectedName, aadhaarNumber, subType, cleanExt);
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
    return `uploads/${FOLDER_NAME}/${fileName}`;
  }

  return null;
}

// Find detection video in uploads/criminalDetection for this suspect
function findDetectionVideoOnDisk(detectedName, aadhaarNumber) {
  try {
    const targetDir = getDetectionDir();
    if (!fs.existsSync(targetDir)) return null;
    const cleanName = (detectedName || "").trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
    const cleanAadhaar = String(aadhaarNumber || "").replace(/\D/g, "");

    const files = fs.readdirSync(targetDir);
    const matched = files.filter(f => {
      const lower = f.toLowerCase();
      if (!lower.endsWith(".mp4") && !lower.endsWith(".webm")) return false;
      if (cleanAadhaar && cleanAadhaar.length >= 6 && lower.includes(cleanAadhaar)) return true;
      if (cleanName && cleanName.length >= 3 && lower.includes(cleanName)) return true;
      return false;
    });

    if (matched.length > 0) {
      matched.sort().reverse();
      return `uploads/${FOLDER_NAME}/${matched[0]}`;
    }
  } catch (err) {
    console.error("Error finding detection video on disk:", err);
  }
  return null;
}

// Find detection image in uploads/criminalDetection for this suspect
function findDetectionImageOnDisk(detectedName, aadhaarNumber) {
  try {
    const targetDir = getDetectionDir();
    if (!fs.existsSync(targetDir)) return null;
    const cleanName = (detectedName || "").trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
    const cleanAadhaar = String(aadhaarNumber || "").replace(/\D/g, "");

    const files = fs.readdirSync(targetDir);
    const matched = files.filter(f => {
      const lower = f.toLowerCase();
      if (!lower.endsWith(".jpg") && !lower.endsWith(".jpeg") && !lower.endsWith(".png")) return false;
      if (cleanAadhaar && cleanAadhaar.length >= 6 && lower.includes(cleanAadhaar)) return true;
      if (cleanName && cleanName.length >= 3 && lower.includes(cleanName)) return true;
      return false;
    });

    if (matched.length > 0) {
      matched.sort().reverse();
      return `uploads/${FOLDER_NAME}/${matched[0]}`;
    }
  } catch (err) {
    console.error("Error finding detection image on disk:", err);
  }
  return null;
}

// Save video directly into uploads/criminalDetection/Criminal_name-Aadharcard_number_Video_Timestamp.<ext>
function saveDetectionVideo(file, base64Str, detectedName, aadhaarNumber) {
  const targetDir = getDetectionDir();

  // 1. Check uploaded multer file buffer
  if (file && file.buffer) {
    let ext = path.extname(file.originalname || "").replace(".", "") || "mp4";
    let cleanExt = ext.toLowerCase();
    if (cleanExt === "octet-stream" || !cleanExt) cleanExt = "mp4";
    const fileName = getEvidenceFileName(detectedName, aadhaarNumber, "Video", cleanExt);
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, file.buffer);
    transcodeToBrowserMp4(fullPath);
    return `uploads/${FOLDER_NAME}/${fileName}`;
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

    const fileName = getEvidenceFileName(detectedName, aadhaarNumber, "Video", cleanExt);
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
    transcodeToBrowserMp4(fullPath);
    return `uploads/${FOLDER_NAME}/${fileName}`;
  }

  return null;
}

// Broadcast new detection to all SSE listeners on the frontend
function broadcastDetection(detection) {
  if (sseClients.size === 0) return;
  const message = `data: ${JSON.stringify(detection)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

/* ============================================================
 * SSE STREAM: GET /api/criminal-detection/stream
 * Real-time event stream for the live surveillance page
 * ============================================================ */
export function sseStream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.write("event: connected\ndata: {}\n\n");

  const client = { id: Date.now(), res };
  sseClients.add(client);

  const heartbeat = setInterval(() => {
    try {
      res.write(":\n\n"); // SSE ping comment
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(client);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
  });
}

/* ============================================================
 * POST /api/criminal-detection
 * Receive AI Detection from Python Script or Live Stream
 * ============================================================ */
export async function createDetection(req, res) {
  try {
    const body = req.body;
    const files = req.files || {};

    // Helper to process a single detection item
    const processItem = async (item) => {
      let detectedName = (item.detected_name || item.name || item.fullName || "Unidentified Suspect").trim();
      let detectedAlias = (item.detected_alias || item.alias || item.aliases || "").trim();
      let rawAadhaar = (item.aadhaar_number || item.aadhar_number || item.aadhar || "").toString().trim();
      let cleanAadhaar = rawAadhaar.replace(/\D/g, "");
      const empId = (item.emp_id || item.employee_id || item.criminalId || "").toString().trim();
      let criminalId = item.criminal_id ? parseInt(item.criminal_id) : null;

      // Pre-resolve suspect details from criminal_registration if needed
      if (!criminalId || !cleanAadhaar || cleanAadhaar.length !== 12) {
        try {
          let regMatch = null;
          if (criminalId) {
            regMatch = await pool.query(`SELECT * FROM public.criminal_registration WHERE criminal_id = $1 AND is_active = true LIMIT 1`, [criminalId]);
          } else if (empId) {
            regMatch = await pool.query(
              `SELECT * FROM public.criminal_registration 
               WHERE (criminal_record_code ILIKE $1 OR criminal_record_code ILIKE $2) 
                 AND is_active = true ORDER BY criminal_id DESC LIMIT 1`,
              [empId, `%${empId}%`]
            );
            if (regMatch.rows.length === 0 && !isNaN(parseInt(empId))) {
              regMatch = await pool.query(`SELECT * FROM public.criminal_registration WHERE criminal_id = $1 AND is_active = true LIMIT 1`, [parseInt(empId)]);
            }
          }
          if ((!regMatch || regMatch.rows.length === 0) && cleanAadhaar && cleanAadhaar.length === 12) {
            regMatch = await pool.query(`SELECT * FROM public.criminal_registration WHERE aadhaar_number = $1 AND is_active = true LIMIT 1`, [cleanAadhaar]);
          }
          if (regMatch && regMatch.rows.length > 0) {
            const reg = regMatch.rows[0];
            criminalId = criminalId || reg.criminal_id;
            detectedName = detectedName !== "Unidentified Suspect" ? detectedName : `${reg.first_name} ${reg.last_name}`.trim();
            detectedAlias = detectedAlias || reg.aliases;
            if (!cleanAadhaar || cleanAadhaar.length !== 12) {
              cleanAadhaar = (reg.aadhaar_number || "").replace(/\D/g, "");
            }
          }
        } catch (preErr) {
          console.warn("[createDetection] Pre-resolve suspect warning:", preErr.message);
        }
      }

      // Handle Mugshot / Face Photo (Surveillance Intercept)
      const photoFile = files["face_image"]?.[0] || files["mugshot"]?.[0] || files["photo"]?.[0] || files["image"]?.[0];
      const base64Image = item.face_image || item.mugshot_base64 || item.photo_base64 || item.image_base64 || item.mugshot || item.photo;
      const mugshotPath = saveDetectionImage(photoFile, base64Image, detectedName, cleanAadhaar, "Image");

      // Handle Full Camera Scene Annotated Snapshot
      const snapshotFile = files["snapshot"]?.[0];
      const base64Snapshot = item.snapshot_base64 || item.snapshot;
      const snapshotPath = saveDetectionImage(snapshotFile, base64Snapshot, detectedName, cleanAadhaar, "Snapshot");

      // Handle Video
      const videoFile = files["video"]?.[0] || files["clip"]?.[0];
      const base64Video = item.video_base64 || item.clip_base64 || item.video;
      const videoPath = saveDetectionVideo(videoFile, base64Video, detectedName, cleanAadhaar);

      // Parse match confidence
      const confidence = item.match_confidence !== undefined && item.match_confidence !== null
        ? parseFloat(item.match_confidence)
        : (item.match_percentage !== undefined && item.match_percentage !== null
            ? parseFloat(item.match_percentage)
            : (item.confidence !== undefined && item.confidence !== null ? parseFloat(item.confidence) : 95.0));

      const isMatched = item.is_matched !== undefined
        ? Boolean(item.is_matched)
        : (Boolean(item.criminal_id) || Boolean(item.emp_id) || Boolean(cleanAadhaar && cleanAadhaar.length === 12));

      const created = await DetectionModel.createDetection({
        criminal_id: item.criminal_id ? parseInt(item.criminal_id) : null,
        emp_id: item.emp_id || item.employee_id || item.criminalId || null,
        detected_name: detectedName,
        detected_alias: detectedAlias || null,
        aadhaar_number: cleanAadhaar && cleanAadhaar.length === 12 ? cleanAadhaar : null,
        mugshot_path: mugshotPath || item.mugshot_path || null,
        snapshot_path: snapshotPath || item.snapshot_path || null,
        is_matched: isMatched,
        match_confidence: isNaN(confidence) ? 95.0 : confidence,
        crime_category_id: item.crime_category_id ? parseInt(item.crime_category_id) : null,
        severity_id: item.severity_id ? parseInt(item.severity_id) : null,
        status_id: item.status_id ? parseInt(item.status_id) : 1, // 1 = Alert Triggered
        fir_number: item.fir_number || item.firNumber || null,
        camera_id: item.camera_id || item.cameraId || null,
        zone_id: item.zone_id ? parseInt(item.zone_id) : null,
        location_id: item.location_id ? parseInt(item.location_id) : null,
        detection_time: item.detection_time || item.time || new Date().toISOString(),
        video_path: videoPath || item.video_path || null,
        created_by: req.user?.id || req.user?.sub || null,
      });

      // Format for frontend
      const formatted = formatDetectionResponse(created);
      if (item.client_detection_id || item.detection_id || item.clientDetectionId) {
        formatted.clientDetectionId = item.client_detection_id || item.detection_id || item.clientDetectionId;
      }
      broadcastDetection(formatted);
      return formatted;
    };

    // Support single detection or batch array from Python
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        results.push(await processItem(item));
      }
      return res.status(201).json({
        success: true,
        count: results.length,
        detections: results,
      });
    }

    const detection = await processItem(body);
    return res.status(201).json({
      success: true,
      message: "Criminal detection logged successfully",
      detection,
    });
  } catch (error) {
    console.error("❌ Error creating criminal detection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error creating criminal detection",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/criminal-detection
 * List Detections with Filters, Search and Pagination
 * ============================================================ */
export async function listDetections(req, res) {
  try {
    const {
      search,
      category_id,
      severity_id,
      status_id,
      camera_id,
      zone_id,
      location_id,
      is_matched,
      from_date,
      to_date,
      page = 1,
      limit = 100,
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const { total, rows } = await DetectionModel.getAllDetections({
      search,
      category_id,
      severity_id,
      status_id,
      camera_id,
      zone_id,
      location_id,
      is_matched,
      from_date,
      to_date,
      limit: parseInt(limit),
      offset,
    });

    const detections = rows.map(formatDetectionResponse);

    return res.status(200).json({
      success: true,
      total,
      count: detections.length,
      page: parseInt(page),
      limit: parseInt(limit),
      detections,
    });
  } catch (error) {
    console.error("❌ Error listing criminal detections:", error);
    return res.status(500).json({
      success: false,
      message: "Server error listing criminal detections",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/criminal-detection/stats
 * Real-time KPI Stats
 * ============================================================ */
export async function getStats(req, res) {
  try {
    const stats = await DetectionModel.getDetectionStats();
    return res.status(200).json({
      success: true,
      stats: {
        totalDetections: parseInt(stats.total_detections || 0),
        todayDetections: parseInt(stats.today_detections || 0),
        matchedDetections: parseInt(stats.matched_detections || 0),
        criticalToday: parseInt(stats.critical_today || 0),
        activeCamerasToday: parseInt(stats.active_cameras_today || 0),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching detection stats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching stats",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/criminal-detection/meta
 * Meta options: Statuses, Categories, Severities
 * ============================================================ */
export async function getMeta(req, res) {
  try {
    const [statuses, categories, severities] = await Promise.all([
      DetectionModel.getDetectionStatuses(),
      CriminalModel.getCrimeCategories(),
      CriminalModel.getSeverityLevels(),
    ]);

    return res.status(200).json({
      success: true,
      statuses,
      categories,
      severities,
    });
  } catch (error) {
    console.error("❌ Error fetching metadata:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching metadata",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/criminal-detection/:id
 * ============================================================ */
export async function getDetection(req, res) {
  try {
    const { id } = req.params;
    const row = await DetectionModel.getDetectionById(id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Criminal detection not found",
      });
    }

    return res.status(200).json({
      success: true,
      detection: formatDetectionResponse(row),
    });
  } catch (error) {
    console.error("❌ Error getting detection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error getting detection",
      error: error.message,
    });
  }
}

/* ============================================================
 * PATCH /api/criminal-detection/:id/status
 * Update status (e.g. 1: Alert Triggered, 2: Verified, 3: Dispatched, 4: Resolved)
 * ============================================================ */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status_id, status } = req.body;

    let targetStatusId = status_id ? parseInt(status_id) : null;
    if (!targetStatusId && status) {
      const statuses = await DetectionModel.getDetectionStatuses();
      const match = statuses.find(
        (s) => s.status_name.toLowerCase() === status.toLowerCase()
      );
      if (match) targetStatusId = match.status_id;
    }

    if (!targetStatusId) {
      return res.status(400).json({
        success: false,
        message: "Valid status_id is required",
      });
    }

    const updated = await DetectionModel.updateDetectionStatus(
      id,
      targetStatusId,
      req.user?.id || req.user?.sub || null
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Detection record not found to update",
      });
    }

    const formatted = formatDetectionResponse(updated);
    broadcastDetection(formatted);

    return res.status(200).json({
      success: true,
      message: "Detection status updated successfully",
      detection: formatted,
    });
  } catch (error) {
    console.error("❌ Error updating status:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating status",
      error: error.message,
    });
  }
}

/* ============================================================
 * DELETE /api/criminal-detection/:id
 * ============================================================ */
export async function deleteDetection(req, res) {
  try {
    const { id } = req.params;
    const deleted = await DetectionModel.deleteDetection(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Detection not found to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Detection deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting detection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting detection",
      error: error.message,
    });
  }
}

/* ============================================================
 * POST /api/criminal-detection/:id/clip
 * Attach video clip arriving later from Python AI face detection
 * ============================================================ */
export async function attachClip(req, res) {
  try {
    const { id } = req.params;
    const files = req.files || {};
    const body = req.body || {};

    let existing = null;
    let detectionIdToUpdate = null;

    // 1. Try parsing numeric id from params
    if (id && !isNaN(parseInt(id))) {
      existing = await DetectionModel.getDetectionById(parseInt(id));
      if (existing) detectionIdToUpdate = parseInt(id);
    }

    // 2. Try regex extracting digits if id is like 'DET-0004'
    if (!existing && id) {
      const numMatch = String(id).match(/\d+/);
      if (numMatch) {
        existing = await DetectionModel.getDetectionById(parseInt(numMatch[0]));
        if (existing) detectionIdToUpdate = parseInt(numMatch[0]);
      }
    }

    // 3. Try from body properties: detection_id, rawDetectionId, id
    if (!existing) {
      const fallbackId = body.detection_id || body.rawDetectionId || body.id;
      if (fallbackId && !isNaN(parseInt(fallbackId))) {
        existing = await DetectionModel.getDetectionById(parseInt(fallbackId));
        if (existing) detectionIdToUpdate = parseInt(fallbackId);
      }
    }

    // 4. Try matching by emp_id if supplied
    if (!existing) {
      const empId = body.emp_id || body.employee_id;
      if (empId) {
        const matchRes = await pool.query(
          `SELECT d.detection_id FROM public.criminal_detections d
           LEFT JOIN public.criminal_registration r ON d.criminal_id = r.criminal_id
           WHERE (r.criminal_record_code ILIKE $1 OR d.detected_name ILIKE $2)
             AND d.is_active = true
           ORDER BY d.detection_id DESC LIMIT 1`,
          [empId, `%${empId}%`]
        );
        if (matchRes.rows.length > 0) {
          detectionIdToUpdate = matchRes.rows[0].detection_id;
          existing = await DetectionModel.getDetectionById(detectionIdToUpdate);
        }
      }
    }

    // 5. Fallback: match most recent detection in the system
    if (!existing) {
      const recent = await pool.query(
        `SELECT detection_id FROM public.criminal_detections 
         WHERE is_active = true 
         ORDER BY detection_id DESC LIMIT 1`
      );
      if (recent.rows.length > 0) {
        detectionIdToUpdate = recent.rows[0].detection_id;
        existing = await DetectionModel.getDetectionById(detectionIdToUpdate);
      }
    }

    if (!existing || !detectionIdToUpdate) {
      return res.status(404).json({ success: false, message: "Detection record not found" });
    }

    const videoFile = files["video"]?.[0] || files["clip"]?.[0];
    const base64Video = body.video_base64 || body.clip_base64 || body.video || body.clip;

    if (!videoFile && !base64Video) {
      return res.status(400).json({ success: false, message: "No video file or base64 clip provided" });
    }

    const detectedName = existing.detected_name || "Suspect";
    const aadhaarNumber = existing.aadhaar_number || "";
    const videoPath = saveDetectionVideo(videoFile, base64Video, detectedName, aadhaarNumber);

    if (!videoPath) {
      return res.status(500).json({ success: false, message: "Failed to save video evidence file" });
    }

    const updated = await DetectionModel.updateDetectionVideo(detectionIdToUpdate, videoPath);
    const formatted = formatDetectionResponse(updated);
    broadcastDetection(formatted);

    return res.status(200).json({
      success: true,
      message: "Video evidence clip attached successfully",
      detection: formatted,
      video_path: videoPath
    });
  } catch (error) {
    console.error("❌ CriminalDetectionController.attachClip:", error);
    return res.status(500).json({ success: false, message: "Server error attaching video clip", error: error.message });
  }
}

/* ============================================================
 * HELPER: Format DB row to Frontend Detection object
 * ============================================================ */
function formatDetectionResponse(row) {
  if (!row) return null;

  const detDate = row.detection_time || row.created_at;
  const detTimeObj = detDate ? new Date(detDate) : new Date();
  const timeFormatted = !isNaN(detTimeObj.getTime())
    ? detTimeObj.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "—";

  // Resolve detection video strictly from uploads/criminalDetection (NEVER from registration)
  let detectionVideoPath = row.video_path || null;
  if (!detectionVideoPath && row.detected_name) {
    detectionVideoPath = findDetectionVideoOnDisk(row.detected_name, row.aadhaar_number);
  }

  // Resolve detection mugshot / face image from DB or disk
  let detectionMugshotPath = row.mugshot_path || null;
  if (!detectionMugshotPath && row.detected_name) {
    detectionMugshotPath = findDetectionImageOnDisk(row.detected_name, row.aadhaar_number);
  }

  // Resolve snapshot (if snapshot_path is null, fallback to mugshot_path so scene snapshot isn't missing)
  const detectionSnapshotPath = row.snapshot_path || detectionMugshotPath || null;

  return {
    detectionId: `DET-${String(row.detection_id).padStart(4, "0")}`,
    rawDetectionId: row.detection_id,
    criminalId: row.criminal_record_code || (row.criminal_id ? `CR-${row.criminal_id}` : "UNMATCHED"),
    rawCriminalId: row.criminal_id,
    firstName: row.reg_first_name || (row.detected_name ? row.detected_name.split(" ")[0] : "Suspect"),
    lastName: row.reg_last_name || (row.detected_name ? row.detected_name.split(" ").slice(1).join(" ") : ""),
    detectedName: row.detected_name || "Unidentified Suspect",
    aliases: row.detected_alias || "None",
    aadhaarNumber: row.aadhaar_number || null,
    crimeCategory: row.category_name || "General Offense",
    crimeCategoryId: row.crime_category_id,
    severity: row.severity_name || "Medium",
    severityId: row.severity_id,
    status: (row.status_name || "Alert Triggered").toUpperCase(),
    statusId: row.status_id,
    confidence: row.match_confidence ? parseFloat(row.match_confidence) : 95.0,
    isMatched: Boolean(row.is_matched),
    firNumber: row.fir_number || "N/A",
    location: row.location_name || "",
    locationId: row.location_id || null,
    zone: row.zone_name || "",
    zoneId: row.zone_id || null,
    camera: row.camera_name || (row.camera_id ? `CAM-${row.camera_id}` : ""),
    cameraId: row.camera_id ? `CAM-${row.camera_id}` : "",
    detected_at: !isNaN(detTimeObj.getTime()) ? detTimeObj.toISOString() : new Date().toISOString(),
    detection_time: !isNaN(detTimeObj.getTime()) ? detTimeObj.toISOString() : new Date().toISOString(),
    time: timeFormatted,

    // 1. Surveillance Intercept (Cropped Face / Mugshot from Live Camera)
    face_image: detectionMugshotPath || null,
    mugshot: detectionMugshotPath || null,
    live_mugshot: detectionMugshotPath || null,
    mugshot_path: detectionMugshotPath || null,
    photo: detectionMugshotPath || row.reg_photo_path || null,

    // 2. Full Camera Scene Annotated Snapshot
    snapshot: detectionSnapshotPath || null,
    snapshot_path: row.snapshot_path || null,

    // 3. Official Register Image (from registration)
    registered_photo: row.reg_photo_path || null,
    registered_photo_path: row.reg_photo_path || null,
    reg_photo_path: row.reg_photo_path || null,

    // 4. Recorded Detection Video Intercept (Strictly detection video, NEVER registration video)
    video: detectionVideoPath || null,
    video_path: detectionVideoPath || null,
    registered_video: row.reg_video_path || null,
    reg_video_path: row.reg_video_path || null,

    createdAt: row.created_at,
  };
}
