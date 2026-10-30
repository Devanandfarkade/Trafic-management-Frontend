import * as LocationModel from "../models/locationModel.js";

const isNumericOnly = (val) => {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  return /^\d+$/.test(trimmed) || !/\p{L}/u.test(trimmed);
};

/* ============================================================
 * ZONES (formerly Premises)
 * ============================================================ */
export async function listZones(req, res) {
  try {
    const result = await LocationModel.getAllZones();
    return res.status(200).json({ success: true, count: result.rowCount, zones: result.rows });
  } catch (error) {
    console.error("❌ LocationController.listZones:", error);
    return res.status(500).json({ success: false, message: "Server error fetching zones", error: error.message });
  }
}

export async function createZone(req, res) {
  try {
    const { name, description, type, location, property } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Zone name is required" });
    if (isNumericOnly(name)) {
      return res.status(400).json({ success: false, message: "Zone name cannot be numeric only. It must contain letters." });
    }
    if (location && isNumericOnly(location)) {
      return res.status(400).json({ success: false, message: "City/Area cannot be numeric only. It must contain letters." });
    }
    const result = await LocationModel.createZone({ name: name.trim(), description, type, location: location?.trim(), property });
    return res.status(201).json({ success: true, message: "Zone created successfully", zone: result.rows[0] });
  } catch (error) {
    console.error("❌ LocationController.createZone:", error);
    return res.status(500).json({ success: false, message: "Server error creating zone", error: error.message });
  }
}

export async function updateZone(req, res) {
  try {
    const { id } = req.params;
    const { name, description, type, location, property, isactive } = req.body;
    if (name !== undefined) {
      if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Zone name is required" });
      if (isNumericOnly(name)) {
        return res.status(400).json({ success: false, message: "Zone name cannot be numeric only. It must contain letters." });
      }
    }
    if (location && isNumericOnly(location)) {
      return res.status(400).json({ success: false, message: "City/Area cannot be numeric only. It must contain letters." });
    }
    const result = await LocationModel.updateZone(id, { name: name?.trim(), description, type, location: location?.trim(), property, isactive });
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Zone not found" });
    return res.status(200).json({ success: true, message: "Zone updated successfully", zone: result.rows[0] });
  } catch (error) {
    console.error("❌ LocationController.updateZone:", error);
    return res.status(500).json({ success: false, message: "Server error updating zone", error: error.message });
  }
}

export async function deleteZone(req, res) {
  try {
    const { id } = req.params;
    const result = await LocationModel.deleteZone(id);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Zone not found" });
    return res.status(200).json({ success: true, message: "Zone deleted successfully" });
  } catch (error) {
    console.error("❌ LocationController.deleteZone:", error);
    return res.status(500).json({ success: false, message: "Server error deleting zone", error: error.message });
  }
}

/* ============================================================
 * LOCATIONS
 * ============================================================ */
export async function listLocations(req, res) {
  try {
    const result = await LocationModel.getAllLocations();
    return res.status(200).json({ success: true, count: result.rowCount, locations: result.rows });
  } catch (error) {
    console.error("❌ LocationController.listLocations:", error);
    return res.status(500).json({ success: false, message: "Server error fetching locations", error: error.message });
  }
}

export async function listLocationsByZone(req, res) {
  try {
    const { zone_id } = req.params;
    const result = await LocationModel.getLocationsByZoneId(parseInt(zone_id));
    return res.status(200).json({ success: true, count: result.rowCount, locations: result.rows });
  } catch (error) {
    console.error("❌ LocationController.listLocationsByZone:", error);
    return res.status(500).json({ success: false, message: "Server error fetching locations by zone", error: error.message });
  }
}

export async function createLocation(req, res) {
  try {
    const { name, description, city, state, country, zone_id, latitude, longitude, address, location_type, isactive } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Location name is required" });
    if (isNumericOnly(name)) {
      return res.status(400).json({ success: false, message: "Location name cannot be numeric only. It must contain letters." });
    }
    if (city && isNumericOnly(city)) {
      return res.status(400).json({ success: false, message: "City cannot be numeric only. It must contain letters." });
    }
    if (state && isNumericOnly(state)) {
      return res.status(400).json({ success: false, message: "State cannot be numeric only. It must contain letters." });
    }
    const result = await LocationModel.createLocation({ name: name.trim(), description, city: city?.trim(), state: state?.trim(), country, zone_id, latitude, longitude, address, location_type, isactive });
    return res.status(201).json({ success: true, message: "Location created successfully", location: result.rows[0] });
  } catch (error) {
    console.error("❌ LocationController.createLocation:", error);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: "Location name already exist please try another name", error: error.message });
    }
    return res.status(500).json({ success: false, message: "Server error creating location", error: error.message });
  }
}

export async function updateLocation(req, res) {
  try {
    const { id } = req.params;
    const { name, description, city, state, country, zone_id, latitude, longitude, address, location_type, isactive } = req.body;
    if (name !== undefined) {
      if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Location name is required" });
      if (isNumericOnly(name)) {
        return res.status(400).json({ success: false, message: "Location name cannot be numeric only. It must contain letters." });
      }
    }
    if (city && isNumericOnly(city)) {
      return res.status(400).json({ success: false, message: "City cannot be numeric only. It must contain letters." });
    }
    if (state && isNumericOnly(state)) {
      return res.status(400).json({ success: false, message: "State cannot be numeric only. It must contain letters." });
    }
    const result = await LocationModel.updateLocation(id, { name: name?.trim(), description, city: city?.trim(), state: state?.trim(), country, zone_id, latitude, longitude, address, location_type, isactive });
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Location not found" });
    return res.status(200).json({ success: true, message: "Location updated successfully", location: result.rows[0] });
  } catch (error) {
    console.error("❌ LocationController.updateLocation:", error);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: "Location name already exist please try another name", error: error.message });
    }
    return res.status(500).json({ success: false, message: "Server error updating location", error: error.message });
  }
}

export async function deleteLocation(req, res) {
  try {
    const { id } = req.params;
    const result = await LocationModel.deleteLocation(id);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Location not found" });
    return res.status(200).json({ success: true, message: "Location deleted successfully", id });
  } catch (error) {
    console.error("❌ LocationController.deleteLocation:", error);
    return res.status(500).json({ success: false, message: "Server error deleting location", error: error.message });
  }
}

export async function listCameraLocations(req, res) {
  try {
    const { module_type } = req.params;
    const result = await LocationModel.getCameraLocations(module_type || null);
    return res.status(200).json({ success: true, count: result.rowCount, locations: result.rows.map(r => r.location).filter(Boolean) });
  } catch (error) {
    console.error("❌ LocationController.listCameraLocations:", error);
    return res.status(500).json({ success: false, message: "Server error fetching camera locations", error: error.message });
  }
}