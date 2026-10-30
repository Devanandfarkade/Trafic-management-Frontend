import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  CarFront,
  Ban,
  MapPin,
  Clock,
  Camera as CameraIcon,
  Car,
  Maximize,
  Minimize,
  Eye,
  Settings, RefreshCw, Pencil
} from 'lucide-react';
import { useTheme } from '../../ui/Settings/themeUtils';
import { useToast } from '../../ui/common/CustomToast';
import BottomStatCard from '../../ui/common/BottomStatCard';
import ModuleLayout from '../../ui/layout/ModuleLayout';
import PaginatedTable from '../../ui/common/PaginatedTable';
import RightSideDialog from '../../ui/common/RightSideDialog';
import SearchBar from '../../ui/common/SearchBar';
import { API_CONFIG, API_BASE_URL } from '../../../config.js';
import useCameraFilter from '../../hooks/useCameraFilter';
import CameraSettingsDrawer from '../../ui/common/CameraSettingsDrawer';
import LiveCameraCard from '../LiveMonitoring/LiveCameraCard';
import Pagination from '../../ui/common/Pagination';
import RecordsPerPage from '../../ui/common/RecordsPerPage';
import DateRangePicker from '../../ui/common/DateRangePicker';
import { resolveCameraDetails } from '../../utils/cameraUtils';
import { getTodayStr, toLocalDateStr } from '../../utils/dateUtils';
import NoParkingZoneDrawer from './NoParkingZoneDrawer';

const WS_BACKEND_URL = API_CONFIG.NO_PARKING_WS_URL;
const REST_BACKEND_URL = API_CONFIG.NO_PARKING_API_URL;

/**
 * Convert DB-stored relative path (uploads\no-parking-detections\file.jpg)
 * to a full URL accessible from the frontend.
 * e.g. → http://192.168.1.32:8001/uploads/no-parking-detections/file.jpg
 */
function getImageUrl(relativePath) {
  if (!relativePath) return null;
  // Convert backslashes to forward slashes, strip leading slash if API_BASE_URL already ends without one
  const urlPath = relativePath.replace(/\\/g, '/').replace(/^\//, '');
  return `${API_BASE_URL}/${urlPath}`;
}

/** Best image src for a violation row — prefers saved file, falls back to base64 */
function getViolationImageSrc(row) {
  if (row.violation_image_path) return getImageUrl(row.violation_image_path);
  if (row.violation_image_base64) {
    return row.violation_image_base64.startsWith('data:')
      ? row.violation_image_base64
      : `data:image/jpeg;base64,${row.violation_image_base64}`;
  }
  if (row.image) return row.image.startsWith('data:') ? row.image : `data:image/jpeg;base64,${row.image}`;
  return null;
}

const DEFAULT_CAMERAS = [];

// --- Custom Hook for Stream Connection ---
// wsUrl: resolved WS endpoint (active feature WS or default WS from useCameraFilter)
// rtspUrl: RTSP URL to stream from
const useNoParkingStream = (wsUrl, rtspUrl, onNewViolation, seenViolationIdRef, selectedCamera) => {
  const [isConnected, setIsConnected] = useState(false);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState(null);
  const [streamId, setStreamId] = useState(null);
  const [zoneConfigured, setZoneConfigured] = useState(null);
  const [serverZone, setServerZone] = useState(null);
  const wsRef = useRef(null);
  const frameTimeoutRef = useRef(null);

  // Keep the latest callback without triggering effect re-runs
  const onNewViolationRef = useRef(onNewViolation);
  useEffect(() => {
    onNewViolationRef.current = onNewViolation;
  }, [onNewViolation]);

  useEffect(() => {
    if (!rtspUrl) return;

    let isMounted = true;
    let primaryRetries = 0;
    const MAX_PRIMARY_RETRIES = 3;
    let fallbackActive = false;
    let backgroundCheckTimer = null;
    let frameTimeoutId = null;

    setStreamId(null);
    setZoneConfigured(null);
    setServerZone(null);

    const defaultWs = API_CONFIG.DEFAULT_WS_URL || "ws://110.227.253.23:8081/live/ws";

    // Use the camera's resolved ws_url (from useCameraFilter) as primary.
    const isFeatureActive = selectedCamera?.features?.some(f => f.name === "AI No Parking Zone Monitoring System" && f.on_off_status);
    const primaryWsUrlBase = isFeatureActive && WS_BACKEND_URL
      ? `${WS_BACKEND_URL}/ws`
      : (wsUrl || defaultWs);

    const buildUrl = (baseUrl) => {
      if (!baseUrl) return null;
      const sep = baseUrl.includes("?") ? "&" : "?";
      let url = baseUrl.includes("rtsp_url=") ? baseUrl : `${baseUrl}${sep}rtsp_url=${encodeURIComponent(rtspUrl)}`;

      // Attach optional saved zone on connect: ws://HOST/ws?rtsp_url=...&zone=x1,y1,x2,y2
      try {
        const camKey = String(selectedCamera?.camera_id || selectedCamera?.id || selectedCamera?.value || selectedCamera?.name || 'default');
        const saved = localStorage.getItem(`no_parking_zone_${camKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          const box = Array.isArray(parsed.boxes) ? parsed.boxes[0] : (parsed.x !== undefined ? parsed : null);
          if (box && typeof box.x === 'number') {
            const vw = 1280;
            const vh = 720;
            const x1 = Math.round(box.x * vw);
            const y1 = Math.round(box.y * vh);
            const x2 = Math.round((box.x + box.width) * vw);
            const y2 = Math.round((box.y + box.height) * vh);
            url += `&zone=${x1},${y1},${x2},${y2}`;
          }
        }
      } catch (e) { }

      return url;
    };

    const primaryWsUrl = buildUrl(primaryWsUrlBase);
    const fallbackWsUrl = buildUrl(defaultWs);

    const clearFrameTimeout = () => {
      if (frameTimeoutId) { clearTimeout(frameTimeoutId); frameTimeoutId = null; }
    };

    const cleanupWs = () => {
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    const startBackgroundCheck = () => {
      if (!primaryWsUrl || primaryWsUrl === fallbackWsUrl) return;
      if (backgroundCheckTimer) clearInterval(backgroundCheckTimer);

      backgroundCheckTimer = setInterval(() => {
        if (!isMounted) return;
        console.log(`[NoParking] Checking if primary WS is back for camera ${selectedCamera?.value}...`);
        const testWs = new WebSocket(primaryWsUrl);
        testWs.onopen = () => {
          console.log(`[NoParking] Primary WS is back! Switching...`);
          testWs.close();
          clearInterval(backgroundCheckTimer);
          backgroundCheckTimer = null;
          fallbackActive = false;
          primaryRetries = 0;
          connectToUrl(primaryWsUrl);
        };
        testWs.onerror = () => testWs.close();
      }, 10000);
    };

    const handleConnectionFailure = (failedUrl) => {
      if (!isMounted) return;
      cleanupWs();
      clearFrameTimeout();

      if (failedUrl === primaryWsUrl && primaryWsUrl !== fallbackWsUrl) {
        if (primaryRetries < MAX_PRIMARY_RETRIES) {
          primaryRetries++;
          console.log(`[NoParking] Primary WS failed. Retrying (${primaryRetries}/${MAX_PRIMARY_RETRIES})...`);
          setTimeout(() => { if (isMounted) connectToUrl(primaryWsUrl); }, 2000);
        } else {
          console.log(`[NoParking] Primary WS failed after retries. Switching to fallback...`);
          fallbackActive = true;
          connectToUrl(fallbackWsUrl);
        }
      } else {
        setIsConnected(false);
        setTimeout(() => { if (isMounted) connectToUrl(failedUrl); }, 5000);
      }
    };

    const connectToUrl = (targetUrl) => {
      if (!isMounted || !targetUrl) return;
      cleanupWs();

      const isFallbackConnection = targetUrl === fallbackWsUrl && primaryWsUrl !== fallbackWsUrl;
      if (!isFallbackConnection) setIsConnected(false);

      try {
        const ws = new WebSocket(targetUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          console.log('NoParking WS connected:', targetUrl);
          setIsConnected(true);

          // Query current zone configuration immediately via WebSocket
          try {
            ws.send(JSON.stringify({ action: "get_zone" }));
          } catch (_) { }

          if (isFallbackConnection) startBackgroundCheck();

          clearFrameTimeout();
          frameTimeoutId = setTimeout(() => {
            if (!isMounted) return;
            handleConnectionFailure(targetUrl);
          }, 8000);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          let handled = false;

          if (typeof event.data === "string") {
            try {
              const data = JSON.parse(event.data);

              // Handle WebSocket zone acknowledgments
              if (data.ack === "set_zone") {
                if (data.ok) {
                  setZoneConfigured(true);
                  if (data.zone) setServerZone(data.zone);
                } else {
                  console.warn('[NoParking] set_zone failed on WS:', data.error);
                }
              } else if (data.ack === "clear_zone") {
                if (data.ok) {
                  setZoneConfigured(false);
                  setServerZone(null);
                }
              } else if (data.ack === "get_zone") {
                if (data.zone_configured !== undefined) {
                  setZoneConfigured(Boolean(data.zone_configured));
                }
                if (data.zone !== undefined) {
                  setServerZone(data.zone);
                }
              }

              const frameB64 = data.frame || data.image || data.jpeg || data.data;
              if (frameB64) {
                clearFrameTimeout();
                const frameSrc = frameB64.startsWith("data:")
                  ? frameB64
                  : `data:image/jpeg;base64,${frameB64}`;
                setFrame(frameSrc);
                handled = true;
              }
              if (data.status) {
                setStatus(data.status);
              }
              if (data.stream_id) {
                setStreamId(data.stream_id);
              }
              if (data.zone_configured !== undefined) {
                setZoneConfigured(Boolean(data.zone_configured));
              }
              if (data.zone !== undefined) {
                setServerZone(data.zone);
              }
              const violation = data.latest_violation || (data.status && data.status.latest_violation_data);
              if (violation) {
                const vid = violation.violation_id || violation.vehicle_id;
                if (seenViolationIdRef.current !== vid) {
                  seenViolationIdRef.current = vid;
                  if (onNewViolationRef.current) {
                    onNewViolationRef.current(violation);
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing WebSocket message:', e);
            }
          }

          if (!handled && event.data instanceof Blob) {
            clearFrameTimeout();
            const reader = new FileReader();
            reader.onload = () => { if (isMounted) setFrame(reader.result); };
            reader.readAsDataURL(event.data);
          } else if (!handled && event.data instanceof ArrayBuffer) {
            clearFrameTimeout();
            const blob = new Blob([event.data], { type: "image/jpeg" });
            setFrame(URL.createObjectURL(blob));
          }
        };

        ws.onerror = () => {
          if (!isMounted) return;
          handleConnectionFailure(targetUrl);
        };

        ws.onclose = () => {
          if (!isMounted) return;
          clearFrameTimeout();
          handleConnectionFailure(targetUrl);
        };
      } catch (e) {
        handleConnectionFailure(targetUrl);
      }
    };

    connectToUrl(primaryWsUrl || fallbackWsUrl);

    return () => {
      isMounted = false;
      cleanupWs();
      clearFrameTimeout();
      if (backgroundCheckTimer) clearInterval(backgroundCheckTimer);
    };
  }, [wsUrl, rtspUrl, seenViolationIdRef, selectedCamera]);

  const sendMessage = React.useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
        return true;
      } catch (err) {
        console.warn('[NoParking] Error sending WS message:', err);
      }
    }
    return false;
  }, []);

  return { isConnected, frame, status, sendMessage, streamId, zoneConfigured, serverZone, setZoneConfigured, setServerZone };
};

// --- Main Dashboard Component ---
export default function NoParkingMonitoringSystem() {
  const { theme, themeUtils } = useTheme();

  const [refreshKey, setRefreshKey] = useState(0);
  const isDark = theme.mode === "Dark";

  const [currentTime, setCurrentTime] = useState(new Date());

  const cameraFilter = useCameraFilter('no_parking');
  const { allCameras: cameras, selectedCamera: currentCam } = cameraFilter;
  const selectedCamera = currentCam || (cameras.length > 0 ? cameras[0] : null) || { value: '', label: '', url: '' };

  /**
   * Resolve the human-readable location for a violation row.
   * Priority: violation.location (from DB) → camera match by stream_id/camera code → selected camera location
   */
  const resolveLocation = (v) => {
    if (v.location && v.location !== 'Unknown') return v.location;
    const details = resolveCameraDetails(v, cameras, selectedCamera);
    return details.location;
  };

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState(() => location.state?.fromDate || searchParams.get('fromDate') || "");
  const [toDate, setToDate] = useState(() => location.state?.toDate || searchParams.get('toDate') || "");

  useEffect(() => {
    const from = location.state?.fromDate || searchParams.get('fromDate') || "";
    const to = location.state?.toDate || searchParams.get('toDate') || "";
    setFromDate(from);
    setToDate(to);
  }, [location.pathname, location.search, location.key]);

  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState(""); // Loaded dynamically from DB
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  // API Data State
  const [violations, setViolations] = useState([]);
  const toast = useToast();

  // Shared ref that tracks the last violation ID we've already shown a toast for.
  // Pre-seeded from the DB so page refresh never re-fires old toasts.
  const seenViolationIdRef = useRef(null);

  const handleNewViolation = React.useCallback((violation) => {
    // Inject the camera location + rtsp_url from our cameras list before saving/displaying.
    // selectedCamera.url is the RTSP URL of the currently active stream.
    // The backend uses rtsp_url to JOIN cameras table for location resolution.
    const detectedCamera = cameras.find(c => c.url === violation.rtsp_url || c.value === violation.camera || c.url === selectedCamera?.url);
    const enrichedViolation = {
      ...violation,
      location: violation.location || detectedCamera?.location || selectedCamera?.location || null,
      camera: violation.camera || selectedCamera?.value || null,
      rtsp_url: violation.rtsp_url || detectedCamera?.url || selectedCamera?.url || null,
    };

    toast.error(
      "NO PARKING VIOLATION",
      `Vehicle ${enrichedViolation.plate} (ID: #${enrichedViolation.vehicle_id}) parked in No Parking Zone`
    );
    // Add new violation to the top of the list instantly
    setViolations(prev => [enrichedViolation, ...prev].slice(0, 50));

    // Persist to Node backend (violation matches Python's exact violation result shape)
    if (API_BASE_URL) {
      fetch(`${API_BASE_URL}/api/no-parking/violations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichedViolation),
      }).catch((err) => console.error('Failed to persist violation to Node backend:', err));
    }
  }, [toast, cameras, selectedCamera, refreshKey]);

  // Use the custom hook for the stream — pass camera's ws_url (resolved to active feature or default WS)
  const {
    isConnected: streamConnected,
    frame: streamFrame,
    status: streamStatus,
    sendMessage: sendWsMessage,
    streamId,
    zoneConfigured,
    serverZone,
    setZoneConfigured,
    setServerZone,
  } = useNoParkingStream(
    selectedCamera?.ws_url,
    selectedCamera?.url,
    handleNewViolation,
    seenViolationIdRef,
    selectedCamera
  );

  const imgRef = useRef(null);
  const [videoResolution, setVideoResolution] = useState({ width: 1280, height: 720 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isZoneEditing, setIsZoneEditing] = useState(false);

  // Real-time Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshKey]);

  const fetchViolations = async () => {
    if (!API_BASE_URL) return;
    try {
      let url = `${API_BASE_URL}/api/no-parking/violations`;
      const searchParams = new URLSearchParams();
      if (cameraFilter?.filters?.zone && cameraFilter.filters.zone !== 'all') searchParams.append('zone_id', cameraFilter.filters.zone);
      if (cameraFilter?.filters?.location && cameraFilter.filters.location !== 'all') searchParams.append('location_id', cameraFilter.filters.location);
      if (cameraFilter?.filters?.cameraId && cameraFilter.filters.cameraId !== 'all') searchParams.append('camera_id', cameraFilter.filters.cameraId);

      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;

      const response = await fetch(url);
      const data = await response.json();
      const loaded = data.violations || [];
      setViolations(loaded);
      // Seed the seen-ref with the most-recent violation from DB so the WebSocket
      // doesn't re-fire the toast for a violation that already happened before this page load.
      if (seenViolationIdRef.current === null && loaded.length > 0) {
        const latest = loaded[0]; // DB returns DESC order
        seenViolationIdRef.current = latest.violation_id || String(latest.vehicle_id);
      }
    } catch (error) {
      console.error('Error fetching violations from Node backend:', error);
    }
  };

  useEffect(() => {
    fetchViolations();
    // Refresh violations every 3 seconds
    const interval = setInterval(fetchViolations, 3000);
    return () => clearInterval(interval);
  }, [refreshKey, cameraFilter?.filters?.zone, cameraFilter?.filters?.location, cameraFilter?.filters?.cameraId]);

  const getPastTime = (minutesAgo) => {
    const d = new Date(currentTime.getTime() - minutesAgo * 60 * 1000);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).toUpperCase();

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor?.() || (isDark ? "#1e2a40" : "#e5e7eb");
  const videoBg = themeUtils.getBgColor?.('panel') || (isDark ? "#1c2430" : "#e5e7eb");
  const simulatedVideoBg = isDark ? "#2b3340" : "#d1d5db";

  const videoComponent = (
    <div
      className={
        isMaximized
          ? "fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
          : `relative w-full h-full min-h-[350px] rounded-lg border overflow-hidden flex items-center justify-center bg-black`
      }
      style={{ backgroundColor: isMaximized ? undefined : videoBg, borderColor: isMaximized ? undefined : borderColor }}
    >
      {/* Video Wrapper with matched aspect ratio to eliminate letterbox/black bars */}
      <div
        className="video-wrap relative flex items-center justify-center overflow-hidden rounded-md"
        style={{
          aspectRatio: videoResolution?.width && videoResolution?.height
            ? `${videoResolution.width} / ${videoResolution.height}`
            : '16 / 9',
          width: '100%',
          maxHeight: isMaximized ? '92vh' : '100%',
        }}
      >
        {/* Live WebSocket RTSP Stream / Fallback Image */}
        {streamConnected && streamFrame ? (
          <img
            id="video"
            ref={imgRef}
            src={streamFrame}
            alt="Live Camera Feed"
            onLoad={(e) => {
              if (e.target.naturalWidth && e.target.naturalHeight) {
                setVideoResolution({
                  width: e.target.naturalWidth,
                  height: e.target.naturalHeight,
                });
              }
            }}
            className="w-full h-full block select-none"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
            }}
          />
        ) : (
          <div
            className={`w-full h-full min-h-[300px] flex flex-col items-center justify-center opacity-40 transition-colors z-0 ${isMaximized ? "bg-black" : ""}`}
            style={{ backgroundColor: isMaximized ? undefined : simulatedVideoBg }}
          >
            <CameraIcon size={48} className={isDark ? "text-gray-600 mb-2" : "text-gray-400 mb-2"} />
            <span className={isDark ? "text-gray-500" : "text-gray-600"}>
              {!streamConnected ? "Connecting to Python Backend..." : "Waiting for Video Feed..."}
            </span>
          </div>
        )}

        {/* Interactive No Parking Zone Drawer (Mounted directly over the <img>) */}
        <NoParkingZoneDrawer
          imgRef={imgRef}
          selectedCamera={selectedCamera}
          sendMessage={sendWsMessage}
          toast={toast}
          isEditing={isZoneEditing}
          setIsEditing={setIsZoneEditing}
          isMaximized={isMaximized}
          streamId={streamId}
          pythonApiUrl={REST_BACKEND_URL}
          videoResolution={videoResolution}
          zoneConfigured={zoneConfigured}
          serverZone={serverZone}
          onZoneConfiguredChange={(configured, zone) => {
            setZoneConfigured(configured);
            if (zone) setServerZone(zone);
          }}
        />
      </div>

      {/* Overlay Data Header */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-20 pointer-events-none">
        {/* Left Badge */}
        <div className="px-3 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold tracking-wider flex items-center gap-2 pointer-events-auto shadow-md">
          <CameraIcon size={12} className="text-blue-400" />
          <span>{selectedCamera?.label || selectedCamera?.name || "NO PARKING ENFORCEMENT CAMERA"}</span>
        </div>

        {/* Right Badges & Controls */}
        <div className="flex gap-2 pointer-events-auto items-center">
          {/* Zone configured status indicator */}
          {zoneConfigured === true && (
            <div className="px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 border shadow-md bg-emerald-950/70 text-emerald-400 border-emerald-800/80 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>ZONE ACTIVE</span>
            </div>
          )}

          <div className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 border shadow-md ${!streamConnected ? 'bg-yellow-900/60 text-yellow-400 border-yellow-700/80 backdrop-blur-md' : !streamFrame ? 'bg-orange-900/60 text-orange-400 border-orange-700/80 backdrop-blur-md' : 'bg-red-950/70 text-red-400 border-red-800/80 backdrop-blur-md'}`}>
            <div className={`w-2 h-2 rounded-full ${!streamConnected ? 'bg-yellow-400' : !streamFrame ? 'bg-orange-400 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
            {!streamConnected ? 'CONNECTING...' : !streamFrame ? 'BUFFERING...' : 'LIVE'}
          </div>

          {/* Settings Icon Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSettingsDrawerOpen(true);
            }}
            className="p-1.5 rounded-md bg-black/70 hover:bg-black/90 text-blue-400 hover:text-blue-300 border border-blue-500/40 hover:border-blue-400 backdrop-blur-md transition-all cursor-pointer shadow-md flex items-center justify-center"
            title="Camera Settings & AI Features"
          >
            <Settings size={16} className="hover:rotate-90 transition-transform duration-300" />
          </button>

          {/* Edit Button (Pencil) next to Camera AI Settings & Config button - ONLY shown when MAXIMIZED */}
          {isMaximized && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsZoneEditing((prev) => !prev);
              }}
              className={`p-1.5 rounded-md backdrop-blur-md transition-all cursor-pointer shadow-md flex items-center justify-center border ${isZoneEditing
                ? 'bg-amber-500/30 text-amber-300 border-amber-400 ring-2 ring-amber-400/30'
                : 'bg-black/70 hover:bg-black/90 text-blue-400 hover:text-blue-300 border-blue-500/40 hover:border-blue-400'
                }`}
              title={isZoneEditing ? "Close Box Editing" : "Draw / Drag No Parking Zone Box"}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Right Maximize / Minimize Button */}
      <div className="absolute bottom-3 right-3 z-20 pointer-events-auto">
        <button
          onClick={() => setIsMaximized(!isMaximized)}
          className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded transition-colors cursor-pointer backdrop-blur-sm border border-white/10"
          title={isMaximized ? "Minimize" : "Maximize"}
        >
          {isMaximized ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      <CameraSettingsDrawer
        visible={isSettingsDrawerOpen}
        onHide={() => setIsSettingsDrawerOpen(false)}
        camera={selectedCamera || (cameras.length > 0 ? cameras[0] : null)}
      />
    </div>
  );

  // Derived stats from Python REST API response
  const totalViolations = streamStatus?.violations_count ?? streamStatus?.total_violations ?? violations.length;

  const rightPanelComponent = (
    <div className="flex flex-col gap-2 h-full">
      {/* Latest Violator Card */}
      <div
        className="border-2 rounded-xl p-0 shadow-2xl relative overflow-hidden flex flex-col flex-1"
        style={{
          backgroundColor: isDark ? "#110000" : "#fff5f5",
          borderColor: isDark ? "#4a0000" : "#fecaca"
        }}
      >
        <div className="p-3 bg-red-500 text-white flex justify-between items-center">
          <h3 className="text-xs font-medium uppercase flex items-center gap-2">
            <Ban size={14} /> Active Enforcement
          </h3>
          <span className="text-[10px] font-medium px-2 py-0.5 bg-black/20 rounded animate-pulse uppercase">Recent Violations</span>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
          {violations.slice(0, 5).map((v, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-red-500/5 transition-colors"
              style={{ borderColor: isDark ? "#4a0000" : "#fecaca" }}
            >
              <div className="w-20 h-14 bg-black/40 rounded flex-shrink-0 overflow-hidden relative border border-red-500/20">
                {getViolationImageSrc(v) ? (
                  <img src={getViolationImageSrc(v)} alt="Violator" className="w-full h-full object-cover" />
                ) : (
                  <CameraIcon className="w-5 h-5 mx-auto mt-4 opacity-50" />
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="font-bold text-lg text-red-500 leading-tight mb-1">{v.plate || "WAITING..."}</p>
                <div className="flex justify-between items-center text-[10px] font-medium">
                  <span className="flex items-center gap-1 opacity-80" style={{ color: textSecondary }}>
                    <Clock size={10} /> {v.time ? v.time : "—"}
                  </span>
                  <span className="flex items-center gap-1 opacity-80" style={{ color: textSecondary }}>
                    <MapPin size={10} /> {resolveLocation(v)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {violations.length === 0 && (
            <div className="p-8 text-center opacity-50 m-auto">
              <CameraIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-[11px] font-medium uppercase">No Violations Yet</p>
            </div>
          )}
        </div>
      </div>


    </div>
  );

  const filteredViolations = violations.filter(v => {
    const matchesSearch = !searchQuery ||
      String(v.plate || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(v.vehicle_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(v.location || '').toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    const itemDate = toLocalDateStr(v.detected_at || v.time);
    if (fromDate && itemDate && itemDate < fromDate) matchesDate = false;
    if (toDate && itemDate && itemDate > toDate) matchesDate = false;

    const matchesStatus = !statusFilter || v.status === statusFilter;
    const matchesLocation = !locationFilter || resolveLocation(v).toLowerCase() === locationFilter.toLowerCase();

    return matchesSearch && matchesDate && matchesStatus && matchesLocation;
  }).map((v, index) => ({
    ...v,
    srNo: index + 1,
    ...resolveCameraDetails(v, cameraFilter?.availableOptions?.cameras, selectedCamera)
  }));

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const tableColumns = [
    { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
    { header: "LICENSE PLATE", accessor: "plate", render: (row) => <span className="font-mono font-bold text-xs text-white tracking-wider">{row.plate}</span> },
    { header: "STATIONARY TIME", accessor: "stationary", render: (row) => row.stationary ? `${row.stationary}s` : 'N/A' },
    { header: "ZONE", accessor: "zone", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.zone || 'Unknown'}</span> },
    { header: "LOCATION", accessor: "location", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.location || 'Unknown'}</span> },
    { header: "CAMERA", accessor: "camera", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.camera || 'Unknown'}</span> },
    {
      header: "DATE", accessor: "date", render: (row) => {
        const dVal = row.detected_at || row.time;
        if (!dVal) return "—";
        const d = new Date(dVal);
        return isNaN(d.getTime()) ? "—" : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    },
    {
      header: "TIME", accessor: "time", render: (row) => {
        const dVal = row.detected_at || row.time;
        if (!dVal) return getPastTime(0);
        const d = new Date(dVal);
        return isNaN(d.getTime()) ? getPastTime(0) : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    },
    {
      header: "SNAPSHOT", accessor: "image", render: (row) => {
        const imgSrc = getViolationImageSrc(row);
        return (
          <div className="w-12 h-8 rounded border overflow-hidden bg-black/20 flex items-center justify-center">
            {imgSrc ? (
              <img src={imgSrc} alt="Violation" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[8px] text-gray-500">N/A</span>
            )}
          </div>
        );
      }
    },
    {
      header: "ACTION", accessor: "action", render: (row) => (
        <button
          onClick={() => handleViewDetails(row)}
          className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors cursor-pointer"
          title="View Details"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  const bottomMetricsComponent = (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
      <BottomStatCard
        icon={<CarFront size={20} className="text-[#3b82f6]" />}
        title="VEHICLES DETECTED"
        value={streamStatus?.total_vehicles_seen ?? 0}
        subtitle="TOTAL"
      />
      <BottomStatCard
        icon={<Ban size={20} className="text-red-500" />}
        title="NO PARKING VIOLATIONS"
        value={totalViolations}
        subtitle="TOTAL"
      />
      <BottomStatCard
        icon={<MapPin size={20} className="text-yellow-500" />}
        title="LOCATION"
        textValue={selectedCamera?.location || streamStatus?.camera_location || 'Main Gate Entry'}
      />
      <BottomStatCard
        icon={<Clock size={20} className="text-green-500" />}
        title="DETECTION TIME"
        textValue={<>{formattedTime}<br /><span className="text-[10px]">{formattedDate}</span></>}
      />
      <BottomStatCard
        icon={<CameraIcon size={20} className="text-purple-500" />}
        title="ACTIVE VEHICLES"
        value={streamStatus?.active_vehicles ?? 0}
        subtitle="IN ZONE"
      />
    </div>
  );

  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  const camerasList = cameraFilter.availableOptions.cameras;

  const paginatedCameras = useMemo(() => {
    if (itemsPerPage === null || itemsPerPage === Infinity) return camerasList;
    const start = (currentPage - 1) * itemsPerPage;
    return camerasList.slice(start, start + itemsPerPage);
  }, [camerasList, currentPage, itemsPerPage]);

  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  const handleAcknowledgeViolation = async (id) => {
    if (!id) return;
    setAcknowledgedIds(prev => new Set([...prev, id]));
    try {
      await fetch(`${API_BASE_URL}/api/no-parking/violations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACKNOWLEDGED" }),
      });
    } catch (err) {
      console.error("Error acknowledging violation on backend:", err);
    }
  };

  const getUnacknowledgedForCam = (cam) => {
    if (!cam) return [];
    return violations.filter(v => {
      const vId = v.id || v.violation_id;
      if (acknowledgedIds.has(vId) || v.status === 'RESOLVED' || v.status === 'ACKNOWLEDGED') return false;

      const camIdStr = String(cam.id || cam.value || cam.camera_id || '');
      const camUrl = cam.url || cam.rtsp_url || '';

      const matchId = v.camera_id && String(v.camera_id) === camIdStr;
      const matchCode = (v.camera || v.stream_id) && (
        String(v.camera) === String(cam.value) ||
        String(v.camera) === String(cam.label) ||
        String(v.stream_id) === String(cam.value) ||
        String(v.stream_id) === String(cam.camera_code)
      );
      const matchUrl = v.rtsp_url && camUrl && v.rtsp_url === camUrl;
      const matchLocation = v.location && cam.location && (v.location === cam.location || v.location === cam.label);

      return Boolean(matchId || matchCode || matchUrl || matchLocation);
    });
  };

  const cameraGridComponent = (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl border w-full"
      style={{ backgroundColor: themeUtils.getBgColor("card"), borderColor: themeUtils.getBorderColor() }}
    >
      <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-3" style={{ borderColor: themeUtils.getBorderColor() }}>
        <div className="flex items-center gap-2">
          <CameraIcon size={18} className="text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: themeUtils.getTextColor(true) }}>
            No Parking Live Feeds ({camerasList.length} Cameras)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <RecordsPerPage
            value={itemsPerPage}
            onChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
            options={[4, 8, 12, 16]}
            label="Cameras per page"
          />
        </div>
      </div>

      {camerasList.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[220px] gap-2 opacity-60">
          <CameraIcon size={36} />
          <p className="text-xs font-medium" style={{ color: themeUtils.getTextColor(false) }}>
            No cameras mapped for No Parking Detection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginatedCameras.map((cam) => (
            <div key={cam.id || cam.value} className="h-48 sm:h-56 md:h-60 lg:h-64 xl:h-72 2xl:h-80 rounded-lg overflow-hidden border" style={{ borderColor: themeUtils.getBorderColor() }}>
              <LiveCameraCard
                camera={cam}
                showDetectionDot={true}
                unacknowledgedItems={getUnacknowledgedForCam(cam)}
                onAcknowledgeItem={handleAcknowledgeViolation}
                enableNoParkingZone={true}
              />
            </div>
          ))}
        </div>
      )}

      {camerasList.length > itemsPerPage && (
        <div className="pt-2">
          <Pagination
            currentPage={currentPage}
            totalItems={camerasList.length}
            itemsPerPage={itemsPerPage === null || itemsPerPage === Infinity ? camerasList.length || 1 : itemsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}
    </div>
  );

  return (
    <ModuleLayout
      title="AI No Parking Zone Monitoring System"
      subtitle="Real-time no parking zone tracking and violation alerts"
      hideLiveSystem={true}
      hideCameraInHeader={false}
      videoComponent={cameraGridComponent}
      bottomTableComponent={
        <>
          <PaginatedTable
            title="RECENT NO PARKING VIOLATIONS"
            columns={tableColumns}
            data={filteredViolations}
            itemsPerPage={10}
            headerContent={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-52">
                  <SearchBar
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search plate, ID..."
                  />
                </div>
                {/* <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2 py-1 h-8 text-xs border rounded outline-none focus:border-blue-500 cursor-pointer"
                  style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('input'), color: themeUtils.getTextColor(true) }}
                >
                  <option value="">All Statuses</option>
                  <option value="UNRESOLVED">Unresolved</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="PENDING">Pending</option>
                </select> */}
                <DateRangePicker
                  fromDate={fromDate}
                  toDate={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                />
              </div>
            }
          />
          <RightSideDialog
            visible={isModalOpen}
            onHide={() => setIsModalOpen(false)}
            header="Violation Details"
          >
            {selectedRecord && (
              <div className="flex flex-col gap-6 pt-4 pb-12">
                <div className="w-full h-64 rounded-xl border overflow-hidden bg-black/10 flex items-center justify-center">
                  {getViolationImageSrc(selectedRecord) ? (
                    <img src={getViolationImageSrc(selectedRecord)} alt="Violation" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-500">No Image Available</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">

                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>License Plate</p>
                    <p className="font-semibold text-lg text-blue-500">{selectedRecord.plate}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Zone</p>
                    <p className="font-semibold text-sm">{selectedRecord.zone || 'Unknown'}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Location</p>
                    <p className="font-semibold text-sm">{selectedRecord.location || 'Unknown'}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Camera</p>
                    <p className="font-semibold text-sm">{selectedRecord.camera || 'Unknown'}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Detection Date</p>
                    <p className="font-semibold text-sm">
                      {(() => {
                        const dVal = selectedRecord.detected_at || selectedRecord.time;
                        if (!dVal) return "—";
                        const d = new Date(dVal);
                        if (isNaN(d.getTime())) return "—";
                        return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
                      })()}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Detection Time</p>
                    <p className="font-semibold text-sm">
                      {(() => {
                        const dVal = selectedRecord.detected_at || selectedRecord.time;
                        if (!dVal) return getPastTime(0);
                        const d = new Date(dVal);
                        if (isNaN(d.getTime())) return getPastTime(0);
                        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                      })()}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Stationary Time</p>
                    <p className="font-semibold text-sm">{selectedRecord.stationary ? `${selectedRecord.stationary}s` : 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </RightSideDialog>
        </>
      }
      cameraFilter={cameraFilter}
      extraFilterData={filteredViolations}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshKey(prev => prev + 1);
              toast?.info?.("Refreshed", "No parking detection data updated");
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => {
              import('../../utils/exportUtils').then(({ exportToCSV }) => {
                exportToCSV(filteredViolations, 'no_parking_violations_export');
              });
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg text-xs font-bold transition-all border border-green-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            Export
          </button>
        </div>
      }
    />
  );
}

