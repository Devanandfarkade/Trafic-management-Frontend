import * as InOutModel from "../models/inOutModel.js";
import { getISTDate } from "../utils/dateUtils.js";

/* ============================================================
 * ADD EVENT(S)
 * Accepts a single event OR array of events from Python WebSocket new_events.
 * Python event shape (vehicle_count_main.py _capture_crossing_event):
 * {
 *   event_id, stream_id, track_id,
 *   vehicle_type, vehicle_display,
 *   direction, direction_arrow, direction_text,
 *   timestamp, time_str,
 *   image_base64
 * }
 * ============================================================ */
export async function addEvent(data) {

  if (Array.isArray(data)) {
    const results = await Promise.all(data.map((e) => InOutModel.insertEvent(e)));
    return {
      success: true,
      count: results.length,
      events: results.map((r) => r.rows[0]).filter(Boolean),
    };
  }

  const result = await InOutModel.insertEvent(data);
  return { success: true, event: result.rows[0] };
}

/* ============================================================
 * GET EVENTS (paginated, filterable)
 * ============================================================ */
export async function getEvents(filters = {}) {
  const result = await InOutModel.getEvents(filters);
  return {
    success: true,
    count: result.rowCount,
    events: result.rows,
  };
}

/* ============================================================
 * GET COUNTS
 * Returns counts matching Python's format:
 * {
 *   car_in, car_out, bike_in, bike_out,
 *   bus_in, bus_out, truck_in, truck_out,
 *   total_in, total_out
 * }
 * ============================================================ */
export async function getCounts({ camera, date, from_date, to_date, zoneId, locationId }) {
  let targetDate = null;
  if (!from_date && !to_date) {
    targetDate = date === "all" ? null : (date || getISTDate());
  }

  const { rows, totals } = await InOutModel.getCounts({ camera, date: targetDate, from_date, to_date, zoneId, locationId });

  // Build flat counts object matching Python's shape
  const counts = {
    car_in: 0, car_out: 0,
    bike_in: 0, bike_out: 0,
    bus_in: 0, bus_out: 0,
    truck_in: 0, truck_out: 0,
    total_in: parseInt(totals.total_in || 0),
    total_out: parseInt(totals.total_out || 0),
  };

  // Map Python vehicle_type names to count keys
  const typeMap = {
    car: "car", bike: "bike", bus: "bus", truck: "truck",
    "bike/scooter": "bike", scooter: "bike", heavy: "truck",
    unknown: null,
  };

  for (const row of rows) {
    const rawType = (row.vehicle_type || "").toLowerCase().replace(/[^a-z/]/g, "");
    const mappedType = typeMap[rawType];
    if (mappedType && row.direction) {
      const key = `${mappedType}_${row.direction}`;
      if (key in counts) {
        counts[key] = (counts[key] || 0) + parseInt(row.count || 0);
      }
    }
  }

  return { success: true, counts };
}
