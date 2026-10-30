import * as NoParkingService from "../services/noParkingService.js";

/* ============================================================
 * POST /api/no-parking/violations
 *
 * Accepts violation from Python no_parking_main.py (via frontend WebSocket relay).
 * The noParkingMiddleware has already:
 *   - decoded violation_image_base64 → saved to disk → set violation_image_path
 *   - removed violation_image_base64 from body
 * ============================================================ */
export async function createViolation(req, res) {
  try {
    const body = req.body;

    console.log(`📥 Incoming violation | plate=${body.plate} | vehicle_id=${body.vehicle_id} | has_image=${!!body.violation_image_path}`);

    // Support array of violations (batch) or single violation
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map((v) => NoParkingService.addViolation(v)));
      console.log(`✅ Saved ${results.length} violation(s) to database`);
      return res.status(201).json({
        success: true,
        count: results.length,
        violations: results.map((r) => r.violation).filter(Boolean),
      });
    }

    const result = await NoParkingService.addViolation(body);

    if (result.violation) {
      console.log(
        `✅ Saved to database | id=${result.violation.id} | plate=${result.violation.plate} | vehicle_id=${result.violation.vehicle_id ?? 'NULL'} | tracker_id=${result.violation.tracker_id || "NONE"} | image_path=${result.violation.violation_image_path || "NONE"}`
      );
    } else {
      console.log(`⚠️ Violation already exists (duplicate violation_id) or was skipped`);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("❌ NoParkingController.createViolation:", error);
    return res.status(500).json({
      success: false,
      message: "Server error saving violation",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/no-parking/violations
 * Query params: camera, stream_id, status, date, page, limit
 * Returns violations sorted by detected_at DESC
 * ============================================================ */
export async function listViolations(req, res) {
  try {
    const { camera, stream_id, status, date, from_date, to_date, startDate, endDate, page, limit, zone_id, location_id, camera_id } = req.query;
    const result = await NoParkingService.getViolations({
      camera: camera || camera_id,
      zoneId: zone_id,
      locationId: location_id,
      stream_id,
      status,
      date,
      from_date,
      to_date,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ NoParkingController.listViolations:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching violations",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/no-parking/stats
 * Query params: camera (optional)
 * Returns: { total, pending, resolved, rejected }
 * ============================================================ */
export async function getStats(req, res) {
  try {
    const { camera, camera_id, date, zone_id, location_id } = req.query;
    const result = await NoParkingService.getStats(camera || camera_id, date, zone_id, location_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ NoParkingController.getStats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching stats",
      error: error.message,
    });
  }
}

/* ============================================================
 * PATCH /api/no-parking/violations/:id/status
 * Body: { status: "RESOLVED" | "REJECTED" | "PENDING" | "UNRESOLVED" }
 * ============================================================ */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status field is required",
      });
    }
    const violationId = !isNaN(parseInt(id, 10)) && String(parseInt(id, 10)) === String(id).trim() ? parseInt(id, 10) : id;
    const result = await NoParkingService.updateViolationStatus(violationId, status);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ NoParkingController.updateStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating status",
      error: error.message,
    });
  }
}
