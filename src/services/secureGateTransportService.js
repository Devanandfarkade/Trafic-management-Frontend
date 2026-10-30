import * as SecureGateTransportModel from "../models/secureGateTransportModel.js";

/* ============================================================
 * ADD LOG
 * ============================================================ */
export async function addLog(data) {
  const result = await SecureGateTransportModel.insertLog(data);
  const log = result.rows[0] || null;
  return { success: true, log };
}

/* ============================================================
 * GET LOGS
 * ============================================================ */
export async function getLogs(filters = {}) {
  const result = await SecureGateTransportModel.getLogs(filters);
  return {
    success: true,
    count: result.count,
    logs: result.rows,
  };
}

/* ============================================================
 * DELETE LOG
 * ============================================================ */
export async function deleteLog(id) {
  const result = await SecureGateTransportModel.deleteLog(id);
  if (!result.rowCount) {
    return { success: false, message: "Log not found" };
  }
  return { success: true, message: "Log deleted successfully" };
}
