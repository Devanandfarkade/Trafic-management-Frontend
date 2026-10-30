import * as SecureGateTransportService from "../services/secureGateTransportService.js";

/* ============================================================
 * POST /api/secure-gate-transport/log
 * Accepts data from Python backend.
 * Middleware has already saved images and appended paths.
 * ============================================================ */
export async function createLog(req, res) {
  try {
    const body = req.body;
    console.log(`📥 Incoming Secure Gate Transport | plate=${body.plate} | vehicle_id=${body.vehicle_id}`);

    const result = await SecureGateTransportService.addLog(body);

    if (result.log) {
      console.log(`✅ Saved Transport Log to DB | log_id=${result.log.log_id} | plate=${result.log.plate}`);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("❌ SecureGateTransportController.createLog:", error);
    return res.status(500).json({
      success: false,
      message: "Server error saving transport log",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/secure-gate-transport/logs
 * Query params: stream_id, plate, page, limit
 * ============================================================ */
export async function getLogs(req, res) {
  try {
    const { stream_id, plate, page, limit, zone_id, location_id, camera_id } = req.query;
    const result = await SecureGateTransportService.getLogs({
      stream_id: stream_id || camera_id,
      zoneId: zone_id,
      locationId: location_id,
      plate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ SecureGateTransportController.getLogs:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching transport logs",
      error: error.message,
    });
  }
}

/* ============================================================
 * DELETE /api/secure-gate-transport/logs/:id
 * ============================================================ */
export async function deleteLog(req, res) {
  try {
    const { id } = req.params;
    const result = await SecureGateTransportService.deleteLog(id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ SecureGateTransportController.deleteLog:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting transport log",
      error: error.message,
    });
  }
}
