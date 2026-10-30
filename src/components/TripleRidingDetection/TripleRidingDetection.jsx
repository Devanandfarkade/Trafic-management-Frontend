import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  AlertTriangle,
  Camera as CameraIcon,
  Video,
  MapPin,
  Clock,
  Eye,
  Search,
  Filter,
  Maximize,
  Minimize,
  Settings,
  Sparkles,
  Radio,
  FileText,
  Download,
  Grid,
  MonitorPlay,
  ShieldAlert,
  ShieldCheck,
  Bike,
  CheckCircle2,
  XCircle,
  FileWarning,
  ExternalLink,
  Printer,
  RefreshCw,
  Play,
  WifiOff,
  Cpu,
  Server,
  Sliders,
  CheckCircle
} from 'lucide-react';
import { useTheme } from '../../ui/Settings/themeUtils';
import { useToast } from '../../ui/common/CustomToast';
import ModuleLayout from '../../ui/layout/ModuleLayout';
import PaginatedTable from '../../ui/common/PaginatedTable';
import SearchBar from '../../ui/common/SearchBar';
import RightSideDialog from '../../ui/common/RightSideDialog';
import RecordsPerPage from '../../ui/common/RecordsPerPage';
import Pagination from '../../ui/common/Pagination';
import DateRangePicker from '../../ui/common/DateRangePicker';
import LiveCameraCard from '../LiveMonitoring/LiveCameraCard';
import useCameraFilter from '../../hooks/useCameraFilter';
import CameraSettingsDrawer from '../../ui/common/CameraSettingsDrawer';
import { API_CONFIG } from '../../../config.js';
import useTripleRidingStream from '../../hooks/useTripleRidingStream';

// Initial Mock Detections for Triple Riding (Two-Wheelers with 3+ occupants)
const INITIAL_TRIPCY_VIOLATIONS = [
  {
    id: 'TRP-9021',
    regNumber: 'MH 12 AB 4591',
    vehicleType: 'Hero Splendor Plus',
    riderCount: 3,
    helmetsDetected: 1, // Only driver
    helmetStatus: 'Driver Only',
    severity: 'Critical',
    location: 'Tiranga Circle - Main Junction',
    zone: 'North Zone',
    camera: 'CAM-01 (4K UltraHD)',
    cameraId: '1',
    timestamp: '2026-10-27 16:42:18',
    speed: '44 km/h',
    snapshotId: 'SNP-2026-88102',
    recordStatus: 'RECORDED',
    confidence: '98.4%',
    evidenceImage: null
  },
  {
    id: 'TRP-9022',
    regNumber: 'MH 14 DX 8912',
    vehicleType: 'Honda Activa 6G',
    riderCount: 3,
    helmetsDetected: 0,
    helmetStatus: 'No Helmets',
    severity: 'Critical',
    location: 'Bhigwan Chowk',
    zone: 'South Zone',
    camera: 'CAM-02 (PTZ Junction)',
    cameraId: '2',
    timestamp: '2026-10-27 16:35:05',
    speed: '38 km/h',
    snapshotId: 'SNP-2026-88103',
    recordStatus: 'VERIFIED',
    confidence: '99.1%',
    evidenceImage: null
  },
  {
    id: 'TRP-9023',
    regNumber: 'MH 42 Q 3319',
    vehicleType: 'Bajaj Pulsar 150',
    riderCount: 4,
    helmetsDetected: 0,
    helmetStatus: 'No Helmets',
    severity: 'Critical',
    location: 'Baramati MIDC North Entry',
    zone: 'North Zone',
    camera: 'CAM-03 (North Gate)',
    cameraId: '3',
    timestamp: '2026-10-27 16:18:44',
    speed: '51 km/h',
    snapshotId: 'SNP-2026-88104',
    recordStatus: 'FLAGGED',
    confidence: '97.8%',
    evidenceImage: null
  },
  {
    id: 'TRP-9024',
    regNumber: 'MH 12 RT 6023',
    vehicleType: 'TVS Jupiter 125',
    riderCount: 3,
    helmetsDetected: 2,
    helmetStatus: 'Driver & Pillion 1',
    severity: 'High',
    location: 'Court Road Signal',
    zone: 'Central Zone',
    camera: 'CAM-04 (Market Yard)',
    cameraId: '4',
    timestamp: '2026-10-27 15:52:10',
    speed: '32 km/h',
    snapshotId: 'SNP-2026-88105',
    recordStatus: 'VERIFIED',
    confidence: '96.5%',
    evidenceImage: null
  },
  {
    id: 'TRP-9025',
    regNumber: 'MH 12 BN 1092',
    vehicleType: 'Yamaha FZ-S',
    riderCount: 3,
    helmetsDetected: 1,
    helmetStatus: 'Driver Only',
    severity: 'High',
    location: 'City Hospital Flyover',
    zone: 'East Zone',
    camera: 'CAM-05 (Hospital Rd)',
    cameraId: '5',
    timestamp: '2026-10-27 15:20:19',
    speed: '48 km/h',
    snapshotId: 'SNP-2026-88106',
    recordStatus: 'RECORDED',
    confidence: '98.0%',
    evidenceImage: null
  },
  {
    id: 'TRP-9026',
    regNumber: 'MH 14 CZ 4402',
    vehicleType: 'Suzuki Access 125',
    riderCount: 3,
    helmetsDetected: 0,
    helmetStatus: 'No Helmets',
    severity: 'Critical',
    location: 'Railway Station Road',
    zone: 'West Zone',
    camera: 'CAM-06 (Station Approach)',
    cameraId: '6',
    timestamp: '2026-10-27 14:55:30',
    speed: '29 km/h',
    snapshotId: 'SNP-2026-88107',
    recordStatus: 'RECORDED',
    confidence: '97.2%',
    evidenceImage: null
  }
];

export default function TripleRidingDetection() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();
  const isDark = theme.mode === 'Dark';

  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor('card');
  const themeColor = theme.headerBg || '#3b82f6';

  // Camera Filter Hook - Fetch zones, locations, and cameras mapped to triple riding
  const cameraFilter = useCameraFilter('triple_riding');
  const camerasList = cameraFilter?.availableOptions?.cameras || [];
  const selectedCamera = cameraFilter?.selectedCamera;

  // Resolved Active RTSP URL for live streaming
  const activeRtspUrl = useMemo(() => {
    return (
      selectedCamera?.rtsp_url ||
      selectedCamera?.stream_url ||
      selectedCamera?.rtsp ||
      API_CONFIG.RTSP_TRIPLE_RIDING_CAM ||
      'rtsp://admin:Admin%40123@192.168.1.21:554'
    );
  }, [selectedCamera]);

  // View Mode: 'grid' (Multi-Camera Live AI Surveillance Grid) or 'focused' (Single Live AI Stream)
  const [viewMode, setViewMode] = useState('grid');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);

  // Custom Python Server Inputs
  const [customRtspInput, setCustomRtspInput] = useState(activeRtspUrl);
  const [customApiInput, setCustomApiInput] = useState(API_CONFIG.TRIPLE_RIDING_API_URL || 'http://110.227.253.23:8091');
  const [customWsInput, setCustomWsInput] = useState(API_CONFIG.TRIPLE_RIDING_WS_URL || 'ws://110.227.253.23:8091');

  // Keep custom RTSP input updated when selected camera changes
  useEffect(() => {
    if (activeRtspUrl) {
      setCustomRtspInput(activeRtspUrl);
    }
  }, [activeRtspUrl]);

  // Violations State
  const [violations, setViolations] = useState(() => {
    try {
      const saved = localStorage.getItem('triple_riding_violations_db');
      return saved ? JSON.parse(saved) : INITIAL_TRIPCY_VIOLATIONS;
    } catch {
      return INITIAL_TRIPCY_VIOLATIONS;
    }
  });

  useEffect(() => {
    localStorage.setItem('triple_riding_violations_db', JSON.stringify(violations));
  }, [violations]);

  // Real-time Python Detection Message Handler
  const handlePythonDetection = useCallback((msg) => {
    const now = new Date();
    const timeStr = msg.time
      ? msg.time.replace('T', ' ').slice(0, 19)
      : `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`;

    const newViolation = {
      id: `TRP-B${msg.bike_id}-${Date.now().toString().slice(-4)}`,
      regNumber: `BIKE #${msg.bike_id}`,
      vehicleType: 'Two-Wheeler (Motorcycle/Scooter)',
      riderCount: msg.riders || 3,
      helmetsDetected: 0,
      helmetStatus: '3+ Occupants Violation',
      severity: (msg.riders >= 4) ? 'Critical' : 'High',
      location: selectedCamera?.location || 'Baramati - Main Junction',
      zone: selectedCamera?.zone || 'North Zone',
      camera: selectedCamera?.label || `CAM-0${selectedCamera?.value || '1'} (AI Stream)`,
      cameraId: String(selectedCamera?.value || selectedCamera?.id || '1'),
      timestamp: timeStr,
      speed: 'Detected in Motion',
      snapshotId: `SNP-TRP-${msg.bike_id}-${Date.now().toString().slice(-4)}`,
      recordStatus: 'RECORDED',
      confidence: '98.8%',
      evidenceImage: msg.snapshot, // Base64 JPEG snapshot directly from Python backend
      rawDetection: msg
    };

    setViolations(prev => [newViolation, ...prev]);

    toast.error(
      "TRIPLE SEAT DETECTED!",
      `Bike #${msg.bike_id} with ${msg.riders} riders at ${newViolation.location}`
    );
  }, [selectedCamera, toast]);

  // Initialize Python AI Stream Hook (Port 8091)
  const {
    isConnected: isStreamConnected,
    isConnecting: isStreamConnecting,
    streamError,
    liveFrame,
    lastDetection: pythonLastDetection,
    fps: streamFps,
    rtspUrl: streamRtspUrl,
    setRtspUrl: setStreamRtspUrl,
    apiUrl: pythonApiUrl,
    setApiUrl: setPythonApiUrl,
    wsBaseUrl: pythonWsUrl,
    setWsBaseUrl: setPythonWsUrl,
    health: serverHealth,
    isCheckingHealth,
    checkHealth,
    isReloadingWeights,
    reloadResult,
    reloadWeights,
    connect: connectStream,
    disconnect: disconnectStream,
    reconnect: reconnectStream
  } = useTripleRidingStream({
    rtspUrl: activeRtspUrl,
    autoConnect: true,
    onDetection: handlePythonDetection
  });

  // Sync inputs with stream state
  useEffect(() => {
    setCustomRtspInput(streamRtspUrl);
    setCustomApiInput(pythonApiUrl);
    setCustomWsInput(pythonWsUrl);
  }, [streamRtspUrl, pythonApiUrl, pythonWsUrl]);

  // Python Health Check Trigger
  const handleCheckHealth = async () => {
    toast.info("Testing Python Server...", "Calling GET /health...");
    const res = await checkHealth();
    if (res && res.status === 'ok') {
      toast.success(
        "Python AI Server Online",
        `Model: ${res.model_loaded ? 'yolo11m.pt loaded' : 'loading...'} | Streams: ${res.active_recognizers} | Latency: ${res.latency}ms`
      );
    } else {
      toast.error(
        "Python Server Offline",
        res?.error || "Could not reach Python AI server /health on port 8091"
      );
    }
  };

  // Reload YOLO Weights Trigger (POST /triple/reload)
  const handleReloadWeights = async () => {
    toast.info("Reloading YOLO Weights...", "Calling POST /triple/reload on Python server...");
    const res = await reloadWeights();
    if (res && res.status === 'success') {
      toast.success(
        "Weights Reloaded Successfully!",
        `Loaded model weights: ${res.weights || 'yolo11m.pt'}`
      );
    } else {
      toast.error(
        "Reload Failed",
        res?.message || "Failed to reload weights on Python server."
      );
    }
  };

  // Download Snapshot Helper
  const handleDownloadSnapshot = (record) => {
    if (!record) return;
    if (record.evidenceImage) {
      const link = document.createElement('a');
      link.href = record.evidenceImage;
      link.download = `TripleSeat_${record.id || 'snapshot'}_${record.regNumber?.replace(/\s+/g, '_') || 'evidence'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Downloaded", "Evidence snapshot downloaded successfully");
    } else {
      toast.info("No Snapshot", "No image snapshot available for this mock record");
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [helmetFilter, setHelmetFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selected Record & Modal
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Camera Grid Pagination
  const [gridCurrentPage, setGridCurrentPage] = useState(1);
  const [gridItemsPerPage, setGridItemsPerPage] = useState(12);

  const paginatedCameras = useMemo(() => {
    if (!camerasList.length) return [];
    if (gridItemsPerPage === null || gridItemsPerPage === Infinity) return camerasList;
    const start = (gridCurrentPage - 1) * gridItemsPerPage;
    return camerasList.slice(start, start + gridItemsPerPage);
  }, [camerasList, gridCurrentPage, gridItemsPerPage]);

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // Derived filtered violations
  const filteredViolations = useMemo(() => {
    return violations.filter(v => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          v.regNumber?.toLowerCase().includes(q) ||
          v.vehicleType?.toLowerCase().includes(q) ||
          v.location?.toLowerCase().includes(q) ||
          v.snapshotId?.toLowerCase().includes(q) ||
          v.id?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (statusFilter !== 'All' && v.recordStatus !== statusFilter) return false;
      if (helmetFilter !== 'All' && v.helmetStatus !== helmetFilter) return false;
      if (severityFilter !== 'All' && v.severity !== severityFilter) return false;

      if (fromDate) {
        const vDate = v.timestamp ? v.timestamp.split(' ')[0] : '';
        if (vDate < fromDate) return false;
      }
      if (toDate) {
        const vDate = v.timestamp ? v.timestamp.split(' ')[0] : '';
        if (vDate > toDate) return false;
      }

      if (cameraFilter?.selectedCamera) {
        const camVal = String(cameraFilter.selectedCamera.value || cameraFilter.selectedCamera.id || cameraFilter.selectedCamera);
        if (camVal && v.cameraId && String(v.cameraId) !== camVal) return false;
      }

      return true;
    }).map((item, idx) => ({ ...item, srNo: idx + 1 }));
  }, [violations, searchQuery, statusFilter, helmetFilter, severityFilter, fromDate, toDate, cameraFilter?.selectedCamera]);

  // Derived KPI Stats
  const totalViolations = violations.length;
  const todayCount = violations.filter(v => (v.timestamp || '').startsWith(new Date().toISOString().slice(0, 10))).length || 4;
  const noHelmetCount = violations.filter(v => v.helmetStatus === 'No Helmets').length;
  const snapshotsSaved = violations.length;
  const criticalCount = violations.filter(v => v.severity === 'Critical' || v.riderCount >= 4).length;
  const activeCameras = camerasList.length || 6;

  // Stats Card Config (Text on one side, Number on other side)
  const statsList = [
    { title: "TOTAL DETECTIONS", count: totalViolations, color: "#2563eb" },
    { title: "TRIPCY TODAY", count: todayCount, color: "#06b6d4" },
    { title: "NO HELMETS", count: noHelmetCount, color: "#ec4899" },
    { title: "SNAPSHOTS SAVED", count: snapshotsSaved, color: "#a855f7" },
    { title: "CRITICAL RISK", count: criticalCount, color: "#ef4444" },
    { title: "ACTIVE CAMERAS", count: activeCameras, color: "#eab308" }
  ];

  // Real-time Simulation Trigger
  const simulateLiveViolation = () => {
    const randomPlates = ['MH 12 EQ 7781', 'MH 14 BK 9021', 'MH 42 R 1120', 'MH 12 ZZ 4589'];
    const randomBikes = ['Honda Shine 125', 'Hero Glamour', 'Royal Enfield Classic', 'TVS Raider 125'];
    const randomLocs = ['Tiranga Circle', 'Bhigwan Chowk', 'Railway Station Road', 'Court Road'];
    const now = new Date();
    const timeStr = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`;

    const newViolation = {
      id: `TRP-${Math.floor(9000 + Math.random() * 1000)}`,
      regNumber: randomPlates[Math.floor(Math.random() * randomPlates.length)],
      vehicleType: randomBikes[Math.floor(Math.random() * randomBikes.length)],
      riderCount: Math.random() > 0.8 ? 4 : 3,
      helmetsDetected: Math.floor(Math.random() * 2),
      helmetStatus: Math.random() > 0.5 ? 'Driver Only' : 'No Helmets',
      severity: 'Critical',
      location: randomLocs[Math.floor(Math.random() * randomLocs.length)],
      zone: 'North Zone',
      camera: selectedCamera?.label || 'CAM-01 (4K UltraHD)',
      cameraId: String(selectedCamera?.value || '1'),
      timestamp: timeStr,
      speed: `${Math.floor(35 + Math.random() * 25)} km/h`,
      snapshotId: `SNP-2026-${Math.floor(88000 + Math.random() * 999)}`,
      recordStatus: 'RECORDED',
      confidence: '97.6%',
      evidenceImage: null
    };

    setViolations(prev => [newViolation, ...prev]);
    toast.info('Snapshot Saved', `Incident snapshot recorded for ${newViolation.regNumber} (${newViolation.riderCount} riders)`);
  };

  const handleExportCSV = async () => {
    try {
      const { exportToCSV } = await import('../../utils/exportUtils');
      const exportData = filteredViolations.map(v => ({
        'Record ID': v.id,
        'Snapshot ID': v.snapshotId,
        'Vehicle Plate': v.regNumber,
        'Vehicle Type': v.vehicleType,
        'Rider Count': `${v.riderCount} Persons`,
        'Helmet Status': v.helmetStatus,
        'Speed': v.speed,
        'Location': v.location,
        'Time': v.timestamp,
        'Confidence': v.confidence || '98%',
        'Record Status': v.recordStatus
      }));
      exportToCSV(exportData, `Triple_Riding_Snapshot_Records_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Report Exported', 'Triple riding snapshot records downloaded successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Export Error', 'Failed to export CSV file');
    }
  };

  // -------------------------------------------------------------
  // Focused Stream Component (Live Python AI Stream on Port 8091)
  // -------------------------------------------------------------
  const focusedStreamComponent = (
    <>
      <div className="relative w-full h-full min-h-[360px] rounded-xl overflow-hidden bg-black border shadow-lg flex flex-col justify-between" style={{ borderColor }}>
        {/* Top Overlay Bar */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between z-20 pointer-events-auto flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-2.5 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1.5 bg-red-600/90 text-white shadow-lg border border-red-400/40 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
              LIVE AI SURVEILLANCE
            </div>

            {/* Connection Status Pill */}
            <div className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border backdrop-blur-md flex items-center gap-1.5 ${isStreamConnected
              ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/40'
              : isStreamConnecting
                ? 'bg-amber-950/70 text-amber-400 border-amber-500/40'
                : 'bg-red-950/70 text-red-400 border-red-500/40'
              }`}>
              <Radio size={12} className={isStreamConnected ? "animate-pulse" : ""} />
              <span>
                {isStreamConnected
                  ? `STREAM ACTIVE (${streamFps} FPS)`
                  : isStreamConnecting
                    ? 'CONNECTING TO PYTHON WS...'
                    : 'STREAM OFFLINE'}
              </span>
            </div>

            {/* Model Weights Badge */}
            <div
              onClick={handleCheckHealth}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border backdrop-blur-md flex items-center gap-1.5 cursor-pointer transition-all ${serverHealth.status === 'ok'
                ? 'bg-blue-950/60 text-cyan-300 border-cyan-500/30 hover:bg-blue-900/60'
                : 'bg-gray-900/60 text-gray-400 border-gray-700/40 hover:bg-gray-800/60'
                }`}
              title="Click to test Python AI /health"
            >
              <Cpu size={12} />
              <span>
                {serverHealth.model_loaded ? 'YOLO11M LOADED' : 'CHECKING MODEL...'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Reload Weights Button */}
            <button
              onClick={handleReloadWeights}
              disabled={isReloadingWeights}
              className="px-2.5 py-1 rounded-md bg-black/60 hover:bg-blue-600/30 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Reload YOLO Weights (POST /triple/reload)"
            >
              <RefreshCw size={12} className={isReloadingWeights ? "animate-spin" : ""} />
              <span className="hidden md:inline">Reload Weights</span>
            </button>

            {/* Switch to Camera Grid */}
            <button
              onClick={() => setViewMode('grid')}
              className="px-2.5 py-1 rounded-md bg-black/60 hover:bg-black/80 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer"
              title="Switch to Camera Grid"
            >
              <Grid size={13} />
              <span className="hidden sm:inline">Camera Grid</span>
            </button>

            {/* Python Stream Settings */}
            <button
              onClick={() => setIsServerSettingsOpen(true)}
              className="p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-blue-400 hover:text-blue-300 border border-blue-500/30 backdrop-blur-md transition-all cursor-pointer"
              title="Python AI Server & Camera Settings"
            >
              <Settings size={15} className="hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Video Area: Real Live Stream or Standby Screen */}
        <div className="relative flex-1 w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden bg-black">
          {liveFrame ? (
            <img
              src={liveFrame}
              alt="Triple Riding Live AI Surveillance"
              className="w-full h-full object-contain select-none pointer-events-none"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#060a12] via-[#091122] to-[#040810] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl border border-blue-500/30 bg-blue-950/30 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(59,130,246,0.25)]">
                {isStreamConnecting ? (
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                ) : streamError ? (
                  <WifiOff className="w-8 h-8 text-red-400" />
                ) : (
                  <Bike className="w-8 h-8 text-cyan-400 animate-pulse" />
                )}
              </div>

              <p className="text-sm font-bold text-gray-200 uppercase tracking-wider">
                {isStreamConnecting
                  ? 'Connecting to Python Triple Seat AI Server...'
                  : streamError
                    ? 'AI Stream Disconnected'
                    : 'Live Camera Standby'}
              </p>

              <p className="text-xs text-gray-400 mt-1 max-w-md font-mono truncate">
                {streamError || `RTSP: ${streamRtspUrl || 'Configuring stream URL...'}`}
              </p>

              <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                {!isStreamConnected && (
                  <button
                    onClick={() => connectStream()}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play size={13} /> Reconnect
                  </button>
                )}
                <button
                  onClick={handleCheckHealth}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 font-bold text-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Server size={13} /> Test /health
                </button>
                <button
                  onClick={() => setIsServerSettingsOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-cyan-400 font-bold text-xs border border-blue-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders size={13} /> Stream Settings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar Info on Video */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/75 border border-white/10 text-white text-xs backdrop-blur-md">
            <MapPin size={13} className="text-blue-400" />
            <span className="font-semibold">{selectedCamera?.location || "Baramati - Main Junction"}</span>
            <span className="opacity-40">|</span>
            <span className="text-gray-300 text-[11px] font-mono">{selectedCamera?.label || "Live Camera"}</span>
            <span className="opacity-40">|</span>
            <span className="text-cyan-400 text-[10px] font-mono font-bold">Port 8091</span>
          </div>

          <button
            onClick={() => setIsMaximized(true)}
            className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors cursor-pointer backdrop-blur-sm border border-white/10"
            title="Maximize Stream"
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>

      {/* Fullscreen Portal Overlay */}
      {isMaximized && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col p-3 md:p-6 text-white font-sans">
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black border border-white/20 shadow-2xl flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between z-30 pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 rounded-md text-xs font-extrabold flex items-center gap-2 bg-red-600 text-white shadow-lg border border-red-400/40">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                  LIVE AI TRIPLE RIDING SURVEILLANCE
                </div>
                <span className="text-sm font-semibold text-gray-200 hidden sm:inline">
                  {selectedCamera?.location || "Baramati"} ({selectedCamera?.label || "Live Camera"})
                </span>
                {isStreamConnected && (
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/40">
                    {streamFps} FPS
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMaximized(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
                  title="Minimize (Esc)"
                >
                  <Minimize size={16} />
                  <span>Minimize</span>
                </button>
              </div>
            </div>

            {/* Video Feed in Fullscreen */}
            <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black">
              {liveFrame ? (
                <img
                  src={liveFrame}
                  alt="Live Fullscreen AI Stream"
                  className="w-full h-full object-contain select-none pointer-events-none"
                />
              ) : (
                <div className="relative flex-1 w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#060a12] via-[#091122] to-[#040810]">
                  <Bike className="w-16 h-16 text-cyan-400 animate-pulse mb-3" />
                  <span className="text-sm text-cyan-300 font-bold uppercase tracking-wider text-center">
                    {isStreamConnecting ? 'Connecting Live AI Camera Stream...' : streamError ? streamError : 'Triple Seat Detection Live Feed'}
                  </span>
                  <span className="text-xs text-gray-400 mt-1 font-mono">
                    {streamRtspUrl}
                  </span>
                </div>
              )}
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-auto">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-black/80 border border-white/10 text-white text-xs backdrop-blur-md">
                <MapPin size={14} className="text-blue-400" />
                <span>{selectedCamera?.location || "Baramati - Main Junction"}</span>
                <span className="opacity-40">|</span>
                <span className="text-gray-300 text-xs font-mono">{selectedCamera?.label || "Live Camera"}</span>
              </div>
              <button
                onClick={() => setIsMaximized(false)}
                className="bg-black/80 hover:bg-black text-white px-3.5 py-2 rounded-lg transition-colors cursor-pointer backdrop-blur-sm border border-white/20 flex items-center gap-1.5 text-xs font-bold"
              >
                <Minimize size={15} />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );

  const getUnacknowledgedForCam = (cam) => {
    if (!cam) return [];
    return violations.filter(v => {
      if (v.recordStatus === 'VERIFIED') return false;
      const camIdStr = String(cam.id || cam.value || cam.camera_id || '');
      return String(v.cameraId) === camIdStr || String(v.camera || '').includes(cam.label || '') || String(v.camera || '').includes(cam.value || '');
    });
  };

  const cameraGridComponent = (
    <div className="flex flex-col gap-3 p-4 rounded-xl border w-full" style={{ backgroundColor: cardBg, borderColor }}>
      <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-3" style={{ borderColor }}>
        <div className="flex items-center gap-2">
          <CameraIcon size={18} className="text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: textPrimary }}>
            Triple Riding Detection Live Feeds ({camerasList.length} Cameras)
          </span>
        </div>

        <div className="flex items-center gap-3">


          <RecordsPerPage
            value={gridItemsPerPage}
            onChange={(val) => { setGridItemsPerPage(val); setGridCurrentPage(1); }}
            options={[4, 8, 12, 16]}
            label="Cameras per page"
          />
        </div>
      </div>

      {camerasList.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[220px] gap-2 opacity-60">
          <CameraIcon size={36} />
          <p className="text-xs font-medium" style={{ color: textSecondary }}>
            No cameras mapped for Triple Riding Detection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginatedCameras.map((cam) => (
            <div
              key={cam.id || cam.value}
              className="h-48 sm:h-56 md:h-60 lg:h-64 xl:h-72 2xl:h-80 rounded-lg overflow-hidden border relative group"
              style={{ borderColor }}
            >
              <LiveCameraCard
                camera={cam}
                showDetectionDot={true}
                unacknowledgedItems={getUnacknowledgedForCam(cam)}
                onAcknowledgeItem={(item) => {
                  setViolations(prev => prev.map(v => v.id === item.id ? { ...v, recordStatus: 'VERIFIED' } : v));
                }}
              />
              <button
                onClick={() => {
                  cameraFilter?.setSelectedCameraId?.(cam.id || cam.value);
                  setViewMode('focused');
                }}
                className="absolute top-2 right-2 z-10 px-2 py-1 rounded bg-black/75 hover:bg-blue-600 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 shadow-md cursor-pointer border border-white/20 backdrop-blur-sm"
                title="Focus Live AI Stream on this camera"
              >
                <MonitorPlay size={11} /> AI Focus
              </button>
            </div>
          ))}
        </div>
      )}

      {camerasList.length > gridItemsPerPage && (
        <div className="pt-2">
          <Pagination
            currentPage={gridCurrentPage}
            totalItems={camerasList.length}
            itemsPerPage={gridItemsPerPage === null || gridItemsPerPage === Infinity ? camerasList.length || 1 : gridItemsPerPage}
            onPageChange={(page) => setGridCurrentPage(page)}
          />
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------
  // Compact Live Alerts Panel
  // -------------------------------------------------------------
  const alertsPanelComponent = (
    <div
      className="border rounded-xl p-0 shadow-md relative overflow-hidden flex flex-col h-full"
      style={{
        backgroundColor: isDark ? "#09121f" : "#f0f7ff",
        borderColor: isDark ? "#1e3a5f" : "#bfdbfe"
      }}
    >
      <div className="px-3 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex justify-between items-center shrink-0 shadow-sm">
        <h3 className="text-xs font-bold uppercase flex items-center gap-1.5 tracking-wide">
          <ShieldAlert size={14} className="text-cyan-300" /> Active Tripcy Alerts
        </h3>
        <span className="text-[9px] font-bold px-2 py-0.5 bg-black/30 rounded-full animate-pulse uppercase border border-white/20">
          Live Feed
        </span>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col divide-y divide-blue-500/10 p-1">
        {filteredViolations.slice(0, 5).map((v) => (
          <div
            key={v.id}
            onClick={() => { setSelectedRecord(v); setIsModalOpen(true); }}
            className="flex items-center gap-2.5 p-2 hover:bg-blue-500/10 transition-all rounded-lg cursor-pointer group"
          >
            <div className="w-11 h-11 bg-black/50 rounded-lg flex-shrink-0 overflow-hidden relative border border-blue-500/40 shadow-inner flex flex-col items-center justify-center group-hover:border-cyan-400 transition-colors">
              <Users className="w-5 h-5 text-cyan-400" />
              <div className="text-[8px] font-bold text-red-400">{v.riderCount} P</div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <p className="font-extrabold text-xs text-white truncate leading-tight group-hover:text-blue-300 font-mono">
                  {v.regNumber}
                </p>
                <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase bg-blue-500/20 text-blue-400 border border-blue-500/40">
                  {v.recordStatus || 'RECORDED'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium truncate mb-0.5">
                {v.vehicleType} • <span className="text-amber-300">{v.helmetStatus}</span>
              </p>
              <div className="flex items-center justify-between text-[9px] text-gray-400">
                <span className="flex items-center gap-1 truncate">
                  <MapPin size={9} className="text-blue-400" /> {v.location}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock size={9} /> {v.timestamp.slice(11, 16)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-1.5 bg-black/10 border-t border-blue-500/20 flex items-center justify-between shrink-0">
        <span className="text-[9px] text-gray-400 font-medium">
          Showing top {Math.min(filteredViolations.length, 5)} alerts
        </span>
        <button
          onClick={simulateLiveViolation}
          className="text-[9px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Sparkles size={10} /> Simulate Alert
        </button>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // Full-Width Stats Cards (One side text, other side number)
  // -------------------------------------------------------------
  const fullScreenStatsCards = (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
      {statsList.map((stat, i) => (
        <div
          key={i}
          className="px-4 py-3 rounded-xl border flex items-center justify-between shadow-sm transition-all hover:shadow-md gap-2 min-h-[68px]"
          style={{ backgroundColor: cardBg, borderColor }}
        >
          <span
            className="text-[11px] font-extrabold uppercase tracking-wider leading-snug"
            style={{ color: textSecondary }}
          >
            {stat.title}
          </span>
          <span
            className="text-2xl sm:text-3xl font-black shrink-0"
            style={{ color: stat.color }}
          >
            {stat.count}
          </span>
        </div>
      ))}
    </div>
  );

  // Upper section combining Live Multi-Camera Grid or Focused Live Stream + Stats Cards
  const upperSection = (
    <div className="flex flex-col gap-3 w-full">
      {viewMode === 'grid' ? cameraGridComponent : focusedStreamComponent}
      {fullScreenStatsCards}
    </div>
  );

  // Table Columns
  const tableColumns = [
    {
      header: "SR.NO",
      accessor: "srNo",
      render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span>
    },
    {
      header: "VEHICLE REG NO",
      accessor: "regNumber",
      render: (row) => (
        <span className="font-mono font-bold text-xs text-white tracking-wider">
          {row.regNumber}
        </span>
      )
    },
    {
      header: "RIDER COUNT",
      accessor: "riderCount",
      render: (row) => (
        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Users size={13} className="text-red-400" />
          {row.riderCount} Riders
        </span>
      )
    },
    {
      header: "HELMET STATUS",
      accessor: "helmetStatus",
      render: (row) => (
        <span className="text-xs font-semibold text-white">
          {row.helmetStatus}
        </span>
      )
    },
    {
      header: "LOCATION",
      accessor: "location",
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold" style={{ color: textPrimary }}>{row.location}</span>
          <span className="text-[10px] text-gray-400">{row.camera}</span>
        </div>
      )
    },
    {
      header: "DATE & TIME",
      accessor: "timestamp",
      render: (row) => (
        <span className="text-xs font-mono text-gray-400">{row.timestamp}</span>
      )
    },
    {
      header: "RECORD STATUS",
      accessor: "recordStatus",
      render: (row) => (
        <span className="text-xs font-semibold uppercase text-white">
          {row.recordStatus || 'RECORDED'}
        </span>
      )
    },
    {
      header: "ACTION",
      accessor: "action",
      render: (row) => (
        <button
          onClick={() => { setSelectedRecord(row); setIsModalOpen(true); }}
          className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors cursor-pointer"
          title="View Forensic Evidence Snapshot"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  return (
    <ModuleLayout
      title="Triple Riding Detection"
      hideLiveSystem={true}
      hideCameraInHeader={false}
      cameraFilter={cameraFilter}
      headerActions={
        <div className="flex items-center gap-2 flex-wrap">
          {/* Python Server Status Indicator Badge */}
          {/* <div
            onClick={handleCheckHealth}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-sm ${serverHealth.status === 'ok'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : isStreamConnecting
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
              }`}
            title="Click to test Python AI Server health (GET /health)"
          >
            <div className={`w-2 h-2 rounded-full ${serverHealth.status === 'ok' ? 'bg-emerald-400 animate-pulse' : isStreamConnecting ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
              }`} />
            <span>{serverHealth.status === 'ok' ? 'AI SERVER ONLINE' : isStreamConnecting ? 'CONNECTING...' : 'AI OFFLINE'}</span>
            {serverHealth.status === 'ok' && isStreamConnected && (
              <span className="text-[10px] opacity-80 font-mono">({streamFps} FPS)</span>
            )}
          </div> */}

          {/* Refresh Button */}
          <button
            onClick={() => {
              checkHealth();
              toast.info("Refreshed", "Triple riding detection records updated");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
            title="Refresh records & AI status"
          >
            <RefreshCw size={14} /> Refresh
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg text-xs font-bold transition-all border border-emerald-500/30 shadow-sm shrink-0 cursor-pointer"
            title="Export CSV report"
          >
            <Download size={14} /> Export
          </button>
        </div >
      }
      videoComponent={upperSection}
      rightPanelComponent={null}
      bottomMetricsComponent={null}
      bottomTableComponent={
        <>
          <PaginatedTable
            title="TRIPLE RIDING DETECTIONS "
            columns={tableColumns}
            data={filteredViolations}
            itemsPerPage={10}
            headerContent={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-56">
                  <SearchBar
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search plate, bike, location, snapshot ID..."
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1 h-8 text-xs border rounded-lg outline-none cursor-pointer font-medium"
                  style={{ backgroundColor: cardBg, borderColor, color: textPrimary }}
                >
                  <option value="All">All Records</option>
                  <option value="RECORDED">Recorded</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="FLAGGED">Flagged</option>
                </select>

                <select
                  value={helmetFilter}
                  onChange={(e) => setHelmetFilter(e.target.value)}
                  className="px-2.5 py-1 h-8 text-xs border rounded-lg outline-none cursor-pointer font-medium"
                  style={{ backgroundColor: cardBg, borderColor, color: textPrimary }}
                >
                  <option value="All">All Helmets</option>
                  <option value="No Helmets">No Helmets</option>
                  <option value="Driver Only">Driver Only</option>
                </select>

                <div className="h-8">
                  <DateRangePicker
                    fromDate={fromDate}
                    toDate={toDate}
                    onFromChange={setFromDate}
                    onToChange={setToDate}
                  />
                </div>
              </div>
            }
          />

          {/* Forensic Evidence Modal */}
          <RightSideDialog
            visible={isModalOpen}
            onHide={() => setIsModalOpen(false)}
            header="Triple Riding Incident Snapshot & Record"
          >
            {selectedRecord && (
              <div className="flex flex-col gap-4 text-xs font-sans p-1">
                {/* Evidence Image Card */}
                <div className="relative w-full h-56 rounded-xl overflow-hidden bg-black border flex items-center justify-center shadow-inner" style={{ borderColor }}>
                  {selectedRecord.evidenceImage ? (
                    <img
                      src={selectedRecord.evidenceImage}
                      alt="Triple Seat Violation Snapshot"
                      className="w-full h-full object-contain bg-black select-none"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40"></div>
                      <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                        <Bike size={48} className="text-cyan-400 animate-pulse" />
                        <span className="font-mono text-sm font-bold text-white tracking-wider">{selectedRecord.regNumber}</span>
                        <span className="text-[11px] text-red-400 font-bold bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
                          {selectedRecord.riderCount} Occupants on Two-Wheeler
                        </span>
                      </div>
                    </>
                  )}

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white/90 bg-black/70 px-2 py-1 rounded backdrop-blur-sm border border-white/10">
                    <span className="truncate">{selectedRecord.location}</span>
                    <span className="font-mono shrink-0">{selectedRecord.timestamp}</span>
                  </div>
                </div>

                {/* Violation Details Grid */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border shadow-sm" style={{ backgroundColor: cardBg, borderColor }}>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Snapshot ID</span>
                    <p className="font-bold text-xs text-blue-500 font-mono mt-0.5">{selectedRecord.snapshotId || selectedRecord.id}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Record Status</span>
                    <p className="font-extrabold text-xs text-emerald-400 uppercase mt-0.5">{selectedRecord.recordStatus || 'RECORDED'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Vehicle Model</span>
                    <p className="font-bold text-xs mt-0.5">{selectedRecord.vehicleType}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Recorded Speed</span>
                    <p className="font-bold text-xs mt-0.5 font-mono">{selectedRecord.speed}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">AI Confidence</span>
                    <p className="font-bold text-xs text-emerald-400 mt-0.5 font-mono">{selectedRecord.confidence || '98.4%'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Occupant Status</span>
                    <p className="font-bold text-xs text-amber-400 mt-0.5">{selectedRecord.riderCount} Riders Detected</p>
                  </div>
                  <div className="col-span-2 pt-1 border-t" style={{ borderColor }}>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Camera Source</span>
                    <p className="font-bold text-xs mt-0.5 text-gray-300">{selectedRecord.camera} • {selectedRecord.location}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setViolations(prev => prev.map(v => v.id === selectedRecord.id ? { ...v, recordStatus: 'VERIFIED' } : v));
                      setSelectedRecord(prev => ({ ...prev, recordStatus: 'VERIFIED' }));
                      toast.success('Record Verified', `Snapshot record for ${selectedRecord.regNumber} marked as verified.`);
                    }}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck size={14} /> Mark as Verified
                  </button>
                  <button
                    onClick={() => handleDownloadSnapshot(selectedRecord)}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Download snapshot evidence image"
                  >
                    <Download size={14} /> Snapshot
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border text-xs font-bold hover:bg-white/5 transition-all cursor-pointer"
                    style={{ borderColor }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </RightSideDialog>

          {/* Node Camera Settings Drawer */}
          <CameraSettingsDrawer
            visible={isSettingsDrawerOpen}
            onHide={() => setIsSettingsDrawerOpen(false)}
            camera={selectedCamera}
          />

          {/* Dedicated Python AI Server & Camera Settings Drawer */}
          <RightSideDialog
            visible={isServerSettingsOpen}
            onHide={() => setIsServerSettingsOpen(false)}
            header="Python Triple Seat AI Server Settings"
          >
            <div className="flex flex-col gap-4 text-xs font-sans p-1">
              {/* Server Telemetry Status Card */}
              <div
                className="p-4 rounded-xl border flex flex-col gap-3 shadow-sm"
                style={{ backgroundColor: cardBg, borderColor }}
              >
                <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor }}>
                  <div className="flex items-center gap-2">
                    <Server size={18} className="text-cyan-400" />
                    <div>
                      <h4 className="font-bold text-xs" style={{ color: textPrimary }}>Python AI Backend</h4>
                      <p className="text-[10px] text-gray-400">YOLO Triple Seat Service (Port 8091)</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${serverHealth.status === 'ok'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : isCheckingHealth
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}
                  >
                    {isCheckingHealth ? 'Checking...' : serverHealth.status === 'ok' ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-[10px] text-gray-400 font-medium">Model Loaded</span>
                    <p className="font-bold font-mono mt-0.5 text-cyan-400">
                      {serverHealth.model_loaded ? 'yolo11m.pt (Loaded)' : 'Not Loaded'}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-[10px] text-gray-400 font-medium">Active Streams</span>
                    <p className="font-bold font-mono mt-0.5" style={{ color: textPrimary }}>
                      {serverHealth.active_recognizers} Streams
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-[10px] text-gray-400 font-medium">Server Latency</span>
                    <p className="font-bold font-mono mt-0.5 text-emerald-400">
                      {serverHealth.latency !== null ? `${serverHealth.latency} ms` : '—'}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-[10px] text-gray-400 font-medium">Live Stream FPS</span>
                    <p className="font-bold font-mono mt-0.5 text-blue-400">
                      {isStreamConnected ? `${streamFps} FPS` : '0 FPS'}
                    </p>
                  </div>
                </div>

                {serverHealth.error && (
                  <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-[10px]">
                    <span className="font-bold">Error:</span> {serverHealth.error}
                  </div>
                )}

                {/* Test Health & Reload Weights Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleCheckHealth}
                    disabled={isCheckingHealth}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Server size={13} className={isCheckingHealth ? "animate-spin" : ""} />
                    <span>Check Health</span>
                  </button>
                  <button
                    onClick={handleReloadWeights}
                    disabled={isReloadingWeights}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isReloadingWeights ? "animate-spin" : ""} />
                    <span>Reload Weights</span>
                  </button>
                </div>
              </div>

              {/* Endpoint Configuration Card */}
              <div
                className="p-4 rounded-xl border flex flex-col gap-3 shadow-sm"
                style={{ backgroundColor: cardBg, borderColor }}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs" style={{ color: textPrimary }}>Connection & RTSP Config</h4>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const localApi = "http://localhost:8091";
                        const localWs = "ws://localhost:8091";
                        setCustomApiInput(localApi);
                        setCustomWsInput(localWs);
                        toast.info("Host Updated", "Set to localhost:8091");
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-gray-300 cursor-pointer"
                    >
                      Localhost
                    </button>
                    <button
                      onClick={() => {
                        const prodApi = "http://110.227.253.23:8091";
                        const prodWs = "ws://110.227.253.23:8091";
                        setCustomApiInput(prodApi);
                        setCustomWsInput(prodWs);
                        toast.info("Host Updated", "Set to production:8091");
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-gray-300 cursor-pointer"
                    >
                      Production
                    </button>
                  </div>
                </div>

                {/* RTSP Stream URL */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                    Camera RTSP Stream URL
                  </label>
                  <input
                    type="text"
                    value={customRtspInput}
                    onChange={(e) => setCustomRtspInput(e.target.value)}
                    placeholder="rtsp://admin:pass@192.168.1.10:554/stream1"
                    className="w-full px-3 py-2 text-xs border rounded-lg font-mono outline-none"
                    style={{
                      borderColor,
                      backgroundColor: themeUtils.getBgColor('input'),
                      color: textPrimary
                    }}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Passed as <code className="font-mono text-cyan-400">?rtsp_url=...</code> (auto URL-encoded by the frontend).
                  </p>
                </div>

                {/* Python HTTP API URL */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                    Python API Base URL (HTTP)
                  </label>
                  <input
                    type="text"
                    value={customApiInput}
                    onChange={(e) => setCustomApiInput(e.target.value)}
                    placeholder="http://110.227.253.23:8091"
                    className="w-full px-3 py-2 text-xs border rounded-lg font-mono outline-none"
                    style={{
                      borderColor,
                      backgroundColor: themeUtils.getBgColor('input'),
                      color: textPrimary
                    }}
                  />
                </div>

                {/* Python WebSocket URL */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                    Python WebSocket Base URL (WS)
                  </label>
                  <input
                    type="text"
                    value={customWsInput}
                    onChange={(e) => setCustomWsInput(e.target.value)}
                    placeholder="ws://110.227.253.23:8091"
                    className="w-full px-3 py-2 text-xs border rounded-lg font-mono outline-none"
                    style={{
                      borderColor,
                      backgroundColor: themeUtils.getBgColor('input'),
                      color: textPrimary
                    }}
                  />
                </div>

                {/* Save & Reconnect Action */}
                <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor }}>
                  <button
                    onClick={() => {
                      setStreamRtspUrl(customRtspInput);
                      setPythonApiUrl(customApiInput);
                      setPythonWsUrl(customWsInput);
                      reconnectStream(customRtspInput);
                      toast.success("Settings Saved", "Python server settings applied and stream reconnected.");
                      setIsServerSettingsOpen(false);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle size={13} /> Save & Reconnect
                  </button>
                </div>
              </div>
            </div>
          </RightSideDialog>
        </>
      }
    />
  );
}
