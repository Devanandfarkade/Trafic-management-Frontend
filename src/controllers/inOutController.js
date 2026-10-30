import * as InOutService from "../services/inOutService.js";

/* ============================================================
 * POST /api/in-out/events
 *
 * Accepts crossing event(s) from Python vehicle_count_main.py.
 * Python sends events via WebSocket "new_events" array.
 * Frontend relays these to Node for persistence.
 *
 * Python event shape (_capture_crossing_event):
 * {
 *   event_id: number,       // auto-increment per stream
 *   stream_id: string,
 *   track_id: number,
 *   vehicle_type: string,   // "car", "bike", "bus", "truck"
 *   vehicle_display: string,// "🚗 Car", "🏍️ Bike/Scooter", etc.
 *   direction: "in"|"out",
 *   direction_arrow: "⬇"|"⬆",
 *   direction_text: "IN"|"OUT",
 *   timestamp: ISO string,
 *   time_str: "YYYY-MM-DD HH:MM:SS.mmm",
 *   image_base64: string    // base64 JPEG of crossing frame
 * }
 *
 * Accepts single event object OR array (batch from frontend relay)
 * ============================================================ */
export async function createEvent(req, res) {
  try {
    const result = await InOutService.addEvent(req.body);
    return res.status(201).json(result);
  } catch (error) {
    console.error("❌ InOutController.createEvent:", error);
    return res.status(500).json({
      success: false,
      message: "Server error saving event",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/in-out/events
 * Query params: camera, stream_id, vehicle_type, direction, date, page, limit
 *
 * Returns events sorted by event_time DESC.
 * Each event mirrors Python's _capture_crossing_event shape.
 * ============================================================ */
export async function listEvents(req, res) {
  try {
    const { camera, stream_id, vehicle_type, direction, date, from_date, to_date, startDate, endDate, page, limit, zone_id, location_id, camera_id } = req.query;
    const result = await InOutService.getEvents({
      camera: camera || camera_id,
      zoneId: zone_id,
      locationId: location_id,
      stream_id,
      vehicle_type,
      direction,
      date,
      from_date,
      to_date,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 100,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ InOutController.listEvents:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching events",
      error: error.message,
    });
  }
}

/* ============================================================
 * GET /api/in-out/counts
 * Returns aggregated counts matching Python's vehicle_count_main.py counts shape:
 * {
 *   car_in, car_out, bike_in, bike_out,
 *   bus_in, bus_out, truck_in, truck_out,
 *   total_in, total_out
 * }
 * Query params: camera (optional), date (optional)
 * ============================================================ */
export async function getCounts(req, res) {
  try {
    const { camera, date, from_date, to_date, zone_id, location_id, camera_id } = req.query;
    const result = await InOutService.getCounts({
      camera: camera || camera_id,
      date,
      from_date,
      to_date,
      zoneId: zone_id,
      locationId: location_id
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ InOutController.getCounts:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching counts",
      error: error.message,
    });
  }
}
