import React, { useState, useEffect, useRef } from "react";
import { Camera, WifiOff, Loader, Maximize, Minimize, Settings, AlertTriangle, Pencil, ChevronUp, ChevronDown } from "lucide-react";
import { useTheme } from "../../ui/Settings/themeUtils";
import { useToast } from "../../ui/common/CustomToast";
import CameraSettingsDrawer from "../../ui/common/CameraSettingsDrawer";
import NoParkingZoneDrawer from "../NoParkingDetection/NoParkingZoneDrawer";
import { API_BASE_URL, API_CONFIG } from "../../../config.js";

export default function LiveCameraCard({
  camera,
  onDetection,
  showLocation = true,
  selectedCategoryId,
  unacknowledgedItems = [],
  onAcknowledgeItem,
  showDetectionDot = false,
  onUpdate,
  enableNoParkingZone = false,
  enableLineAdjust = false,
}) {
  const { themeUtils } = useTheme();
  const toast = useToast();
  const [status, setStatus] = useState("connecting"); // connecting | buffering | live | offline | disabled
  const [frame, setFrame] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isZoneEditing, setIsZoneEditing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const wsRef = useRef(null);
  const streamIdRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const frameTimeoutRef = useRef(null); // timer to detect WS-connected-but-no-frames

  const isNoParkingModule = enableNoParkingZone || (typeof window !== "undefined" && window.location.pathname.includes("no-parking"));
  const isTrafficBehaviorModule = enableLineAdjust || (typeof window !== "undefined" && window.location.pathname.includes("traffic-behavior"));

  const camKey = camera?.id || camera?.value || "default";
  const [gateY, setGateY] = useState(() => {
    try {
      const saved = localStorage.getItem(`in_out_gate_y_${camKey}`);
      if (saved !== null && !isNaN(parseFloat(saved))) {
        return parseFloat(saved);
      }
    } catch (_) { }
    return API_CONFIG?.DEFAULT_GATE_Y ?? 0.4;
  });

  // Debounced gateY for WS connection URL, to avoid reconnecting on rapid clicks
  const [debouncedGateY, setDebouncedGateY] = useState(gateY);
  const debounceTimerRef = useRef(null);

  // Send exact backend actions: { "action": "gate_up" } or { "action": "gate_down" }
  const sendGateAction = (action) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 70) return; // Throttle to ~14 clicks/sec
    lastClickTimeRef.current = now;

    const isUp = action === "gate_up";
    const newY = Math.max(0.05, Math.min(0.95, Number((gateY + (isUp ? 0.02 : -0.02)).toFixed(3))));
    setGateY(newY);

    try {
      localStorage.setItem(`in_out_gate_y_${camKey}`, String(newY));
    } catch (_) { }

    // 1. WebSocket Control Message (Immediate live line shift on next frame)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ action, step: 0.02 }));
      } catch (err) {
        console.warn(`[LiveCameraCard] Error sending ${action}:`, err);
      }
    } else {
      // 2. REST Fallback: POST /vehicles/{stream_id}/gate?direction=up|down&step=0.02
      const sid = streamIdRef.current || camera?.value || camera?.id;
      const pythonHost = API_CONFIG?.BASE_URL || "http://110.227.253.23:5001";
      if (sid) {
        const direction = isUp ? "up" : "down";
        fetch(`${pythonHost}/vehicles/${encodeURIComponent(sid)}/gate?direction=${direction}&step=0.02`, { method: "POST" })
          .then((r) => r.json())
          .then((data) => {
            if (data?.gate_y !== undefined) setGateY(data.gate_y);
          })
          .catch((e) => console.warn("[LiveCameraCard] REST gate fallback error:", e));
      }
    }

    // 3. Keep URL query param synced if connection is recreated
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedGateY(newY);
    }, 600);
  };

  const handleGateUp = () => sendGateAction("gate_up");
  const handleGateDown = () => sendGateAction("gate_down");

  // Ensure zone editing mode only stays active while camera view is maximized
  useEffect(() => {
    if (!isMaximized) {
      setIsZoneEditing(false);
    }
  }, [isMaximized]);

  const hasUnacknowledged = unacknowledgedItems && unacknowledgedItems.length > 0;

  // Determine WS URL:
  const defaultWsBase = import.meta.env.VITE_DEFAULT_WS_URL || "ws://110.227.253.23:8081/live/ws";

  const buildWsUrl = (baseUrl, rtsp, lineY) => {
    const effectiveBase = baseUrl || (isTrafficBehaviorModule ? API_CONFIG.WS_URL : null);
    if (!effectiveBase) return null;
    const sep = effectiveBase.includes("?") ? "&" : "?";
    let url = `${effectiveBase}${sep}rtsp_url=${encodeURIComponent(rtsp || "")}`;
    if (isTrafficBehaviorModule) {
      const gY = lineY ?? 0.4;
      url += `&gate_y=${gY}&confidence=0.25`;
    }
    return url;
  };

  const primaryWsUrl = buildWsUrl(camera.ws_url, camera.url, debouncedGateY);
  const fallbackWsUrl = buildWsUrl(defaultWsBase, camera.url, debouncedGateY);

  const isDisabled = selectedCategoryId !== null && selectedCategoryId !== undefined
    ? camera.has_active_feature === false
    : false;

  useEffect(() => {
    if (!camera?.url) {
      setStatus("offline");
      return;
    }

    let isMounted = true;
    setStatus("connecting");
    setFrame(null);

    let activeWs = null;
    let primaryRetries = 0;
    const MAX_PRIMARY_RETRIES = 3;
    let fallbackActive = false;
    let backgroundCheckTimer = null;

    const clearFrameTimeout = () => {
      if (frameTimeoutRef.current) {
        clearTimeout(frameTimeoutRef.current);
        frameTimeoutRef.current = null;
      }
    };

    const cleanupWs = () => {
      if (activeWs) {
        activeWs.onopen = null;
        activeWs.onmessage = null;
        activeWs.onerror = null;
        activeWs.onclose = null;
        activeWs.close();
        activeWs = null;
      }
    };

    const startBackgroundCheck = () => {
      if (!primaryWsUrl || primaryWsUrl === fallbackWsUrl) return;
      if (backgroundCheckTimer) clearInterval(backgroundCheckTimer);

      backgroundCheckTimer = setInterval(() => {
        if (!isMounted) return;
        console.log(`[LiveCameraCard] Checking if primary WS is back for camera ${camera.id}...`);
        const testWs = new WebSocket(primaryWsUrl);
        testWs.onopen = () => {
          console.log(`[LiveCameraCard] Primary WS is back for camera ${camera.id}! Switching...`);
          testWs.close();
          clearInterval(backgroundCheckTimer);
          backgroundCheckTimer = null;
          fallbackActive = false;
          primaryRetries = 0;
          connect(primaryWsUrl);
        };
        testWs.onerror = () => {
          testWs.close();
        };
      }, 10000); // Check every 10 seconds
    };

    const handleConnectionFailure = (failedUrl) => {
      if (!isMounted) return;
      cleanupWs();
      clearFrameTimeout();

      if (failedUrl === primaryWsUrl && primaryWsUrl !== fallbackWsUrl) {
        if (primaryRetries < MAX_PRIMARY_RETRIES) {
          primaryRetries++;
          console.log(`[LiveCameraCard] Primary WS failed for camera ${camera.id}. Retrying (${primaryRetries}/${MAX_PRIMARY_RETRIES})...`);
          setTimeout(() => { if (isMounted) connect(primaryWsUrl); }, 2000);
        } else {
          console.log(`[LiveCameraCard] Primary WS failed after retries for camera ${camera.id}. Switching to fallback...`);
          fallbackActive = true;
          connect(fallbackWsUrl);
        }
      } else {
        // Fallback failed, or primary == fallback
        setStatus("offline");
        // Retry connecting to fallback/primary every 5 seconds so it eventually recovers
        setTimeout(() => { if (isMounted) connect(failedUrl); }, 5000);
      }
    };

    const connect = (url) => {
      if (!isMounted || !url) return;
      cleanupWs();

      const isFallbackConnection = url === fallbackWsUrl && primaryWsUrl !== fallbackWsUrl;
      if (!isFallbackConnection) {
        setStatus("connecting");
      }

      try {
        const ws = new WebSocket(url);
        activeWs = ws;
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setStatus("buffering");

          if (isTrafficBehaviorModule) {
            try {
              ws.send(JSON.stringify({ action: "get_gate" }));
            } catch (_) { }
          }

          if (isFallbackConnection) {
            startBackgroundCheck();
          }

          clearFrameTimeout();
          frameTimeoutRef.current = setTimeout(() => {
            if (!isMounted) return;
            handleConnectionFailure(url);
          }, 8000);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          let handled = false;

          // Try JSON parsing first
          if (typeof event.data === "string") {
            try {
              const data = JSON.parse(event.data);

              // Capture stream_id from connect / frame message
              if (data.stream_id) {
                streamIdRef.current = data.stream_id;
              }

              // Update gate position from backend (type: "frame", "gate_updated", "gate_state", or status: "connected")
              if (data.gate && data.gate.gate_y !== undefined) {
                setGateY(data.gate.gate_y);
              } else if (data.gate_y !== undefined) {
                setGateY(data.gate_y);
              }

              // Ignore heartbeat ping
              if (data.type === "ping") {
                return;
              }

              // Relay new crossing events to Node backend in-out events
              if (isTrafficBehaviorModule && data.new_events && data.new_events.length > 0) {
                fetch(`${API_BASE_URL}/api/in-out/events`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data.new_events),
                }).catch(() => { });
              }

              const frameB64 = data.frame || data.image || data.jpeg || data.data;
              if (frameB64) {
                const frameSrc = frameB64.startsWith("data:")
                  ? frameB64
                  : `data:image/jpeg;base64,${frameB64}`;
                clearFrameTimeout();
                setFrame(frameSrc);
                setStatus("live");
                handled = true;
                if ((data.detections || data.objects) && onDetection) {
                  onDetection(data.detections || data.objects, frameSrc, camera);
                }
              }
            } catch (_) { }
          }

          // Binary frame (raw JPEG bytes)
          if (!handled && event.data instanceof Blob) {
            clearFrameTimeout();
            const url = URL.createObjectURL(event.data);
            setFrame(url);
            setStatus("live");
          } else if (!handled && event.data instanceof ArrayBuffer) {
            const blob = new Blob([event.data], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);
            clearFrameTimeout();
            setFrame(url);
            setStatus("live");
          }
        };

        ws.onerror = () => {
          if (!isMounted) return;
          handleConnectionFailure(url);
        };

        ws.onclose = () => {
          if (!isMounted) return;
          clearFrameTimeout();
          handleConnectionFailure(url);
        };
      } catch (e) {
        handleConnectionFailure(url);
      }
    };

    connect(primaryWsUrl || fallbackWsUrl);

    return () => {
      isMounted = false;
      cleanupWs();
      clearFrameTimeout();
      if (backgroundCheckTimer) clearInterval(backgroundCheckTimer);
    };
  }, [camera?.url, primaryWsUrl, fallbackWsUrl]);

  const statusColor = {
    connecting: "bg-yellow-400 animate-pulse",
    buffering: "bg-yellow-500 animate-pulse",
    live: "bg-green-500 animate-pulse",
    offline: "bg-red-500",
    disabled: "bg-gray-500"
  };
  const statusLabel = {
    connecting: "CONNECTING",
    buffering: "BUFFERING",
    live: "LIVE",
    offline: "OFFLINE",
    disabled: "DISABLED"
  };

  // Category-specific features (for badge display)
  const categoryFeatures = selectedCategoryId && camera.features?.length > 0 ? camera.features : camera.features || [];

  return (
    <>
      <div
        className={
          isMaximized
            ? "fixed inset-0 z-[100] flex flex-col bg-black m-4 rounded-xl overflow-hidden shadow-2xl border-gray-800 border"
            : "flex flex-col rounded-xl overflow-hidden border shadow-sm relative group h-48 sm:h-56 md:h-60 lg:h-64 xl:h-72 2xl:h-80 transition-all"
        }
        style={!isMaximized ? { backgroundColor: themeUtils.getBgColor("card"), borderColor: themeUtils.getBorderColor() } : {}}
      >
        {/* Video Feed */}
        <div className={`flex-1 bg-black relative flex items-center justify-center overflow-hidden ${isDisabled ? "opacity-60" : ""}`}>

          {/* Disabled overlay */}
          {isDisabled && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/50">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 tracking-widest">FEATURE DISABLED</span>
              <span className="text-[9px] text-gray-400">Enable in Camera Settings</span>
            </div>
          )}

          {frame ? (
            <img src={frame} alt={camera.label} className="absolute inset-0 w-full h-full object-fill" />
          ) : status === "connecting" || status === "buffering" ? (
            <div className="flex flex-col items-center gap-3 text-blue-500">
              <Loader className="w-8 h-8 animate-spin" />
              <span className="text-xs font-bold tracking-wider animate-pulse">
                {status === "buffering" ? "WAITING FOR STREAM..." : "CONNECTING..."}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-red-500/70">
              <WifiOff className="w-8 h-8" />
              <span className="text-xs font-bold tracking-wider">OFFLINE</span>
              <span className="text-[10px] text-gray-500">Camera unavailable</span>
            </div>
          )}

          {/* Interactive No Parking Zone Drawer (ROI Box Marking & Overlay - Available even when stream is offline) */}
          {isNoParkingModule && (
            <NoParkingZoneDrawer
              selectedCamera={camera}
              sendMessage={(msg) => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  try {
                    wsRef.current.send(typeof msg === "string" ? msg : JSON.stringify(msg));
                  } catch (e) {
                    console.warn("[LiveCameraCard] Error sending WS message:", e);
                  }
                }
              }}
              toast={toast}
              isEditing={isZoneEditing}
              setIsEditing={setIsZoneEditing}
              isMaximized={isMaximized}
            />
          )}

          {/* Status + Settings overlay */}
          <div className="absolute top-2 right-2 flex items-center gap-2 z-20">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-white/10">
              <div className={`w-2 h-2 rounded-full ${statusColor[status]}`} />
              <span className="text-[9px] font-bold text-white tracking-wider">{statusLabel[status]}</span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setIsDrawerOpen(true); }}
              className="p-1.5 rounded bg-black/60 hover:bg-black/80 text-blue-400 border border-blue-500/30 backdrop-blur-sm transition-all cursor-pointer"
              title="Camera AI Settings"
            >
              <Settings size={14} className="hover:rotate-45 transition-transform" />
            </button>

            {/* Edit (Pencil) Button - ONLY shown when camera view is MAXIMIZED */}
            {isNoParkingModule && isMaximized && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoneEditing((prev) => !prev);
                }}
                className={`p-1.5 rounded backdrop-blur-sm transition-all cursor-pointer border ${isZoneEditing
                    ? "bg-amber-500/40 text-amber-300 border-amber-400 ring-2 ring-amber-400/40 shadow-lg"
                    : "bg-black/60 hover:bg-black/80 text-blue-400 border border-blue-500/30"
                  }`}
                title={isZoneEditing ? "Close No Parking Box Editing" : "Draw / Drag No Parking Zone Box"}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>

          {/* In/Out Horizontal Counting Line Adjustment Arrows */}
          {isTrafficBehaviorModule && (
            <div
              className={`absolute z-30 flex flex-col items-center select-none backdrop-blur-sm transition-all ${isMaximized
                  ? "left-3 top-1/2 -translate-y-1/2 p-1 gap-1 rounded-lg bg-black/70 border border-white/15 shadow-xl"
                  : "left-1.5 top-1/2 -translate-y-1/2 p-0.5 gap-0.5 rounded-md bg-black/60 hover:bg-black/85 border border-white/10 shadow-md"
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleGateUp}
                className={`flex items-center justify-center rounded text-white transition-all cursor-pointer ${isMaximized
                    ? "w-6 h-6 bg-white/10 hover:bg-blue-600 active:scale-90"
                    : "w-5 h-5 bg-white/10 hover:bg-blue-600 active:scale-90"
                  }`}
                title="Move Counting Line Up"
                aria-label="Move line up"
              >
                <ChevronUp className={isMaximized ? "w-3.5 h-3.5" : "w-3 h-3"} />
              </button>

              <span
                className="font-mono font-bold text-blue-300 leading-none select-none text-[8px] py-0.5"
                title={`Line at ${Math.round(gateY * 100)}%`}
              >
                {Math.round(gateY * 100)}%
              </span>

              <button
                type="button"
                onClick={handleGateDown}
                className={`flex items-center justify-center rounded text-white transition-all cursor-pointer ${isMaximized
                    ? "w-6 h-6 bg-white/10 hover:bg-blue-600 active:scale-90"
                    : "w-5 h-5 bg-white/10 hover:bg-blue-600 active:scale-90"
                  }`}
                title="Move Counting Line Down"
                aria-label="Move line down"
              >
                <ChevronDown className={isMaximized ? "w-3.5 h-3.5" : "w-3 h-3"} />
              </button>
            </div>
          )}

          {/* Maximize / Minimize */}
          <div className="absolute bottom-2 right-2 z-20">
            <button
              onClick={() => {
                if (isMaximized) {
                  setIsZoneEditing(false);
                }
                setIsMaximized(!isMaximized);
              }}
              className="p-1.5 rounded bg-black/60 backdrop-blur-sm border border-white/10 text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>

          {/* Feature badges (bottom-left) */}
          {categoryFeatures.length > 0 && (
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 z-20 max-w-[70%]">
              {categoryFeatures.slice(0, 3).map(f => (
                <span
                  key={f.feature_id || f.name}
                  className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded backdrop-blur-sm ${f.on_off_status
                    ? "bg-green-500/70 text-white"
                    : "bg-gray-600/70 text-gray-300"
                    }`}
                >
                  {f.name?.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Info Bar */}
        <div
          className={`p-3 border-t flex items-center justify-between gap-2 ${isMaximized ? "bg-black text-white border-gray-800" : ""}`}
          style={!isMaximized ? { borderColor: themeUtils.getBorderColor() } : {}}
        >
          <div className="flex flex-col min-w-0 flex-1">
            <h3
              className="text-sm font-bold truncate"
              style={!isMaximized ? { color: themeUtils.getTextColor(true) } : {}}
              title={camera.label}
            >
              {camera.label || camera.name}
            </h3>
            {showLocation && (
              <p
                className="text-xs truncate flex items-center gap-1.5"
                style={!isMaximized ? { color: themeUtils.getTextColor(false) } : { color: "#9ca3af" }}
              >
                <Camera size={10} />
                {camera.location || "Unknown Location"}
              </p>
            )}
          </div>

          {/* Bottom Right Indicator Dot (Green if clean/all OK, Red Blinking if car/incident detected) */}
          {showDetectionDot && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasUnacknowledged) {
                  setIsEvidenceModalOpen(true);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer shrink-0"
              style={{
                backgroundColor: hasUnacknowledged ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                borderColor: hasUnacknowledged ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)",
              }}
              title={hasUnacknowledged ? `${unacknowledgedItems.length} Evidence Detection(s) - Click to review` : "All clear - No active detections"}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${hasUnacknowledged
                  ? "bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]"
                  : "bg-green-500 shadow-[0_0_8px_#22c55e]"
                  }`}
              />
              {hasUnacknowledged && (
                <span className="text-[10px] font-bold text-red-400">{unacknowledgedItems.length}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* AI Features Settings Drawer */}
      <CameraSettingsDrawer
        visible={isDrawerOpen}
        onHide={() => setIsDrawerOpen(false)}
        camera={camera}
        onSave={onUpdate}
      />

      {/* Evidence Popup Modal */}
      {isEvidenceModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-lg rounded-xl border p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-hidden"
            style={{
              backgroundColor: themeUtils.getBgColor("card"),
              borderColor: themeUtils.getBorderColor(),
              color: themeUtils.getTextColor(true),
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: themeUtils.getBorderColor() }}>
              <h3 className="text-sm font-bold flex items-center gap-2 text-red-500">
                <AlertTriangle size={18} /> Evidence Records — {camera.label || camera.name}
              </h3>
              <button
                onClick={() => setIsEvidenceModalOpen(false)}
                className="text-xs font-bold px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:opacity-80"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3 pr-1">
              {unacknowledgedItems.map((item, idx) => (
                <div
                  key={`ev-${item.id || item.violation_id || item.incident_id || 'item'}-${idx}`}
                  className="p-3 rounded-lg border flex flex-col sm:flex-row gap-3 items-center justify-between"
                  style={{ backgroundColor: "rgba(239, 68, 68, 0.05)", borderColor: "rgba(239, 68, 68, 0.2)" }}
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {(item.image_path || item.violation_image_path || item.image_base64 || item.image) && (
                      <img
                        src={
                          item.image_path || item.violation_image_path
                            ? (item.image_path || item.violation_image_path).startsWith("http")
                              ? (item.image_path || item.violation_image_path)
                              : `${API_BASE_URL}/${(item.image_path || item.violation_image_path).replace(/\\/g, "/")}`
                            : item.image_base64 || item.image
                        }
                        alt="Evidence Snapshot"
                        className="w-20 h-16 object-cover rounded border border-red-500/30 shrink-0 bg-black"
                        onError={(e) => e.target.style.display = "none"}
                      />
                    )}
                    <div className="flex flex-col text-xs">
                      <span className="font-bold text-red-500 text-sm">
                        {item.plate || item.incident_type || item.type || "Violation Detected"}
                      </span>
                      <span className="opacity-80 mt-0.5" style={{ color: themeUtils.getTextColor(false) }}>
                        Date & Time: {item.detected_at || item.time || item.time_str || new Date().toLocaleString()}
                      </span>
                      {item.severity && (
                        <span className="text-[10px] font-bold text-amber-500 uppercase mt-0.5">
                          Severity: {item.severity}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (onAcknowledgeItem) {
                        onAcknowledgeItem(item.id || item.violation_id || item.incident_id);
                      }
                      if (unacknowledgedItems.length <= 1) {
                        setIsEvidenceModalOpen(false);
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer shrink-0"
                  >
                    ✓ OK
                  </button>
                </div>
              ))}

              {unacknowledgedItems.length === 0 && (
                <div className="py-8 text-center text-xs opacity-70">
                  ✓ All evidence items reviewed and acknowledged!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
