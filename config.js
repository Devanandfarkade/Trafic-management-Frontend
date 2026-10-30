/* ======================================================
 * NODE BACKEND (Auth + No-Parking + In-Out APIs)
 * Uses VITE_API_BASE_URL from .env
 * ====================================================== */
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "http://localhost:5180";
};

export const API_BASE_URL = getApiBaseUrl();

/* ======================================================
 * PYTHON COMPUTER VISION BACKENDS
 * ====================================================== */
export const API_CONFIG = {
  DEFAULT_WS_URL: import.meta.env.VITE_DEFAULT_WS_URL || "ws://110.227.253.23:8081/live/ws",
  BASE_URL:
    import.meta.env.VITE_VEHICLE_API_URL,
  WS_URL: import.meta.env.VITE_VEHICLE_WS_URL,
  NO_PARKING_API_URL:
    import.meta.env.VITE_NOPARKING_API_URL,
  NO_PARKING_WS_URL:
    import.meta.env.VITE_NOPARKING_WS_URL,
  DEFAULT_GATE_X: parseInt(import.meta.env.VITE_DEFAULT_GATE_X || "640", 10),
  DEFAULT_GATE_Y: parseFloat(import.meta.env.VITE_DEFAULT_GATE_Y || "0.4"),
  DEFAULT_CONFIDENCE: parseFloat(
    import.meta.env.VITE_DEFAULT_CONFIDENCE || "0.25",
  ),
  INCIDENTS_API_URL:
    import.meta.env.VITE_INCIDENTS_API_URL,
  INCIDENTS_WS_URL:
    import.meta.env.VITE_INCIDENTS_WS_URL,
  FACE_RECOGNITION_API_URL:
    import.meta.env.VITE_FACE_RECOGNITION_API_URL,
  FACE_RECOGNITION_WS_URL:
    import.meta.env.VITE_FACE_RECOGNITION_WS_URL,
  CRIMINAL_DETECTION_API_URL:
    import.meta.env.VITE_CRIMINAL_DETECTION_API_URL || "http://110.227.253.23:8090",
  CRIMINAL_DETECTION_WS_URL:
    import.meta.env.VITE_CRIMINAL_DETECTION_WS_URL || "ws://110.227.253.23:8090",
  RTSP_CRIMINAL_CAM:
    import.meta.env.VITE_RTSP_CRIMINAL_CAM || "rtsp://admin:Admin%40123@192.168.1.21:554",
  TRIPLE_RIDING_API_URL:
    import.meta.env.VITE_TRIPLE_RIDING_API_URL || "http://110.227.253.23:8091",
  TRIPLE_RIDING_WS_URL:
    import.meta.env.VITE_TRIPLE_RIDING_WS_URL || "ws://110.227.253.23:8091",
  RTSP_TRIPLE_RIDING_CAM:
    import.meta.env.VITE_RTSP_TRIPLE_RIDING_CAM || "rtsp://admin:Admin%40123@192.168.1.21:554",
  LICENSE_PLATE_API_URL:
    import.meta.env.VITE_LICENSE_PLATE_API_URL,
  LICENSE_PLATE_WS_URL:
    import.meta.env.VITE_LICENSE_PLATE_WS_URL,
  UNKNOWN_PERSON_WS_URL:
    import.meta.env.VITE_UNKNOWN_PERSON_WS_URL,
  HEAVY_VEHICLE_HOST:
    import.meta.env.VITE_HEAVY_VEHICLE_HOST || "110.227.253.23",
  HEAVY_VEHICLE_SERVICES: {
    cement_mixer: {
      port: import.meta.env.VITE_CEMENT_MIXER_PORT || 9010,
      wsPath: "/cementmixer/ws",
      name: "Cement Mixer",
      color: "#0000FF" // Blue
    },
    excavator: {
      port: import.meta.env.VITE_EXCAVATOR_PORT || 9011,
      wsPath: "/excavator/ws",
      name: "Excavator",
      color: "#FF69B4" // Hot Pink
    },
    roller_compactor: {
      port: import.meta.env.VITE_ROLLER_COMPACTOR_PORT || 9012,
      wsPath: "/rollercompactor/ws",
      name: "Roller Compactor",
      color: "#00FF00" // Green
    },
    tower_crane: {
      port: import.meta.env.VITE_TOWER_CRANE_PORT || 9013,
      wsPath: "/towercrane/ws",
      name: "Tower Crane",
      color: "#FFFF00" // Yellow
    },
    dump_truck: {
      port: import.meta.env.VITE_DUMP_TRUCK_PORT || 9014,
      wsPath: "/dumptruck/ws",
      name: "Dump Truck",
      color: "#FFA500" // Orange
    }
  },

  ENDPOINTS: {
    ROOT: "/",
    HEALTH: "/health",
    STATUS: "/vehicles/status",
    TEST: "/vehicles/test",
    WS: "/vehicles/ws",
  },
};

