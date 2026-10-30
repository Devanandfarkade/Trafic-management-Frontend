import { insertUnknownPersonLog, getUnknownPersons } from "../models/unknownPersonTrackingModel.js";

/* ============================================================
 * POST /api/unknown-person-tracking/persons
 * Add a new person tracking detection (with base64 image converted by middleware)
 * ============================================================ */
export const createPerson = async (req, res, next) => {
  try {
    const { person_id, camera, status, image_path } = req.body;

    if (!person_id || !camera || !status) {
      return res.status(400).json({
        success: false,
        message: "person_id, camera, and status are required fields",
      });
    }

    const newPersonLog = await insertUnknownPersonLog({
      person_id,
      camera,
      status,
      image_path,
    });

    res.status(201).json({
      success: true,
      message: "Unknown person tracking log created successfully",
      data: newPersonLog.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/* ============================================================
 * GET /api/unknown-person-tracking/persons
 * List persons and their evidence logs
 * ============================================================ */
export const listPersons = async (req, res, next) => {
  try {
    const result = await getUnknownPersons(req.query);

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};
