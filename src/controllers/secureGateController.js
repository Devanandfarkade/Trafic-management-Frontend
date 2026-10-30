import * as SecureGateService from "../services/secureGateService.js";

/* ============================================================
 * POST /api/secure-gate/persons
 * ============================================================ */
export async function createPerson(req, res) {
  try {
    const body = req.body;
    console.log(`📥 Incoming Secure Gate person | id=${body.person_id} | status=${body.status}`);

    const result = await SecureGateService.addPerson(body);

    if (result.person) {
      console.log(`✅ Saved Secure Gate person | id=${result.person.person_id} | status=${result.person.status}`);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("❌ SecureGateController.createPerson:", error);
    return res.status(500).json({
      success: false,
      message: "Server error saving person",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/secure-gate/persons
 * ============================================================ */
export async function listPersons(req, res) {
  try {
    const { search, page, limit, zone_id, location_id, camera_id } = req.query;
    const result = await SecureGateService.getPersons({
      search,
      zoneId: zone_id,
      locationId: location_id,
      cameraId: camera_id,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ SecureGateController.listPersons:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching persons",
      error: error.message,
    });
  }
}
