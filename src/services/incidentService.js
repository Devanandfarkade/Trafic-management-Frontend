import * as IncidentModel from "../models/incidentModel.js";



/* ============================================================
 * ADD INCIDENT
 * ============================================================ */
export async function addIncident(data) {
  const result = await IncidentModel.insertIncident(data);
  const incident = result.rows[0] || null;
  return { success: true, incident };
}

/* ============================================================
 * GET INCIDENTS 
 * ============================================================ */
export async function getIncidents(filters = {}) {
  const result = await IncidentModel.getIncidents(filters);
  return {
    success: true,
    count: result.rowCount,
    incidents: result.rows,
  };
}

/* ============================================================
 * GET INCIDENT BY ID
 * ============================================================ */
export async function getIncidentById(id) {
  const result = await IncidentModel.getIncidentById(id);
  const incident = result.rows[0];
  if (!incident) {
    return { success: false, message: "Incident not found" };
  }
  return { success: true, incident };
}

/* ============================================================
 * GET STATS
 * ============================================================ */
export async function getStats(camera, zoneId, locationId) {
  const result = await IncidentModel.getStats(camera, zoneId, locationId);
  const row = result.rows[0] || {};
  return {
    success: true,
    stats: {
      total: parseInt(row.total || 0),
      severityCounts: {
        SEVERE: parseInt(row.severe || 0),
        MODERATE: parseInt(row.moderate || 0),
        MINOR: parseInt(row.minor || 0),
        CONTACT: parseInt(row.contact || 0),
      }
    },
  };
}

/* ============================================================
 * UPDATE INCIDENT STATUS
 * ============================================================ */
export async function updateIncidentStatus(id, status) {
  const validStatuses = ["UNRESOLVED", "RESOLVED", "REJECTED", "PENDING", "DETECTED", "ACKNOWLEDGED"];
  if (!validStatuses.includes(status)) {
    return {
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    };
  }
  const result = await IncidentModel.updateIncidentStatus(id, status);
  if (!result.rowCount) {
    return { success: false, message: "Incident not found" };
  }
  return { success: true, incident: result.rows[0] };
}
