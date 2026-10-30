import * as HeavyVehicleService from "../services/heavyVehicleService.js";

export async function createDetection(req, res) {
  try {
    const { camera, vehicle_type, confidence, image_path, rtsp_url, detected_at } = req.body;
    if (!camera && !rtsp_url) {
      return res.status(400).json({ success: false, message: "camera or rtsp_url is required" });
    }
    const result = await HeavyVehicleService.createDetection({
      camera: camera || rtsp_url,
      vehicle_type,
      confidence,
      image_path,
      rtsp_url,
      detected_at,
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error("❌ HeavyVehicleController.createDetection:", error);
    return res.status(500).json({ success: false, message: "Server error recording detection", error: error.message });
  }
}

export async function listDetections(req, res) {
  try {
    const { camera, vehicle_type, date, from_date, to_date, startDate, endDate, status, page, limit, zone_id, location_id, camera_id } = req.query;
    const result = await HeavyVehicleService.getDetections({
      camera: camera || camera_id,
      zoneId: zone_id,
      locationId: location_id,
      vehicle_type,
      date,
      from_date,
      to_date,
      startDate,
      endDate,
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ HeavyVehicleController.listDetections:", error);
    return res.status(500).json({ success: false, message: "Server error fetching detections", error: error.message });
  }
}

export async function getStats(req, res) {
  try {
    const { date, camera_id, camera, zone_id, location_id } = req.query;
    const result = await HeavyVehicleService.getStats(date, camera || camera_id, zone_id, location_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ HeavyVehicleController.getStats:", error);
    return res.status(500).json({ success: false, message: "Server error fetching stats", error: error.message });
  }
}
