import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Video,
  Ban,
  CarFront,
  FileText,
  BarChart3,
  Bell,
  Settings,
  AlertTriangle,
  MapPin,
  Clock,
  Camera as CameraIcon,
  Car,
  Maximize,
  Minimize
} from 'lucide-react';
import { useTheme } from '../../ui/Settings/themeUtils.jsx';
import { useToast } from '../../ui/common/CostumeTost.jsx';
import { WS_BACKEND_URL, REST_BACKEND_URL, RTSP_CAMERA_URL } from '../../../config.js';

// --- Custom Hook for Stream Connection ---
export const useNoParkingStream = (rtspUrl, onNewViolation) => {
  const [isConnected, setIsConnected] = useState(false);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState(null);
  const wsRef = useRef(null);
  const lastViolationIdRef = useRef(null);
  
  // Keep the latest callback without triggering effect re-runs
  const onNewViolationRef = useRef(onNewViolation);
  onNewViolationRef.current = onNewViolation;

  useEffect(() => {
    if (!rtspUrl || !WS_BACKEND_URL) return;

    let isMounted = true;
    const wsUrl = `${WS_BACKEND_URL}/ws?rtsp_url=${encodeURIComponent(rtspUrl)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (!isMounted) {
        ws.close();
        return;
      }
      console.log('Connected to stream');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      if (!isMounted) return;
      try {
        const data = JSON.parse(event.data);
        if (data.frame) {
          setFrame(`data:image/jpeg;base64,${data.frame}`);
        }
        if (data.status) {
          setStatus(data.status);
        }
        
        // Handle new violation with image payload
        const violation = data.latest_violation || (data.status && data.status.latest_violation);
        if (violation) {
          if (lastViolationIdRef.current !== violation.vehicle_id) {
            lastViolationIdRef.current = violation.vehicle_id;
            if (onNewViolationRef.current) {
              onNewViolationRef.current(violation);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      if (!isMounted) return;
      console.log('Disconnected from stream');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      if (!isMounted) return;
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      isMounted = false;
      if (wsRef.current) {
        if (wsRef.current.readyState === 1) { // OPEN
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [rtspUrl]);

  return { isConnected, frame, status };
};

// --- Main Dashboard Component ---
export default function NoParkingMonitoringSystem() {
  const { theme, themeUtils } = useTheme();
  const isDark = theme.mode === "Dark";

  const [currentTime, setCurrentTime] = useState(new Date());

  // API Data State
  const [violations, setViolations] = useState([]);
  const toast = useToast();

  const handleNewViolation = React.useCallback((violation) => {
    toast.error(
      "NO PARKING VIOLATION",
      `Vehicle ${violation.plate} (ID: #${violation.vehicle_id}) parked in No Parking Zone`
    );
    // Add new violation to the top of the list so its image can be displayed instantly
    setViolations(prev => [violation, ...prev].slice(0, 50));
  }, [toast]);

  // Use the custom hook for the stream
  const { isConnected: streamConnected, frame: streamFrame, status: streamStatus } = useNoParkingStream(RTSP_CAMERA_URL, handleNewViolation);

  const [isMaximized, setIsMaximized] = useState(false);

  // Real-time Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch REST API initial data & polling
  useEffect(() => {
    fetchViolations();
    // Refresh violations every 5 seconds
    const interval = setInterval(fetchViolations, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchViolations = async () => {
    if (!REST_BACKEND_URL) return;
    try {
      const response = await fetch(`${REST_BACKEND_URL}/violations`);
      const data = await response.json();
      setViolations(data.violations || []);
    } catch (error) {
      console.error('Error fetching violations:', error);
    }
  };

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

  const outerBg = isDark ? "#06101e" : "#f3f4f6";
  const headerBg = isDark ? "#081324" : "#ffffff";
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const videoBg = isDark ? "#1c2430" : "#e5e7eb";
  const videoBorder = isDark ? "border-gray-800" : "border-gray-300";
  const simulatedVideoBg = isDark ? "#2b3340" : "#d1d5db";
  const cardBg = isDark ? "#0f1724" : "#ffffff";
  const cardBorder = isDark ? "border-[#1e2a40]" : "border-gray-200";

  return (
    <div
      className="flex h-[calc(100vh-90px)] font-sans overflow-hidden rounded-xl border transition-all duration-300"
      style={{
        backgroundColor: outerBg,
        borderColor: borderColor,
        color: textPrimary
      }}
    >
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div
          className="flex items-center justify-between p-2 border-b transition-all duration-300"
          style={{
            backgroundColor: headerBg,
            borderColor: borderColor
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-red-500 bg-[#1c1822] p-2 rounded-full border border-red-900/50">
              <Ban size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide" style={{ color: textPrimary }}>
                AI NO PARKING ZONE <br />
                <span className="text-[#3b82f6]">MONITORING SYSTEM</span>
              </h1>
              <p className="text-xs mt-1" style={{ color: textSecondary }}>Identify. Detect. Alert. Enforce.</p>
            </div>
          </div>

          <div className="flex-1 max-w-lg mx-6">
            {/* The static NO PARKING VIOLATION DETECTED alert was removed per user request. 
                Violations are now shown via toast notifications from the WebSocket. */}
          </div>

          <div className="text-right flex items-center gap-4 text-xs font-mono">
            <div className="flex flex-col gap-1 items-end" style={{ color: textSecondary }}>
              <div className="flex gap-4 w-40 justify-between">
                <span>DATE</span><span>:</span><span style={{ color: textPrimary }}>{formattedDate}</span>
              </div>
              <div className="flex gap-4 w-40 justify-between">
                <span>TIME</span><span>:</span><span style={{ color: textPrimary }}>{formattedTime}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden">
          {/* Left Column (Video feed & Bottom Stats) */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Video Feed Area */}
            <div
              className={
                isMaximized
                  ? "fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                  : `relative flex-1 rounded-lg border overflow-hidden flex flex-col min-h-0 ${videoBorder}`
              }
              style={{ backgroundColor: isMaximized ? undefined : videoBg }}
            >
              {/* Live WebSocket RTSP Stream / Fallback Image */}
              {streamConnected && streamFrame ? (
                <img
                  src={streamFrame}
                  alt="Live Camera Feed"
                  className={isMaximized ? "max-w-full max-h-full object-contain rounded-lg shadow-2xl" : "w-full h-full object-cover z-0"}
                />
              ) : (
                /* Simulated Video Background */
                <div
                  className={`absolute inset-0 flex items-center justify-center opacity-40 transition-colors ${isMaximized ? "bg-black" : ""}`}
                  style={{ backgroundColor: isMaximized ? undefined : simulatedVideoBg }}
                >
                  <span className={isDark ? "text-gray-500" : "text-gray-600"}>
                    {!streamConnected ? "Connecting to Python Backend..." : "Waiting for Video Feed..."}
                  </span>
                </div>
              )}

              {/* Overlay Data */}
              <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-3 z-10">
                <div className="bg-black/60 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-2">
                  CAMERA 07 - CITY MAIN ROAD
                </div>
                <div className="flex gap-2">
                  <div className="bg-black/60 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${!streamConnected ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
                    {!streamConnected ? 'CONNECTING...' : 'LIVE'}
                  </div>
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="bg-black/60 hover:bg-black/80 text-white p-1 rounded transition-colors cursor-pointer"
                    title={isMaximized ? "Minimize" : "Maximize"}
                  >
                    {isMaximized ? <Minimize size={16} /> : <Maximize size={16} />}
                  </button>
                </div>
              </div>

              {/* No Parking Sign - Always shown */}
              <div className="absolute top-12 right-12 flex flex-col items-center bg-gray-200 p-1 rounded-sm shadow-lg border border-gray-400 z-10">
                <div className="w-12 h-12 rounded-full border-4 border-red-600 flex items-center justify-center relative bg-white">
                  <span className="text-red-600 font-bold text-xl absolute">P</span>
                  <div className="w-full h-1 bg-red-600 rotate-45 absolute"></div>
                </div>
                <span className="text-black text-[8px] font-bold mt-1 text-center">NO<br />PARKING</span>
              </div>

              {/* Show mock bounding boxes ONLY if WebSocket is offline to simulate the UI */}
              {(!streamConnected || !streamFrame) && (
                <>
                  <div className="absolute top-1/3 left-1/4 transform -translate-x-1/2 -translate-y-1/2 border-2 border-red-500 w-32 h-24 z-10">
                    <div className="absolute -top-8 left-0 bg-red-500/90 text-white text-[9px] font-bold px-2 py-1 whitespace-nowrap text-center">
                      NO PARKING<br />KA 05 EF 9012
                    </div>
                  </div>

                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-2 border-red-500 w-40 h-32 z-10">
                    <div className="absolute -top-8 left-0 bg-red-500/90 text-white text-[9px] font-bold px-2 py-1 whitespace-nowrap text-center">
                      NO PARKING<br />KA 03 CD 5678
                    </div>
                  </div>

                  <div className="absolute bottom-1/4 right-1/4 transform -translate-x-1/2 -translate-y-1/2 border-2 border-red-500 w-64 h-40 z-10">
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white text-[10px] font-bold px-3 py-1 whitespace-nowrap text-center">
                      NO PARKING<br />KA 01 AB 1234
                    </div>
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 border border-gray-400 shadow-sm">
                      KA 01 AB 1234
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Stats Row */}
            <div className="grid grid-cols-5 gap-3 h-24">
              <BottomStatCard
                icon={<CarFront size={20} className="text-[#3b82f6]" />}
                title="VEHICLES DETECTED"
                value={streamStatus?.total_vehicles_seen ?? "128"}
                subtitle="TOTAL"
              />
              <BottomStatCard
                icon={<Ban size={20} className="text-red-500" />}
                title="NO PARKING VIOLATIONS"
                value={streamStatus?.violations_count ?? (streamStatus?.total_violations ?? "23")}
                subtitle="TOTAL"
              />
              <BottomStatCard
                icon={<MapPin size={20} className="text-yellow-500" />}
                title="LOCATION"
                textValue="Main Road, Near City Center"
              />
              <BottomStatCard
                icon={<Clock size={20} className="text-green-500" />}
                title="DETECTION TIME"
                textValue={<>{getPastTime(0)}<br /><span className="text-[10px]">{formattedDate}</span></>}
              />
              <BottomStatCard
                icon={<CameraIcon size={20} className="text-purple-500" />}
                title="ACTIVE VEHICLES"
                value={streamStatus?.active_vehicles ?? "2"}
                subtitle="IN ZONE"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="w-[380px] flex flex-col gap-4 overflow-hidden">
            {/* Violation Summary */}
            <div
              className={`border rounded-lg p-4 shadow-lg transition-all duration-300 ${cardBorder}`}
              style={{ backgroundColor: cardBg }}
            >
              <h3 className="text-[11px] text-[#3b82f6] font-bold mb-4 uppercase tracking-wider">VIOLATION SUMMARY</h3>

              <div
                className="flex justify-between items-end border-b pb-4 mb-4"
                style={{ borderColor: borderColor }}
              >
                <div className="text-center">
                  <p className="text-[9px] font-semibold mb-1" style={{ color: textSecondary }}>TOTAL VIOLATIONS</p>
                  <p className="text-3xl text-red-500 font-bold leading-none">{streamStatus?.violations_count ?? (streamStatus?.total_violations ?? "23")}</p>
                  <p className="text-[10px] text-red-500/80 mt-1">SESSION</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-semibold mb-1" style={{ color: textSecondary }}>LATEST PLATE</p>
                  <p className="text-xl text-yellow-500 font-bold leading-none mt-2">{streamStatus?.latest_violation?.plate || "—"}</p>
                </div>
              </div>

              <div className="flex justify-between items-center px-4">
                <div className="text-center">
                  <p className="text-[9px] font-semibold mb-1" style={{ color: textSecondary }}>PENDING</p>
                  <p className="text-xl text-yellow-500 font-bold">08</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-semibold mb-1" style={{ color: textSecondary }}>RESOLVED</p>
                  <p className="text-xl text-green-500 font-bold">15</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-semibold mb-1" style={{ color: textSecondary }}>REJECTED</p>
                  <p className="text-xl text-red-500 font-bold">00</p>
                </div>
              </div>
            </div>

            {/* Recent Violations List */}
            <div
              className={`border rounded-lg p-4 flex-1 flex flex-col overflow-hidden shadow-lg transition-all duration-300 ${cardBorder}`}
              style={{ backgroundColor: cardBg }}
            >
              <h3 className="text-[11px] text-[#3b82f6] font-bold mb-3 uppercase tracking-wider">RECENT NO PARKING VIOLATIONS</h3>
              <div className="flex-1 overflow-y-auto pr-1 space-y-3">

                {violations.length > 0 ? (
                  violations.slice(0, 10).map((v, index) => (
                    <ViolationItem
                      key={index}
                      plate={v.plate}
                      time={v.time ? v.time.split(" ")[1] : getPastTime(0)}
                      status="UNRESOLVED"
                      isLive={index === 0 && streamStatus?.latest_violation?.plate === v.plate}
                      confidence={v.ocr_confidence}
                      stationary={v.stationary}
                      vehicleId={v.vehicle_id}
                      imageBase64={v.violation_image_base64}
                    />
                  ))
                ) : (
                  <>
                    <ViolationItem plate="KA 01 AB 1234" time={getPastTime(2)} status="UNRESOLVED" />
                    <ViolationItem plate="KA 03 CD 5678" time={getPastTime(6)} status="UNRESOLVED" />
                    <ViolationItem plate="KA 05 EF 9012" time={getPastTime(8)} status="UNRESOLVED" />
                    <ViolationItem plate="KA 02 GH 3456" time={getPastTime(11)} status="UNRESOLVED" />
                    <ViolationItem plate="KA 04 IJ 7890" time={getPastTime(15)} status="UNRESOLVED" />
                  </>
                )}

              </div>
              <button
                className="w-full mt-4 bg-transparent border hover:bg-gray-100/10 text-[#3b82f6] text-xs font-bold py-2.5 rounded transition-all uppercase tracking-wide cursor-pointer"
                style={{ borderColor: borderColor }}
              >
                VIEW ALL VIOLATIONS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BottomStatCard({ icon, title, value, subtitle, textValue }) {
  const { theme, themeUtils } = useTheme();
  const isDark = theme.mode === "Dark";
  const cardBg = isDark ? "#0f1724" : "#ffffff";
  const cardBorder = isDark ? "border-[#1e2a40]" : "border-gray-200";
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);

  return (
    <div
      className={`border rounded-lg p-3 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-md transition-all duration-300 ${cardBorder}`}
      style={{ backgroundColor: cardBg }}
    >
      <div className="mb-2">
        {icon}
      </div>
      <p className="text-[9px] font-bold mb-1 tracking-wider uppercase" style={{ color: textSecondary }}>{title}</p>

      {value !== undefined && (
        <div className="flex flex-col items-center mt-auto">
          <p className="text-2xl font-bold leading-none" style={{ color: textPrimary }}>{value}</p>
          {subtitle && <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: textSecondary }}>{subtitle}</p>}
        </div>
      )}

      {textValue !== undefined && (
        <p className="text-xs font-medium mt-auto leading-tight px-1" style={{ color: textPrimary }}>
          {textValue}
        </p>
      )}
    </div>
  );
}

function ViolationItem({ plate, time, status, isLive, confidence, stationary, vehicleId, imageBase64 }) {
  const { theme, themeUtils } = useTheme();
  const isDark = theme.mode === "Dark";
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const thumbBg = isDark ? "#1c2430" : "#f3f4f6";

  return (
    <div
      className={`flex flex-row items-center justify-between p-2 rounded transition-colors group cursor-pointer ${isLive ? 'bg-red-500/10 border border-red-500/30' : ''}`}
      style={{
        backgroundColor: isLive ? (isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.05)") : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!isLive) e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!isLive) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <div className="flex items-center gap-3">
        <Car className="text-red-500" size={20} />
        <div>
          <p className="text-sm font-bold flex items-center gap-2" style={{ color: textPrimary }}>
            {plate}
            {isLive && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded animate-pulse">NEW</span>}
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: textSecondary }}>
            {vehicleId ? `Vehicle #${vehicleId} | ` : ''}
            {stationary ? `Stopped: ${stationary}s` : 'Main Road, Near City Center'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        <div>
          <p className="text-xs" style={{ color: textSecondary }}>{time}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${status === 'UNRESOLVED' ? 'text-red-500' : 'text-green-500'}`}>
            {confidence ? `CONF: ${confidence}` : status}
          </p>
        </div>
        <div
          className="w-16 h-10 rounded border overflow-hidden flex items-center justify-center transition-colors"
          style={{ backgroundColor: thumbBg, borderColor: borderColor }}
        >
          {imageBase64 ? (
            <img src={`data:image/jpeg;base64,${imageBase64}`} alt="Violation" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[8px] text-gray-500">THUMB</span>
          )}
        </div>
      </div>
    </div>
  );
}
