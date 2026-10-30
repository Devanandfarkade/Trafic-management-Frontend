import * as CameraService from "../services/cameraService.js";
import { getCamerasByCategory } from "../models/featureModel.js";

const moduleMap = {
  "No Parking Detection": "no_parking",
  "In and Out Detection": "in_out",
  "Heavy Vehicle Detection": "heavy_vehicle",
  "AI Incident Detection": "ai_incident",
};

function normalizeCameraInput(body) {
  const name = body.name || body.camera_name;
  const rtsp_url = body.rtsp_url || body.rtsp;
  const camera_code = body.camera_code;
  const location_id = body.location_id;
  const zone_id = body.zone_id;

  return {
    ...body,
    name,
    rtsp_url,
    camera_code,
    location_id,
    zone_id,
  };
}

export async function listCameras(req, res) {
  try {
    const { module_type, category_id, zone_id, location_id } = req.query;

    // Category-based query (feature-driven)
    if (category_id) {
      const result = await getCamerasByCategory(parseInt(category_id), zone_id, location_id);
      // Format to match existing structure
      const cameras = result.rows.map(cam => ({
        ...cam,
        id: cam.camera_id || cam.id,
        camera_id: cam.camera_id || cam.id,
        value: cam.camera_code || String(cam.camera_id || cam.id),
        label: cam.name || cam.camera_code,
        url: cam.rtsp_url,
        ws_url: cam.features?.find(f => f.on_off_status)?.model_path || null,
        has_active_feature: cam.has_active_feature || false,
        features: cam.features || [],
      }));
      return res.status(200).json({ success: true, count: cameras.length, cameras });
    }

    const result = await CameraService.getCameras(module_type, zone_id, location_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ CameraController.listCameras:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching cameras",
      error: error.message,
    });
  }
}

export async function getCamerasByModule(req, res) {
  try {
    const { module_type } = req.params;
    const { zone_id, location_id } = req.query;
    const result = await CameraService.getCameras(module_type, zone_id, location_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ CameraController.getCamerasByModule:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching module cameras",
      error: error.message,
    });
  }
}

export async function createCamera(req, res) {
  try {
    const normalized = normalizeCameraInput(req.body);
    if (!normalized.name || !normalized.rtsp_url) {
      return res.status(400).json({
        success: false,
        message: "Name and RTSP URL are required",
      });
    }
    const result = await CameraService.addCamera(normalized);
    return res.status(201).json(result);
  } catch (error) {
    console.error("❌ CameraController.createCamera:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error creating camera",
      error: error.message,
    });
  }
}

export async function updateCamera(req, res) {
  try {
    const { id } = req.params;
    const normalized = normalizeCameraInput(req.body);
    const result = await CameraService.updateCamera(parseInt(id, 10), normalized);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ CameraController.updateCamera:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating camera",
      error: error.message,
    });
  }
}

export async function deleteCamera(req, res) {
  try {
    const { id } = req.params;
    const result = await CameraService.deleteCamera(parseInt(id, 10));
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ CameraController.deleteCamera:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting camera",
      error: error.message,
    });
  }
}
