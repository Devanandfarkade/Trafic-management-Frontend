import * as IncidentService from "../services/incidentService.js";

/* ============================================================
 * POST /api/ai-incident/incidents
 * Accepts incident from Python backend (via frontend relay).
 * incidentMiddleware has already saved image and appended image_path.
 * ============================================================ */
export async function createIncident(req, res) {
  try {
    const body = req.body;
    console.log(`📥 Incoming AI incident | accident_id=${body.accident_id} | severity=${body.severity}`);

    const result = await IncidentService.addIncident(body);

    if (result.incident) {
      console.log(`✅ Saved AI incident to DB | id=${result.incident.id} | accident_id=${result.incident.accident_id} | image_path=${result.incident.image_path || "NONE"}`);
    } else {
      console.log(`⚠️ Incident already exists (duplicate accident_id) or was skipped`);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("❌ IncidentController.createIncident:", error);
    return res.status(500).json({
      success: false,
      message: "Server error saving incident",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/ai-incident/incidents
 * Query params: camera, status, date, page, limit
 * ============================================================ */
export async function listIncidents(req, res) {
  try {
    const { camera, status, date, from_date, to_date, startDate, endDate, page, limit, zone_id, location_id, camera_id } = req.query;
    const result = await IncidentService.getIncidents({
      camera: camera || camera_id,
      zoneId: zone_id,
      locationId: location_id,
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
    console.error("❌ IncidentController.listIncidents:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching incidents",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/ai-incident/incidents/:id
 * ============================================================ */
export async function getIncidentById(req, res) {
  try {
    const { id } = req.params;
    const result = await IncidentService.getIncidentById(id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ IncidentController.getIncidentById:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching incident",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/ai-incident/stats
 * Query params: camera (optional)
 * ============================================================ */
export async function getStats(req, res) {
  try {
    const { camera, camera_id, zone_id, location_id } = req.query;
    const result = await IncidentService.getStats(camera || camera_id, zone_id, location_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ IncidentController.getStats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching stats",
      error: error.message,
    });
  }
}

/* ============================================================
 * PATCH /api/ai-incident/incidents/:id/status
 * ============================================================ */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const result = await IncidentService.updateIncidentStatus(id, status);
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ IncidentController.updateStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating status",
      error: error.message,
    });
  }
}
