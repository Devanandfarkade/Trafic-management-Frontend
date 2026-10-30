import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
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
  Car,
  Truck,
  Bike,
  CornerUpLeft,
  ArrowLeftRight,
  Printer,
  Compass,
  RefreshCw
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

// Initial Mock Detections for Wrong Side Driving (Contraflow traffic breaches)
const INITIAL_WRONG_SIDE_VIOLATIONS = [
  {
    id: 'WSD-8801',
    regNumber: 'MH 12 PK 3021',
    vehicleCategory: 'Car / Sedan',
    vehicleModel: 'Maruti Suzuki Dzire',
    directionVector: 'Southbound on Northbound Lane',
    laneBreached: 'Expressway Fast Lane (Lane 1)',
    severity: 'Critical',
    location: 'Baramati MIDC Highway Bypass',
    zone: 'North Zone',
    camera: 'CAM-01 (Highway PTZ)',
    cameraId: '1',
    timestamp: '2026-10-27 16:40:12',
    speed: '62 km/h',
    snapshotId: 'SNP-2026-90401',
    recordStatus: 'RECORDED',
    confidence: '98.8%',
    evidenceImage: null
  },
  {
    id: 'WSD-8802',
    regNumber: 'MH 14 GT 9912',
    vehicleCategory: 'Two-Wheeler',
    vehicleModel: 'Honda Activa 5G',
    directionVector: 'Contraflow on Flyover Entry',
    laneBreached: 'Flyover Exit Ramp',
    severity: 'High',
    location: 'City Hospital Flyover Ramp',
    zone: 'East Zone',
    camera: 'CAM-02 (Flyover Entry)',
    cameraId: '2',
    timestamp: '2026-10-27 16:28:45',
    speed: '34 km/h',
    snapshotId: 'SNP-2026-90402',
    recordStatus: 'VERIFIED',
    confidence: '99.2%',
    evidenceImage: null
  },
  {
    id: 'WSD-8803',
    regNumber: 'MH 42 AA 5510',
    vehicleCategory: 'Heavy Vehicle / Truck',
    vehicleModel: 'Tata 1613 Cargo Truck',
    directionVector: 'One-Way Breach (Opposite Flow)',
    laneBreached: 'One-Way Service Road',
    severity: 'Critical',
    location: 'Tiranga Circle Market Road',
    zone: 'North Zone',
    camera: 'CAM-03 (Tiranga North)',
    cameraId: '3',
    timestamp: '2026-10-27 16:05:33',
    speed: '28 km/h',
    snapshotId: 'SNP-2026-90403',
    recordStatus: 'FLAGGED',
    confidence: '97.5%',
    evidenceImage: null
  },
  {
    id: 'WSD-8804',
    regNumber: 'MH 12 CR 1102',
    vehicleCategory: 'Auto Rickshaw',
    vehicleModel: 'Bajaj Compact 4S',
    directionVector: 'Wrong Way on Divided Carriageway',
    laneBreached: 'Median Gap U-Turn Breach',
    severity: 'High',
    location: 'Bhigwan Chowk Underpass',
    zone: 'South Zone',
    camera: 'CAM-04 (Bhigwan Chowk)',
    cameraId: '4',
    timestamp: '2026-10-27 15:44:19',
    speed: '31 km/h',
    snapshotId: 'SNP-2026-90404',
    recordStatus: 'VERIFIED',
    confidence: '96.9%',
    evidenceImage: null
  },
  {
    id: 'WSD-8805',
    regNumber: 'MH 14 EB 7741',
    vehicleCategory: 'SUV / Compact SUV',
    vehicleModel: 'Hyundai Creta SX',
    directionVector: 'Contraflow on High Speed Corridor',
    laneBreached: 'Corridor Lane 2',
    severity: 'Critical',
    location: 'Court Road - Ring Approach',
    zone: 'Central Zone',
    camera: 'CAM-05 (Ring Rd)',
    cameraId: '5',
    timestamp: '2026-10-27 15:15:50',
    speed: '55 km/h',
    snapshotId: 'SNP-2026-90405',
    recordStatus: 'RECORDED',
    confidence: '99.4%',
    evidenceImage: null
  },
  {
    id: 'WSD-8806',
    regNumber: 'MH 12 KL 8890',
    vehicleCategory: 'Two-Wheeler',
    vehicleModel: 'Royal Enfield Bullet 350',
    directionVector: 'Opposite Flow on One-Way Lane',
    laneBreached: 'One-Way Downtown Lane',
    severity: 'High',
    location: 'Railway Station Road',
    zone: 'West Zone',
    camera: 'CAM-06 (Station Approach)',
    cameraId: '6',
    timestamp: '2026-10-27 14:32:10',
    speed: '40 km/h',
    snapshotId: 'SNP-2026-90406',
    recordStatus: 'RECORDED',
    confidence: '98.1%',
    evidenceImage: null
  }
];

export default function WrongSideDriving() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();
  const isDark = theme.mode === 'Dark';

  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor('card');
  const themeColor = theme.headerBg || '#3b82f6';

  // Camera Filter Hook - Fetch zones, locations, and cameras mapped to wrong side driving
  const cameraFilter = useCameraFilter('wrong_side_driving');
  const camerasList = cameraFilter?.availableOptions?.cameras || [];
  const selectedCamera = cameraFilter?.selectedCamera;

  // View Mode: 'focused' (Single Live AI Stream) or 'grid' (Multi-Camera Grid)
  const [viewMode, setViewMode] = useState('grid');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  // Violations State
  const [violations, setViolations] = useState(() => {
    try {
      const saved = localStorage.getItem('wrong_side_violations_db');
      return saved ? JSON.parse(saved) : INITIAL_WRONG_SIDE_VIOLATIONS;
    } catch {
      return INITIAL_WRONG_SIDE_VIOLATIONS;
    }
  });

  useEffect(() => {
    localStorage.setItem('wrong_side_violations_db', JSON.stringify(violations));
  }, [violations]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
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
          v.vehicleCategory?.toLowerCase().includes(q) ||
          v.vehicleModel?.toLowerCase().includes(q) ||
          v.location?.toLowerCase().includes(q) ||
          v.snapshotId?.toLowerCase().includes(q) ||
          v.id?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (categoryFilter !== 'All' && !v.vehicleCategory?.toLowerCase().includes(categoryFilter.toLowerCase())) return false;
      if (statusFilter !== 'All' && v.recordStatus !== statusFilter) return false;
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
  }, [violations, searchQuery, categoryFilter, statusFilter, severityFilter, fromDate, toDate, cameraFilter?.selectedCamera]);

  // Derived KPI Stats
  const totalViolations = violations.length;
  const todayCount = violations.filter(v => (v.timestamp || '').startsWith(new Date().toISOString().slice(0, 10))).length || 4;
  const twoWheelersCount = violations.filter(v => v.vehicleCategory?.toLowerCase().includes('two-wheeler')).length;
  const fourWheelersCount = violations.filter(v => v.vehicleCategory?.toLowerCase().includes('car') || v.vehicleCategory?.toLowerCase().includes('suv')).length;
  const heavyCount = violations.filter(v => v.vehicleCategory?.toLowerCase().includes('truck') || v.vehicleCategory?.toLowerCase().includes('heavy')).length;
  const snapshotsSaved = violations.length;

  // Stats Card Config (Text on one side, Number on other side)
  const statsList = [
    { title: "TOTAL DETECTED", count: totalViolations, color: "#2563eb" },
    { title: "WRONG WAY TODAY", count: todayCount, color: "#f97316" },
    { title: "TWO-WHEELERS", count: twoWheelersCount, color: "#ec4899" },
    { title: "CARS & SUVS", count: fourWheelersCount, color: "#06b6d4" },
    { title: "HEAVY TRUCKS", count: heavyCount, color: "#ef4444" },
    { title: "SNAPSHOTS SAVED", count: snapshotsSaved, color: "#a855f7" }
  ];

  // Real-time Simulation Trigger
  const simulateLiveViolation = () => {
    const randomPlates = ['MH 12 GF 4091', 'MH 14 AB 1234', 'MH 42 Q 8899', 'MH 12 ZZ 9900'];
    const categories = [
      { cat: 'Car / Hatchback', model: 'Maruti Suzuki Swift' },
      { cat: 'Two-Wheeler', model: 'Bajaj Pulsar 220' },
      { cat: 'Heavy Vehicle / Truck', model: 'Ashok Leyland Ecomet' }
    ];
    const picked = categories[Math.floor(Math.random() * categories.length)];
    const randomLocs = ['Highway Bypass', 'Hospital Flyover Entry', 'Bhigwan Chowk Underpass', 'Station Road'];
    const now = new Date();
    const timeStr = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`;

    const newViolation = {
      id: `WSD-${Math.floor(8800 + Math.random() * 1000)}`,
      regNumber: randomPlates[Math.floor(Math.random() * randomPlates.length)],
      vehicleCategory: picked.cat,
      vehicleModel: picked.model,
      directionVector: 'Direct Contraflow (Opposite Lane Breach)',
      laneBreached: 'Main Carriageway Lane 1',
      severity: 'Critical',
      location: randomLocs[Math.floor(Math.random() * randomLocs.length)],
      zone: 'North Zone',
      camera: selectedCamera?.label || 'CAM-01 (Highway PTZ)',
      cameraId: String(selectedCamera?.value || '1'),
      timestamp: timeStr,
      speed: `${Math.floor(40 + Math.random() * 30)} km/h`,
      snapshotId: `SNP-2026-${Math.floor(90000 + Math.random() * 999)}`,
      recordStatus: 'RECORDED',
      confidence: '99.1%',
      evidenceImage: null
    };

    setViolations(prev => [newViolation, ...prev]);
    toast.info('Snapshot Saved', `Contraflow snapshot recorded for ${newViolation.regNumber} at ${newViolation.location}`);
  };

  const handleExportCSV = async () => {
    try {
      const { exportToCSV } = await import('../../utils/exportUtils');
      const exportData = filteredViolations.map(v => ({
        'Record ID': v.id,
        'Snapshot ID': v.snapshotId,
        'Vehicle Plate': v.regNumber,
        'Category': v.vehicleCategory,
        'Model': v.vehicleModel,
        'Direction': v.directionVector,
        'Lane': v.laneBreached,
        'Speed': v.speed,
        'Location': v.location,
        'Time': v.timestamp,
        'Confidence': v.confidence || '99%',
        'Record Status': v.recordStatus
      }));
      exportToCSV(exportData, `Wrong_Side_Driving_Snapshot_Records_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Report Exported', 'Wrong side driving snapshot records downloaded successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Export Error', 'Failed to export CSV file');
    }
  };

  // -------------------------------------------------------------
  // Focused Stream Component
  // -------------------------------------------------------------
  const focusedStreamComponent = (
    <>
      <div className="relative w-full h-full min-h-[280px] rounded-xl overflow-hidden bg-black/90 border shadow-md flex flex-col justify-between" style={{ borderColor }}>
        {/* Top Overlay Bar */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between z-20 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1.5 bg-red-600/90 text-white shadow-lg border border-red-400/40 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
              LIVE AI SURVEILLANCE
            </div>
            <div className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-black/60 text-amber-400 border border-amber-500/30 backdrop-blur-md flex items-center gap-1.5">
              <Radio size={12} className="animate-pulse" />
              CONTRAFLOW VECTOR SCAN
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className="px-2.5 py-1 rounded-md bg-black/60 hover:bg-black/80 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer"
              title="Switch to Camera Grid"
            >
              <Grid size={13} />
              <span className="hidden sm:inline">Camera Grid</span>
            </button>

            <button
              onClick={() => setIsSettingsDrawerOpen(true)}
              className="p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-blue-400 hover:text-blue-300 border border-blue-500/30 backdrop-blur-md transition-all cursor-pointer"
              title="Camera Settings"
            >
              <Settings size={15} className="hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Video HUD Area */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#120808] via-[#1a0e0e] to-[#0a0505] flex items-center justify-center">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ef44440a_1px,transparent_1px),linear-gradient(to_bottom,#ef44440a_1px,transparent_1px)] bg-[size:24px_24px]"></div>

            <div className="absolute inset-8 border border-red-500/10 pointer-events-none rounded-lg">
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-red-500"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-red-500"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-red-500"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-red-500"></div>
            </div>
          </div>

          {/* AI Detection Reticle for Contraflow / Wrong Way Vehicle */}
          <div className="relative z-10 flex flex-col items-center animate-pulse">
            <div className="w-56 h-44 sm:w-64 sm:h-48 rounded-xl border-2 border-red-600 shadow-[0_0_35px_rgba(239,68,68,0.5)] bg-red-950/30 backdrop-blur-[1px] relative flex flex-col justify-between p-2">
              <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-red-600"></div>
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-red-600"></div>
              <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-red-600"></div>
              <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-red-600"></div>

              <div className="flex items-center justify-between w-full">
                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-extrabold tracking-wider shadow flex items-center gap-1">
                  <CornerUpLeft size={11} className="rotate-90" /> WRONG WAY (99.1%)
                </span>
                <span className="text-[9px] font-mono font-bold text-amber-300 bg-black/70 px-1.5 py-0.5 rounded border border-amber-400/30">
                  62 KM/H
                </span>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center opacity-90 my-1">
                <div className="flex items-center gap-2 text-red-500">
                  <Car className="w-9 h-9" />
                  <ArrowLeftRight className="w-6 h-6 animate-pulse text-amber-400" />
                </div>
                <span className="text-xs font-black text-white tracking-widest mt-1 bg-black/80 px-2.5 py-0.5 rounded font-mono border border-white/20">
                  MH 12 PK 3021
                </span>
              </div>

              <div className="flex items-center justify-between text-[9px] font-bold text-red-300">
                <span>CONTRAFLOW LANE 1</span>
                <span className="text-amber-400">IMMEDIATE ACTION</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar Info on Video */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 border border-white/10 text-white text-xs backdrop-blur-md">
            <MapPin size={13} className="text-red-400" />
            <span className="font-semibold">{selectedCamera?.location || "Baramati MIDC Highway Bypass"}</span>
            <span className="opacity-40">|</span>
            <span className="text-gray-300 text-[11px] font-mono">{selectedCamera?.label || "CAM-01 (Highway PTZ)"}</span>
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
                  LIVE CONTRAFLOW SURVEILLANCE
                </div>
                <span className="text-sm font-semibold text-gray-200 hidden sm:inline">
                  {selectedCamera?.location || "Baramati MIDC Highway Bypass"} ({selectedCamera?.label || "CAM-01 (Highway PTZ)"})
                </span>
              </div>

              <button
                onClick={() => setIsMaximized(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
                title="Minimize (Esc)"
              >
                <Minimize size={16} />
                <span>Minimize</span>
              </button>
            </div>

            <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#120808] via-[#1a0e0e] to-[#0a0505] flex items-center justify-center">
                <div className="absolute inset-12 border border-red-500/10 pointer-events-none rounded-xl"></div>
              </div>

              <div className="relative z-10 flex flex-col items-center animate-pulse">
                <div className="w-68 h-56 rounded-2xl border-2 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.5)] bg-red-950/30 backdrop-blur-[2px] relative flex flex-col justify-between p-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-red-600 text-white text-xs font-extrabold flex items-center gap-1">
                      <CornerUpLeft size={13} className="rotate-90" /> DANGEROUS CONTRAFLOW
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-300">62 KM/H</span>
                  </div>
                  <div className="flex flex-col items-center justify-center my-2">
                    <div className="flex items-center gap-2 text-red-500">
                      <Car className="w-12 h-12" />
                      <ArrowLeftRight className="w-7 h-7 text-amber-400 animate-pulse" />
                    </div>
                    <span className="text-base font-black text-white tracking-widest mt-2 bg-black/80 px-3 py-1 rounded font-mono border border-white/30">
                      MH 12 PK 3021
                    </span>
                  </div>
                  <div className="text-xs text-red-300 font-semibold text-center">
                    Sec 184 MV Act • Opposite Lane Breach
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-auto">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-black/80 border border-white/10 text-white text-xs backdrop-blur-md">
                <MapPin size={14} className="text-red-400" />
                <span>{selectedCamera?.location || "Baramati MIDC Highway Bypass"}</span>
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

  // -------------------------------------------------------------
  // Camera Grid Component
  // -------------------------------------------------------------
  const cameraGridComponent = (
    <div className="flex flex-col gap-3 p-4 rounded-xl border w-full" style={{ backgroundColor: cardBg, borderColor }}>
      <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-3" style={{ borderColor }}>
        <div className="flex items-center gap-2">
          <CameraIcon size={18} className="text-red-500" />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: textPrimary }}>
            Wrong Side Driving Live Feeds ({camerasList.length} Cameras)
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
            No cameras mapped for Wrong Side Driving Detection.
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
            </div>
          ))}
        </div>
      )}

      {camerasList.length > gridItemsPerPage && (
        <div className="pt-2">
          <Pagination
            currentPage={gridCurrentPage}
            totalItems={camerasList.length}
            itemsPerPage={gridItemsPerPage}
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
        backgroundColor: isDark ? "#170808" : "#fff5f5",
        borderColor: isDark ? "#4d1414" : "#fecaca"
      }}
    >
      <div className="px-3 py-2 bg-gradient-to-r from-red-700 to-rose-700 text-white flex justify-between items-center shrink-0 shadow-sm">
        <h3 className="text-xs font-bold uppercase flex items-center gap-1.5 tracking-wide">
          <ShieldAlert size={14} className="text-amber-300" /> Active Wrong Way Threats
        </h3>
        <span className="text-[9px] font-bold px-2 py-0.5 bg-black/30 rounded-full animate-pulse uppercase border border-white/20">
          Live Matches
        </span>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col divide-y divide-red-500/10 p-1">
        {filteredViolations.slice(0, 5).map((v) => (
          <div
            key={v.id}
            onClick={() => { setSelectedRecord(v); setIsModalOpen(true); }}
            className="flex items-center gap-2.5 p-2 hover:bg-red-500/10 transition-all rounded-lg cursor-pointer group"
          >
            <div className="w-11 h-11 bg-black/50 rounded-lg flex-shrink-0 overflow-hidden relative border border-red-500/40 shadow-inner flex flex-col items-center justify-center group-hover:border-red-400 transition-colors">
              <CornerUpLeft className="w-5 h-5 text-red-400 rotate-90" />
              <div className="text-[7px] font-bold text-amber-300">{v.speed}</div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <p className="font-extrabold text-xs text-white truncate leading-tight group-hover:text-red-400 font-mono">
                  {v.regNumber}
                </p>
                <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase bg-blue-500/20 text-blue-400 border border-blue-500/40">
                  {v.recordStatus || 'RECORDED'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium truncate mb-0.5">
                {v.vehicleCategory} • <span className="text-amber-300">{v.vehicleModel}</span>
              </p>
              <div className="flex items-center justify-between text-[9px] text-gray-400">
                <span className="flex items-center gap-1 truncate">
                  <MapPin size={9} className="text-red-400" /> {v.location}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock size={9} /> {v.timestamp.slice(11, 16)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-1.5 bg-black/10 border-t border-red-500/20 flex items-center justify-between shrink-0">
        <span className="text-[9px] text-gray-400 font-medium">
          Showing top {Math.min(filteredViolations.length, 5)} alerts
        </span>
        <button
          onClick={simulateLiveViolation}
          className="text-[9px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors"
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

  // Upper section combining Live Multi-Camera Grid + Stats Cards
  const upperSection = (
    <div className="flex flex-col gap-3 w-full">
      {cameraGridComponent}
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
      header: "DIRECTION BREACH",
      accessor: "directionVector",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white flex items-center gap-1">
            {/* <CornerUpLeft size={12} className="rotate-90 text-white" /> */}
            {row.directionVector}
          </span>
          {/* <span className="text-[10px] text-gray-400">{row.laneBreached}</span> */}
        </div>
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
          title="View Incident Snapshot & Record"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  return (
    <ModuleLayout
      title="Wrong Side Driving Detection"
      hideLiveSystem={true}
      hideCameraInHeader={false}
      cameraFilter={cameraFilter}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              toast.info("Refreshed", "Wrong side driving detection records updated");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
            title="Refresh records"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg text-xs font-bold transition-all border border-emerald-500/30 shadow-sm shrink-0 cursor-pointer"
            title="Export CSV report"
          >
            <Download size={14} /> Export
          </button>
        </div>
      }
      videoComponent={upperSection}
      rightPanelComponent={null}
      bottomMetricsComponent={null}
      bottomTableComponent={
        <>
          <PaginatedTable
            title="WRONG-WAY DRIVING DETECTION"
            columns={tableColumns}
            data={filteredViolations}
            itemsPerPage={10}
            headerContent={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-56">
                  <SearchBar
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search plate, model, location, snapshot ID..."
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1 h-8 text-xs border rounded-lg outline-none cursor-pointer font-medium"
                  style={{ backgroundColor: cardBg, borderColor, color: textPrimary }}
                >
                  <option value="All">All Vehicle Types</option>
                  <option value="Car">Cars & SUVs</option>
                  <option value="Two-Wheeler">Two-Wheelers</option>
                  <option value="Truck">Heavy Trucks</option>
                  <option value="Auto">Auto Rickshaws</option>
                </select>

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

                <div className="h-8">
                  <DateRangePicker
                    fromDate={fromDate}
                    toDate={toDate}
                    onFromChange={setFromDate}
                    onToChange={setToDate}
                  />
                </div>

                {/* <button
                  onClick={handleExportCSV}
                  className="px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer ml-auto"
                >
                  <Download size={13} /> Export CSV
                </button> */}
              </div>
            }
          />

          {/* Forensic Evidence Modal */}
          <RightSideDialog
            visible={isModalOpen}
            onHide={() => setIsModalOpen(false)}
            header="Wrong Side Driving Incident Snapshot & Record"
          >
            {selectedRecord && (
              <div className="flex flex-col gap-4 text-xs font-sans p-1">
                {/* Evidence Image Card */}
                <div className="relative w-full h-56 rounded-xl overflow-hidden bg-black border flex items-center justify-center" style={{ borderColor }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40"></div>
                  <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                    <Car size={48} className="text-red-500 animate-pulse" />
                    <span className="font-mono text-sm font-bold text-white tracking-wider">{selectedRecord.regNumber}</span>
                    <span className="text-[11px] text-red-400 font-bold bg-red-950/70 px-2.5 py-0.5 rounded border border-red-500/40 flex items-center gap-1">
                      <CornerUpLeft size={13} className="rotate-90" /> {selectedRecord.directionVector}
                    </span>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white/80 bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
                    <span>{selectedRecord.location}</span>
                    <span className="font-mono">{selectedRecord.timestamp}</span>
                  </div>
                </div>

                {/* Violation Details Grid */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
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
                    <p className="font-bold text-xs mt-0.5">{selectedRecord.vehicleModel}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Speed at Breach</span>
                    <p className="font-bold text-xs mt-0.5 font-mono text-amber-400">{selectedRecord.speed}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">AI Confidence</span>
                    <p className="font-bold text-xs text-emerald-400 mt-0.5 font-mono">{selectedRecord.confidence || '99.1%'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Breached Lane</span>
                    <p className="font-bold text-xs mt-0.5 text-gray-300">{selectedRecord.laneBreached}</p>
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
                    onClick={() => {
                      toast.info('Snapshot Saved', `Evidence snapshot saved for ${selectedRecord.regNumber}`);
                    }}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Download snapshot evidence"
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

          <CameraSettingsDrawer
            visible={isSettingsDrawerOpen}
            onHide={() => setIsSettingsDrawerOpen(false)}
            camera={selectedCamera}
          />
        </>
      }
    />
  );
}
