export const resolveCameraDetails = (record, camerasList, fallbackCamera = null) => {
  if (!record) return { zone: 'Unknown', location: 'Unknown', camera: 'Unknown' };
  
  // Get raw properties from the record which might contain camera references
  const raw = record.raw || record;
  const camRef = raw.camera_id || raw.camera || raw.stream_id || raw.camera_code || record.camera;
  const urlRef = raw.rtsp_url || record.rtsp_url;

  // Try to find an exact match in the cameras list from context
  let matched = null;
  if (camerasList && camerasList.length > 0) {
    matched = camerasList.find(c => 
      (camRef && (String(c.value) === String(camRef) || String(c.id) === String(camRef) || c.label === camRef || c.name === camRef)) ||
      (urlRef && c.url === urlRef)
    );
  }

  // If no match found in list, fallback to the globally selected camera if provided
  if (!matched && fallbackCamera) {
    matched = fallbackCamera;
  }

  // Determine Zone
  let zone = raw.zone;
  if (!zone || zone === 'Unknown') zone = record.zone;
  if (!zone || zone === 'Unknown') zone = matched?.zone_name;
  if (!zone || zone === 'Unknown') zone = matched?.zone?.name;
  if (!zone || zone === 'Unknown') zone = matched?.zone;
  if (!zone) zone = 'Unknown';
  if (typeof zone === 'object' && zone !== null) {
      zone = zone.name || 'Unknown';
  }

  // Determine Location
  let location = raw.location;
  if (!location || location === 'Unknown') location = record.location;
  if (!location || location === 'Unknown') location = matched?.location?.name;
  if (!location || location === 'Unknown') location = matched?.location;
  if (!location) location = 'Unknown';
  if (typeof location === 'object' && location !== null) {
      location = location.name || 'Unknown';
  }

  // Fallback for location based on camera label convention (e.g. "CAM01 - LOCATION_NAME")
  if (location === 'Unknown' && matched?.label && matched.label.includes(' - ')) {
    location = matched.label.split(' - ')[1].trim();
  }

  // Determine Camera Name
  let camera = raw.camera_name;
  if (!camera || camera === 'Unknown' || !isNaN(Number(camera))) camera = raw.camera;
  if (!camera || camera === 'Unknown' || !isNaN(Number(camera))) camera = record.camera_name;
  if (!camera || camera === 'Unknown' || !isNaN(Number(camera))) camera = record.camera;
  if (!camera || camera === 'Unknown' || !isNaN(Number(camera))) camera = matched?.label;
  if (!camera || camera === 'Unknown' || !isNaN(Number(camera))) camera = matched?.name;
  if (!camera || camera === 'Unknown' || !isNaN(Number(camera))) camera = camRef;
  if (!camera || !isNaN(Number(camera))) camera = 'Unknown';

  return { zone, location, camera };
};

