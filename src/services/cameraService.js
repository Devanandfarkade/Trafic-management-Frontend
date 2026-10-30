import * as CameraModel from "../models/cameraModel.js";

export async function getCameras(moduleType, zoneId, locationId) {
  const result = await CameraModel.getAllCameras(moduleType, zoneId, locationId);
  return {
    success: true,
    count: result.rowCount,
    cameras: result.rows,
  };
}

export async function addCamera(data) {
  const result = await CameraModel.insertCamera(data);
  return {
    success: true,
    camera: result.rows[0],
  };
}

export async function updateCamera(id, data) {
  const result = await CameraModel.updateCamera(id, data);
  if (!result.rowCount) {
    return { success: false, message: "Camera not found" };
  }
  return { success: true, camera: result.rows[0] };
}

export async function deleteCamera(id) {
  const result = await CameraModel.deleteCamera(id);
  if (!result.rowCount) {
    return { success: false, message: "Camera not found" };
  }
  return { success: true, message: "Camera deleted successfully" };
}
