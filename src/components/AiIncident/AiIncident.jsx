import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Activity, Cpu, CheckCircle, TrendingUp, Clock, Eye, Settings, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { useTheme } from '../../ui/Settings/themeUtils';
import ModuleLayout from '../../ui/layout/ModuleLayout';
import BottomStatCard from '../../ui/common/BottomStatCard';
import InteractivePieChart from '../../ui/common/InteractivePieChart';
import PaginatedTable from '../../ui/common/PaginatedTable';
import RightSideDialog from '../../ui/common/RightSideDialog';
import CameraSettingsDrawer from '../../ui/common/CameraSettingsDrawer';
import SearchBar from '../../ui/common/SearchBar';

import { API_BASE_URL, API_CONFIG } from '../../../config.js';
import { useToast } from '../../ui/common/CustomToast';
import useCameraFilter from '../../hooks/useCameraFilter';
import LiveCameraCard from '../LiveMonitoring/LiveCameraCard';
import Pagination from '../../ui/common/Pagination';
import RecordsPerPage from '../../ui/common/RecordsPerPage';
import DateRangePicker from '../../ui/common/DateRangePicker';
import { resolveCameraDetails } from '../../utils/cameraUtils';
import { getTodayStr, toLocalDateStr } from '../../utils/dateUtils';

export default function AiIncident() {
  const { theme, themeUtils } = useTheme();

  const [refreshKey, setRefreshKey] = useState(0);
  const isDark = theme.mode === "Dark";

  const cameraFilter = useCameraFilter('ai_incident');
  const { selectedCamera: currentCamObj, allCameras: cameras } = cameraFilter;
  const selectedCamera = currentCamObj || (cameras.length > 0 ? cameras[0] : null) || { value: '', label: '', url: '' };

  // Dynamic State for WebSocket (Simulated Backend)
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamFrame, setStreamFrame] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState(null);
  const [backendStats, setBackendStats] = useState({
    total: 0, severityCounts: { SEVERE: 0, MODERATE: 0, MINOR: 0, CONTACT: 0 }
  });

  const toast = useToast();
  const seenIncidentIdRef = React.useRef(new Set(JSON.parse(sessionStorage.getItem('seenAiIncidents') || '[]')));
  const wsRef = React.useRef(null);

  const fetchIncidents = () => {
    let url = `${API_BASE_URL}/api/ai-incident/incidents?limit=50`;
    if (cameraFilter?.filters?.zone && cameraFilter.filters.zone !== 'all') url += `&zone_id=${cameraFilter.filters.zone}`;
    if (cameraFilter?.filters?.location && cameraFilter.filters.location !== 'all') url += `&location_id=${cameraFilter.filters.location}`;
    if (cameraFilter?.filters?.cameraId && cameraFilter.filters.cameraId !== 'all') url += `&camera_id=${cameraFilter.filters.cameraId}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.incidents) setIncidents(data.incidents);
      }).catch(err => console.error("Error fetching incidents:", err));
  };

  const fetchStats = () => {
    let url = `${API_BASE_URL}/api/ai-incident/stats?dummy=1`;
    if (cameraFilter?.filters?.zone && cameraFilter.filters.zone !== 'all') url += `&zone_id=${cameraFilter.filters.zone}`;
    if (cameraFilter?.filters?.location && cameraFilter.filters.location !== 'all') url += `&location_id=${cameraFilter.filters.location}`;
    if (cameraFilter?.filters?.cameraId && cameraFilter.filters.cameraId !== 'all') url += `&camera_id=${cameraFilter.filters.cameraId}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.stats) setBackendStats(data.stats);
      }).catch(err => console.error("Error fetching stats:", err));
  };

  const handleViewDetails = (record) => {
    setIsModalOpen(true);
    setSelectedRecord(null); // Clear previous state while loading

    fetch(`${API_BASE_URL}/api/ai-incident/incidents/${record.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.incident) {
          setSelectedRecord(data.incident);
        } else {
          setSelectedRecord(record); // Fallback to pre-fetched row
        }
      })
      .catch(err => {
        console.error("Error fetching incident details:", err);
        setSelectedRecord(record); // Fallback
      });
  };

  useEffect(() => {
    fetchIncidents();
    fetchStats();
    const interval = setInterval(() => {
      fetchIncidents();
      fetchStats();
    }, 3000);
    return () => clearInterval(interval);
  }, [refreshKey, cameraFilter?.filters?.zone, cameraFilter?.filters?.location, cameraFilter?.filters?.cameraId]);

  const handleNewIncident = React.useCallback((incident) => {
    if (API_BASE_URL) {
      fetch(`${API_BASE_URL}/api/ai-incident/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident),
      })
        .then(res => res.json())
        .then(saved => {
          if (saved.incident && saved.incident.severity) { // check if it's a full incident and not a blank duplicate
            toast.error(
              "AI INCIDENT DETECTED",
              `Severity: ${saved.incident.severity}`
            );

            setIncidents(prev => {
              if (prev.some(p => p.id === saved.incident.id || p.incident_id === saved.incident.incident_id)) return prev;
              return [saved.incident, ...prev].slice(0, 50);
            });
            fetchStats();
          }
        })
        .catch((err) => console.error('Failed to persist incident:', err));
    } else {
      // Fallback if no backend configured
      toast.error(
        "AI INCIDENT DETECTED",
        `Severity: ${incident.severity}`
      );
    }
  }, [toast]);

  useEffect(() => {
    if (!selectedCamera?.url) return;

    setStreamConnected(false);
    setStreamFrame(null);

    let isMounted = true;
    let ws = null;
    let primaryRetries = 0;
    const MAX_PRIMARY_RETRIES = 3;
    let fallbackActive = false;
    let backgroundCheckTimer = null;
    let frameTimeoutId = null;

    const defaultWs = API_CONFIG.DEFAULT_WS_URL || "ws://110.227.253.23:8081/live/ws";
    const isFeatureActive = selectedCamera?.features?.some(f => f.name === "AI Incident Detection" && f.on_off_status);
    const primaryWsUrlBase = isFeatureActive && API_CONFIG.INCIDENTS_WS_URL
      ? `${API_CONFIG.INCIDENTS_WS_URL}/accidents/ws`
      : (selectedCamera.ws_url || defaultWs);

    const buildUrl = (baseUrl) => {
      if (!baseUrl) return null;
      const sep = baseUrl.includes("?") ? "&" : "?";
      return baseUrl.includes("rtsp_url=") ? baseUrl : `${baseUrl}${sep}rtsp_url=${encodeURIComponent(selectedCamera.url)}`;
    };

    const primaryWsUrl = buildUrl(primaryWsUrlBase);
    const fallbackWsUrl = buildUrl(defaultWs);

    const clearFrameTimeout = () => {
      if (frameTimeoutId) { clearTimeout(frameTimeoutId); frameTimeoutId = null; }
    };

    const cleanupWs = () => {
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    };

    const startBackgroundCheck = () => {
      if (!primaryWsUrl || primaryWsUrl === fallbackWsUrl) return;
      if (backgroundCheckTimer) clearInterval(backgroundCheckTimer);

      backgroundCheckTimer = setInterval(() => {
        if (!isMounted) return;
        console.log(`[AiIncident] Checking if primary WS is back for camera ${selectedCamera.value}...`);
        const testWs = new WebSocket(primaryWsUrl);
        testWs.onopen = () => {
          console.log(`[AiIncident] Primary WS is back! Switching...`);
          testWs.close();
          clearInterval(backgroundCheckTimer);
          backgroundCheckTimer = null;
          fallbackActive = false;
          primaryRetries = 0;
          connectWS(primaryWsUrl);
        };
        testWs.onerror = () => {
          testWs.close();
        };
      }, 10000);
    };

    const handleConnectionFailure = (failedUrl) => {
      if (!isMounted) return;
      cleanupWs();
      clearFrameTimeout();

      if (failedUrl === primaryWsUrl && primaryWsUrl !== fallbackWsUrl) {
        if (primaryRetries < MAX_PRIMARY_RETRIES) {
          primaryRetries++;
          console.log(`[AiIncident] Primary WS failed. Retrying (${primaryRetries}/${MAX_PRIMARY_RETRIES})...`);
          setTimeout(() => { if (isMounted) connectWS(primaryWsUrl); }, 2000);
        } else {
          console.log(`[AiIncident] Primary WS failed after retries. Switching to fallback...`);
          fallbackActive = true;
          connectWS(fallbackWsUrl);
        }
      } else {
        setStreamConnected(false);
        setTimeout(() => { if (isMounted) connectWS(failedUrl); }, 5000);
      }
    };

    const connectWS = (targetUrl) => {
      if (!isMounted || !targetUrl) return;
      cleanupWs();

      const isFallbackConnection = targetUrl === fallbackWsUrl && primaryWsUrl !== fallbackWsUrl;
      if (!isFallbackConnection) setStreamConnected(false);

      try {
        ws = new WebSocket(targetUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setStreamConnected(true);

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
              const frameB64 = data.frame || data.image || data.jpeg || data.data;
              if (frameB64) {
                clearFrameTimeout();
                const src = frameB64.startsWith("data:") ? frameB64 : `data:image/jpeg;base64,${frameB64}`;
                setStreamFrame(src);
                handled = true;
              }
              if (data.status) setWsStatus(data.status);

              if (data.new_accidents && data.new_accidents.length > 0) {
                data.new_accidents.forEach(acc => {
                  if (!seenIncidentIdRef.current.has(acc.accident_id)) {
                    seenIncidentIdRef.current.add(acc.accident_id);
                    sessionStorage.setItem('seenAiIncidents', JSON.stringify([...seenIncidentIdRef.current]));
                    handleNewIncident({ ...acc, camera: selectedCamera.value, location: selectedCamera.label });
                  }
                });
              }
            } catch (e) {
              console.error("WebSocket message error:", e);
            }
          }

          if (!handled && event.data instanceof Blob) {
            clearFrameTimeout();
            const reader = new FileReader();
            reader.onload = () => { if (isMounted) setStreamFrame(reader.result); };
            reader.readAsDataURL(event.data);
          } else if (!handled && event.data instanceof ArrayBuffer) {
            clearFrameTimeout();
            const blob = new Blob([event.data], { type: "image/jpeg" });
            setStreamFrame(URL.createObjectURL(blob));
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

    connectWS(primaryWsUrl || fallbackWsUrl);

    return () => {
      isMounted = false;
      cleanupWs();
      clearFrameTimeout();
      if (backgroundCheckTimer) clearInterval(backgroundCheckTimer);
    };
  }, [selectedCamera.url, selectedCamera.ws_url, selectedCamera.value, selectedCamera.label, handleNewIncident]);


  const stats = {
    total: backendStats.total || 0,
    vehiclesInvolved: wsStatus?.vehicles_involved?.length || 0,
    flow: backendStats.total || 0,
    latency: "33.0",
    model: "YOLOv8x",
    congestion: wsStatus?.is_accident ? 45 : 0
  };

  const pieData = [
    { name: 'Severe', count: backendStats.severityCounts?.SEVERE || 0, color: '#ef4444' },
    { name: 'Moderate', count: backendStats.severityCounts?.MODERATE || 0, color: '#f59e0b' },
    { name: 'Minor', count: backendStats.severityCounts?.MINOR || 0, color: '#10b981' },
    { name: 'Contact', count: backendStats.severityCounts?.CONTACT || 0, color: '#3b82f6' },
  ];

  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  const simulatedVideoBg = isDark ? "#2b3340" : "#d1d5db";

  const videoComponent = (
    <div className="relative flex-1 rounded-lg overflow-hidden flex flex-col min-h-0 h-full w-full bg-black group">
      {streamConnected && streamFrame ? (
        <img
          src={streamFrame}
          alt="Live Camera Feed"
          className="w-full h-full object-fill bg-black z-0"
        />
      ) : (
        <div
          className={`absolute inset-0 flex items-center justify-center opacity-40 transition-colors`}
          style={{ backgroundColor: simulatedVideoBg }}
        >
          <span className={isDark ? "text-gray-500 font-bold tracking-widest uppercase" : "text-gray-600 font-bold tracking-widest uppercase"}>
            Connecting to AI Incident Backend...
          </span>
        </div>
      )}

      {/* Overlay Status Badge */}
      <div className="absolute top-0 left-0 right-0 flex justify-end items-start p-3 z-10 pointer-events-none">
        <div className="flex gap-2 pointer-events-auto items-center">
          <div className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 border shadow-md ${!streamConnected ? 'bg-yellow-900/60 text-yellow-400 border-yellow-700/80 backdrop-blur-md' : !streamFrame ? 'bg-orange-900/60 text-orange-400 border-orange-700/80 backdrop-blur-md' : 'bg-red-950/70 text-red-400 border-red-800/80 backdrop-blur-md'}`}>
            <div className={`w-2 h-2 rounded-full ${!streamConnected ? 'bg-yellow-400' : !streamFrame ? 'bg-orange-400 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
            {!streamConnected ? 'CONNECTING...' : !streamFrame ? 'BUFFERING...' : 'LIVE'}
          </div>

          {/* Theme Styled Settings Icon Button */}
          <button
            onClick={() => setIsSettingsDrawerOpen(true)}
            className="p-1.5 rounded bg-black/60 hover:bg-black/80 text-blue-400 border border-blue-500/30 backdrop-blur-sm transition-all cursor-pointer"
            title="Camera AI Settings"
          >
            <Settings size={14} className="hover:rotate-45 transition-transform" />
          </button>
        </div>
      </div>

      <CameraSettingsDrawer
        visible={isSettingsDrawerOpen}
        onHide={() => setIsSettingsDrawerOpen(false)}
        camera={selectedCamera}
      />
    </div>
  );

  const rightPanelComponent = (
    <div className="flex flex-col gap-3 h-full">
      {/* Alert Status Banner */}
      <div className={`border-2 rounded-xl p-3 flex items-center gap-4 shadow-lg shrink-0 ${stats.total > 0 ? 'bg-red-500/10 border-red-500/50' : 'bg-green-500/10 border-green-500/50'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stats.total > 0 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-green-500/20 text-green-500'}`}>
          <Activity size={20} />
        </div>
        <div className="flex flex-col">
          <h3 className="text-[11px] font-medium opacity-70" style={{ color: themeUtils.getTextColor(true) }}>System Status</h3>
          <p className={`text-lg font-medium mt-0.5 drop-shadow-md ${stats.total > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {stats.total > 0 ? 'CRITICAL ALERT' : 'ALL CLEAR'}
          </p>
        </div>
      </div>

      {/* Incident Types Pie Chart */}
      <div className="border-2 rounded-xl p-3 shadow-lg flex flex-col relative flex-1" style={{ backgroundColor: themeUtils.getBgColor?.('card') || (theme.mode === "Dark" ? "#1a0f0f" : "#fff5f5"), borderColor: themeUtils.getBorderColor?.() || (theme.mode === "Dark" ? "#331111" : "#fecaca") }}>
        <h3 className="text-[11px] font-medium mb-2 text-red-500 flex justify-between items-center shrink-0">
          <span>Incident Types</span>
          <span className="text-[10px] bg-red-500/20 px-2 py-0.5 rounded text-red-500 border border-red-500/30">{stats.total} Total</span>
        </h3>
        <div className="w-full flex-1 flex items-center justify-center py-2 relative z-10">
          {stats.total > 0 ? (
            <InteractivePieChart data={pieData} themeUtils={themeUtils} loading={false} customSize={180} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium opacity-50" style={{ color: themeUtils.getTextColor(false) }}>No critical incidents</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const tableColumns = [
    { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
    { header: "SEVERITY", accessor: "severity", render: (row) => <span className="font-bold" style={{ color: themeUtils.getTextColor(true) }}>{row.severity}</span> },
    { header: "DATE", accessor: "date", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.detected_at ? new Date(row.detected_at).toLocaleDateString() : row.time_str?.split(' ')[0]}</span> },
    { header: "TIME", accessor: "time", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.detected_at ? new Date(row.detected_at).toLocaleTimeString() : row.time_str?.split(' ')[1]}</span> },
    { header: "ZONE", accessor: "zone", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.zone || 'Unknown'}</span> },
    { header: "LOCATION", accessor: "location", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.location || (selectedCamera?.label ? selectedCamera.label.split(' - ')[1] : 'Unknown')}</span> },
    { header: "CAMERA", accessor: "camera", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.camera || 'Unknown'}</span> },
    { header: "IMAGE", accessor: "image", render: (row) => row.image_path ? <img src={`${API_BASE_URL}/${row.image_path}`} className="h-8 w-12 object-cover rounded" /> : <span className="text-[10px]">N/A</span> },
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

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tableLocationFilter, setTableLocationFilter] = useState("");
  const [fromDate, setFromDate] = useState(() => location.state?.fromDate || searchParams.get('fromDate') || "");
  const [toDate, setToDate] = useState(() => location.state?.toDate || searchParams.get('toDate') || "");

  useEffect(() => {
    const from = location.state?.fromDate || searchParams.get('fromDate') || "";
    const to = location.state?.toDate || searchParams.get('toDate') || "";
    setFromDate(from);
    setToDate(to);
  }, [location.pathname, location.search, location.key]);

  const locationOptions = React.useMemo(() => {
    const locSet = new Map();
    if (cameraFilter?.availableOptions?.locations) {
      cameraFilter.availableOptions.locations.forEach(loc => {
        if (loc.name) locSet.set(loc.name.trim(), loc.name.trim());
      });
    }
    if (cameras) {
      cameras.forEach(cam => {
        if (cam.location) locSet.set(cam.location.trim(), cam.location.trim());
      });
    }
    if (incidents) {
      incidents.forEach(inc => {
        if (inc.location) locSet.set(inc.location.trim(), inc.location.trim());
      });
    }
    return Array.from(locSet.values()).sort();
  }, [cameraFilter?.availableOptions?.locations, cameras, incidents]);

  const formattedIncidents = React.useMemo(() => {
    let filtered = incidents;

    if (tableSearchQuery) {
      const q = tableSearchQuery.toLowerCase();
      filtered = filtered.filter(inc => {
        const idStr = String(inc.id || inc.incident_id || '').toLowerCase();
        const sevStr = String(inc.severity || '').toLowerCase();
        const locStr = String(inc.location || '').toLowerCase();
        const typeStr = String(inc.incident_type || inc.type || '').toLowerCase();
        const statusStr = String(inc.status || '').toLowerCase();
        const vehStr = String(inc.vehicles_involved || '').toLowerCase();
        return (
          idStr.includes(q) ||
          sevStr.includes(q) ||
          locStr.includes(q) ||
          typeStr.includes(q) ||
          statusStr.includes(q) ||
          vehStr.includes(q)
        );
      });
    }

    if (tableLocationFilter) {
      const loc = tableLocationFilter.toLowerCase();
      filtered = filtered.filter(inc => {
        const incLoc = String(inc.location || inc.camera || '').toLowerCase();
        return incLoc.includes(loc) || incLoc === loc;
      });
    }

    if (fromDate) {
      filtered = filtered.filter(inc => {
        const d = toLocalDateStr(inc.detected_at || inc.time_str);
        return !d || d >= fromDate;
      });
    }

    if (toDate) {
      filtered = filtered.filter(inc => {
        const d = toLocalDateStr(inc.detected_at || inc.time_str);
        return !d || d <= toDate;
      });
    }

    return filtered.map((inc, i) => ({
      ...inc,
      srNo: i + 1,
      ...resolveCameraDetails(inc, cameras, selectedCamera)
    }));
  }, [incidents, tableSearchQuery, tableLocationFilter, fromDate, toDate, cameras, selectedCamera]);

  const [acknowledgedIds, setAcknowledgedIds] = React.useState(new Set());

  const handleAcknowledgeIncident = async (id) => {
    if (!id) return;
    setAcknowledgedIds(prev => new Set([...prev, id]));
    try {
      await fetch(`${API_BASE_URL}/api/ai-incident/incidents/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACKNOWLEDGED" }),
      });
    } catch (err) {
      console.error("Error acknowledging incident on backend:", err);
    }
  };

  const getUnacknowledgedForCam = (cam) => {
    if (!cam) return [];
    return incidents.filter(inc => {
      const incId = inc.id || inc.incident_id;
      if (acknowledgedIds.has(incId) || inc.status === 'RESOLVED' || inc.status === 'ACKNOWLEDGED') return false;

      const camIdStr = String(cam.id || cam.value || cam.camera_id || '');
      const camUrl = cam.url || cam.rtsp_url || '';

      const matchId = inc.camera_id && String(inc.camera_id) === camIdStr;
      const matchCode = (inc.camera || inc.stream_id) && (
        String(inc.camera) === String(cam.value) ||
        String(inc.camera) === String(cam.label) ||
        String(inc.stream_id) === String(cam.value) ||
        String(inc.stream_id) === String(cam.camera_code)
      );
      const matchUrl = inc.rtsp_url && camUrl && inc.rtsp_url === camUrl;
      const matchLocation = inc.location && cam.location && (inc.location === cam.location || inc.location === cam.label);

      return Boolean(matchId || matchCode || matchUrl || matchLocation);
    });
  };

  const [itemsPerPage, setItemsPerPage] = React.useState(12);
  const [currentPage, setCurrentPage] = React.useState(1);

  const camerasList = cameraFilter.availableOptions.cameras;

  const paginatedCameras = React.useMemo(() => {
    if (itemsPerPage === null || itemsPerPage === Infinity) return camerasList;
    const start = (currentPage - 1) * itemsPerPage;
    return camerasList.slice(start, start + itemsPerPage);
  }, [camerasList, currentPage, itemsPerPage, refreshKey]);

  const cameraGridComponent = (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl border w-full"
      style={{ backgroundColor: themeUtils.getBgColor("card"), borderColor: themeUtils.getBorderColor() }}
    >
      <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-3" style={{ borderColor: themeUtils.getBorderColor() }}>
        <div className="flex items-center gap-2">
          <CameraIcon size={18} className="text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: themeUtils.getTextColor(true) }}>
            AI Accident / Incident Live Feeds ({camerasList.length} Cameras)
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
            No cameras mapped for AI Incident Detection.
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
                onAcknowledgeItem={handleAcknowledgeIncident}
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
      title="AI Incident Detection"
      subtitle="Detects accidents and sends immediate alerts via real-time analysis"
      hideLiveSystem={true}
      hideCameraInHeader={false}
      videoComponent={cameraGridComponent}
      bottomTableComponent={
        <>
          <PaginatedTable
            title="RECENT ACCIDENT & INCIDENT LOG"
            columns={tableColumns}
            data={formattedIncidents}
            itemsPerPage={10}
            headerContent={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-48 sm:w-56">
                  <SearchBar
                    searchValue={tableSearchQuery}
                    onSearchChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="Search incidents, ID..."
                  />
                </div>
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
            header="Incident Details"
          >
            {!selectedRecord ? (
              <div className="flex justify-center items-center h-full pt-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 pt-4">
                <div className="w-full h-64 rounded-xl border overflow-hidden bg-black/10 flex items-center justify-center">
                  {selectedRecord.image_path ? (
                    <img src={`${API_BASE_URL}/${selectedRecord.image_path}`} alt="Incident" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-500">No Image Available</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">

                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Severity</p>
                    <p className={`font-semibold text-lg ${selectedRecord.severity === 'SEVERE' ? 'text-red-500' : 'text-yellow-500'}`}>{selectedRecord.severity}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Zone</p>
                    <p className="font-semibold text-sm">{selectedRecord.zone || 'Unknown'}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Location</p>
                    <p className="font-semibold text-sm">{selectedRecord.location || (selectedCamera?.label ? selectedCamera.label.split(' - ')[1] : 'Unknown')}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Camera</p>
                    <p className="font-semibold text-sm">{selectedRecord.camera || 'Unknown'}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Detection Date</p>
                    <p className="font-semibold text-sm">
                      {selectedRecord.detected_at
                        ? new Date(selectedRecord.detected_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                        : (selectedRecord.time_str?.split(' ')[0] || 'N/A')}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Detection Time</p>
                    <p className="font-semibold text-sm">
                      {selectedRecord.detected_at
                        ? new Date(selectedRecord.detected_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                        : (selectedRecord.time_str?.split(' ')[1] || 'N/A')}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Status</p>
                    <p className={`font-semibold text-sm ${selectedRecord.status === 'UNRESOLVED' ? 'text-red-500' : 'text-green-500'}`}>
                      {selectedRecord.status || "UNRESOLVED"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </RightSideDialog>
        </>
      }
      cameraFilter={cameraFilter}
      extraFilterData={formattedIncidents}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshKey(prev => prev + 1);
              toast?.info?.("Refreshed", "AI incident data updated");
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => {
              import('../../utils/exportUtils').then(({ exportToCSV }) => {
                exportToCSV(formattedIncidents, 'ai_incidents_export');
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
