import * as FeatureModel from "../models/featureModel.js";

/* ---------- FEATURES CRUD ---------- */
export async function listFeatures(req, res) {
  try {
    const { category_id, isactive } = req.query;
    const activeOnly = isactive !== undefined ? (isactive === 'true' || isactive === true) : null;
    const result = await FeatureModel.getAllFeatures(category_id ? parseInt(category_id) : null, activeOnly);
    return res.status(200).json({ success: true, count: result.rowCount, features: result.rows });
  } catch (error) {
    console.error("❌ FeatureController.listFeatures:", error);
    return res.status(500).json({ success: false, message: "Server error fetching features", error: error.message });
  }
}

export async function createFeature(req, res) {
  try {
    const { name, description, model_path, category_id, isactive } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Feature name is required" });
    const result = await FeatureModel.createFeature({ name, description, model_path, category_id, isactive });
    return res.status(201).json({ success: true, message: "Feature created successfully", feature: result.rows[0] });
  } catch (error) {
    console.error("❌ FeatureController.createFeature:", error);
    return res.status(500).json({ success: false, message: "Server error creating feature", error: error.message });
  }
}

export async function updateFeature(req, res) {
  try {
    const { id } = req.params;
    const { name, description, model_path, category_id, isactive } = req.body;
    const result = await FeatureModel.updateFeature(id, { name, description, model_path, category_id, isactive });
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Feature not found" });
    return res.status(200).json({ success: true, message: "Feature updated successfully", feature: result.rows[0] });
  } catch (error) {
    console.error("❌ FeatureController.updateFeature:", error);
    return res.status(500).json({ success: false, message: "Server error updating feature", error: error.message });
  }
}

export async function deleteFeature(req, res) {
  try {
    const { id } = req.params;
    const result = await FeatureModel.deleteFeature(id);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Feature not found" });
    return res.status(200).json({ success: true, message: "Feature deleted successfully" });
  } catch (error) {
    console.error("❌ FeatureController.deleteFeature:", error);
    return res.status(500).json({ success: false, message: "Server error deleting feature", error: error.message });
  }
}

/* ---------- CAMERA-FEATURE MAPPINGS ---------- */
export async function getCameraFeatures(req, res) {
  try {
    const { camera_id } = req.params;
    const result = await FeatureModel.getFeaturesByCameraId(parseInt(camera_id));
    return res.status(200).json({ success: true, count: result.rowCount, features: result.rows });
  } catch (error) {
    console.error("❌ FeatureController.getCameraFeatures:", error);
    return res.status(500).json({ success: false, message: "Server error fetching camera features", error: error.message });
  }
}

export async function setCameraFeatures(req, res) {
  try {
    const { camera_id } = req.params;
    const { feature_ids } = req.body;
    if (!Array.isArray(feature_ids)) {
      return res.status(400).json({ success: false, message: "feature_ids must be an array" });
    }
    await FeatureModel.bulkSetCameraFeatures(parseInt(camera_id), feature_ids.map(Number));
    return res.status(200).json({ success: true, message: "Camera features updated successfully" });
  } catch (error) {
    console.error("❌ FeatureController.setCameraFeatures:", error);
    return res.status(500).json({ success: false, message: "Server error setting camera features", error: error.message });
  }
}

export async function toggleFeatureMapping(req, res) {
  try {
    const { mapping_id } = req.params;
    const { on_off_status } = req.body;
    if (on_off_status === undefined) {
      return res.status(400).json({ success: false, message: "on_off_status is required" });
    }
    const result = await FeatureModel.toggleFeatureMapping(parseInt(mapping_id), !!on_off_status);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Mapping not found" });
    return res.status(200).json({ success: true, message: "Feature toggled successfully", mapping: result.rows[0] });
  } catch (error) {
    console.error("❌ FeatureController.toggleFeatureMapping:", error);
    return res.status(500).json({ success: false, message: "Server error toggling feature", error: error.message });
  }
}
