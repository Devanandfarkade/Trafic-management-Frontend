import * as SecureGateModel from "../models/secureGateModel.js";

/* ============================================================
 * ADD PERSON LOG
 * ============================================================ */
export async function addPerson(data) {
  const result = await SecureGateModel.insertPersonLog(data);
  const person = result.rows[0];

  if (!person) {
    return { success: false, message: "Failed to insert secure gate log" };
  }

  return { success: true, person };
}

/* ============================================================
 * GET PERSON LOGS
 * ============================================================ */
export async function getPersons(filters) {
  const result = await SecureGateModel.getPersons(filters);
  return { success: true, persons: result.rows };
}
