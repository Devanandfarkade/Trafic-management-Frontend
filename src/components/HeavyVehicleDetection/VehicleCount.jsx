import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Eye, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { useTheme } from '../../ui/Settings/themeUtils';
import ModuleLayout from '../../ui/layout/ModuleLayout';
import useVehicleCounter from '../../hooks/useVehicleCounter';
import CountVideoFeed from './CountVideoFeed';
import CountRightPanel from './CountRightPanel';
import CountTopMetrics from './CountTopMetrics';
import PaginatedTable from '../../ui/common/PaginatedTable';
import RightSideDialog from '../../ui/common/RightSideDialog';
import SearchBar from '../../ui/common/SearchBar';
import useCameraFilter from '../../hooks/useCameraFilter';
import { API_BASE_URL, API_CONFIG } from '../../../config.js';
import LiveCameraCard from '../LiveMonitoring/LiveCameraCard';
import Pagination from '../../ui/common/Pagination';
import RecordsPerPage from '../../ui/common/RecordsPerPage';
import DateRangePicker from '../../ui/common/DateRangePicker';
import { resolveCameraDetails } from '../../utils/cameraUtils';
import { getTodayStr, toLocalDateStr } from '../../utils/dateUtils';
import { useToast } from '../../ui/common/CustomToast';

// Exact RGB Color definitions requested by user
export const CLASS_COLORS = {
  cement_mixer: "#0000FF",     // Blue - Port 9010
  excavator: "#FF69B4",        // Hot Pink - Port 9011
  roller_compactor: "#00FF00", // Green - Port 9012
  tower_crane: "#800080",      // Purple - Port 9013
  dump_truck: "#FFFF00",       // Yellow - Port 9014
  // Compatibility aliases
  crane_truck: "#800080",
  dumper_truck: "#FFFF00",
  tpper_truck: "#FFA500"
};

export const HEAVY_VEHICLE_FILTER_OPTIONS = [
  "CEMENT MIXER",
  "EXCAVATOR",
  "ROLLER COMPACTOR",
  "TOWER CRANE",
  "DUMP TRUCK"
];

export default function VehicleCount() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();

  const [refreshKey, setRefreshKey] = useState(0);

  // Camera Filter for Heavy Vehicle
  const cameraFilter = useCameraFilter('heavy_vehicle');
  const { selectedCamera: currentCamObj, allCameras: cameras } = cameraFilter;
  const currentCam = currentCamObj || (cameras.length > 0 ? cameras[0] : null) || {
    url: import.meta.env.VITE_RTSP_HEAVY_VEHICLE_CAM || 'rtsp://admin:Admin%40123@192.168.1.55:8554/live'
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

  const [typeFilter, setTypeFilter] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dbLogs, setDbLogs] = useState([]);
  const [todayStats, setTodayStats] = useState({
    total: 0,
    cement_mixer: 0,
    excavator: 0,
    roller_compactor: 0,
    tower_crane: 0,
    dump_truck: 0,
  });

  // Fetch today's stats and detections from database
  const fetchDbDetections = React.useCallback(() => {
    if (!API_BASE_URL) return;

    let statsUrl = `${API_BASE_URL}/api/heavy-vehicle/stats?dummy=1`;
    if (cameraFilter?.filters?.zone && cameraFilter.filters.zone !== 'all') statsUrl += `&zone_id=${cameraFilter.filters.zone}`;
    if (cameraFilter?.filters?.location && cameraFilter.filters.location !== 'all') statsUrl += `&location_id=${cameraFilter.filters.location}`;
    if (cameraFilter?.filters?.cameraId && cameraFilter.filters.cameraId !== 'all') statsUrl += `&camera_id=${cameraFilter.filters.cameraId}`;

    fetch(statsUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.counts) {
          setTodayStats(data.counts);
        }
      })
      .catch((err) => console.error("Error fetching heavy vehicle today stats:", err));

    let logsUrl = `${API_BASE_URL}/api/heavy-vehicle?limit=100`;
    if (cameraFilter?.filters?.zone && cameraFilter.filters.zone !== 'all') logsUrl += `&zone_id=${cameraFilter.filters.zone}`;
    if (cameraFilter?.filters?.location && cameraFilter.filters.location !== 'all') logsUrl += `&location_id=${cameraFilter.filters.location}`;
    if (cameraFilter?.filters?.cameraId && cameraFilter.filters.cameraId !== 'all') logsUrl += `&camera_id=${cameraFilter.filters.cameraId}`;

    fetch(logsUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.detections) {
          const logs = data.detections.map((d) => {
            const imgPath = d.image_path;
            let fullUrl = null;
            if (imgPath) {
              fullUrl = (imgPath.startsWith('http') || imgPath.startsWith('data:'))
                ? imgPath
                : `${API_BASE_URL}/${imgPath}`;
            }
            const dt = d.detected_at ? new Date(d.detected_at) : new Date();
            return {
              id: `HV-${d.id}`,
              type: (d.vehicle_type || 'UNKNOWN').toUpperCase().replace(/_/g, ' '),
              dir: d.status || 'DETECTED',
              time: dt.toLocaleTimeString(),
              date: dt.toLocaleDateString(),
              status: d.status || 'DETECTED',
              frame: fullUrl,
              raw: d,
            };
          });
          setDbLogs(logs);
        }
      })
      .catch((err) => console.error("Error fetching heavy vehicle detections:", err));
  }, [refreshKey, cameraFilter?.filters?.zone, cameraFilter?.filters?.location, cameraFilter?.filters?.cameraId]);

  useEffect(() => {
    fetchDbDetections();
    const interval = setInterval(fetchDbDetections, 3000);
    return () => clearInterval(interval);
  }, [fetchDbDetections, refreshKey]);

  const selectedVehicleKey = useMemo(() => {
    if (!typeFilter) return null;
    const norm = typeFilter.toLowerCase().replace(/ /g, "_");
    if (norm === "tower_crane" || norm === "crane_truck") return "tower_crane";
    if (norm === "dump_truck" || norm === "dumper_truck" || norm === "tpper_truck") return "dump_truck";
    return Object.keys(CLASS_COLORS).find(k => k === norm) || null;
  }, [typeFilter]);

  const {
    isConnected,
    isLoading,
    frame,
    counts,
    error,
    connect,
    disconnect,
  } = useVehicleCounter(currentCam.url, undefined, undefined, selectedVehicleKey, currentCam.ws_url);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [currentCam.url, selectedVehicleKey, connect, disconnect]);

  const total = useMemo(() => {
    if (typeof counts.total_count === "number") return counts.total_count;
    return Object.entries(counts).reduce((acc, [k, v]) => {
      return typeof v === "number" && !k.endsWith("_in") && !k.endsWith("_out") ? acc + v : acc;
    }, 0);
  }, [counts]);

  const [liveLogs, setLiveLogs] = useState([]);
  const prevCountsRef = useRef(counts);

  useEffect(() => {
    const prev = prevCountsRef.current;
    const newLogs = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const dateStr = now.toLocaleDateString();

    const classNames = counts.class_names || ["cement_mixer", "excavator", "roller_compactor", "tower_crane", "dump_truck"];
    classNames.forEach((cls) => {
      const currentVal = counts[cls] || 0;
      const prevVal = prev[cls] || 0;
      if (currentVal > prevVal) {
        const recordId = `${cls.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        newLogs.push({
          id: recordId,
          type: cls.toUpperCase().replace("_", " "),
          dir: "DETECTED",
          time: timeStr,
          date: dateStr,
          status: "ACTIVE",
          frame: frame,
        });

        if (API_BASE_URL) {
          const payload = {
            camera: currentCam.value || currentCam.label || 'heavy_vehicle_cam',
            vehicle_type: cls.toLowerCase(),
            confidence: 0.90,
            image_base64: frame || null,
            detected_at: now.toISOString(),
          };

          fetch(`${API_BASE_URL}/api/heavy-vehicle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
            .then((res) => res.json())
            .then((d) => {
              console.log(`✅ Saved heavy vehicle detection (${cls}) to DB:`, d);
              fetchDbDetections();
            })
            .catch((err) => console.error(`❌ Failed to save heavy vehicle detection (${cls}):`, err));
        }
      }
    });

    if (newLogs.length > 0) {
      setLiveLogs(current => [...newLogs, ...current].slice(0, 100));
    }

    prevCountsRef.current = counts;
  }, [counts, frame, currentCam, fetchDbDetections, refreshKey]);

  const combinedLogs = useMemo(() => {
    const liveKeys = new Set(liveLogs.map(l => `${l.type}-${l.time}`));
    const filteredDb = dbLogs.filter(d => !liveKeys.has(`${d.type}-${d.time}`));
    return [...liveLogs, ...filteredDb];
  }, [liveLogs, dbLogs]);

  const filteredLiveLogs = useMemo(() => {
    return combinedLogs.filter(log => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        String(log.id || '').toLowerCase().includes(q) ||
        String(log.type || '').toLowerCase().includes(q) ||
        String(log.dir || '').toLowerCase().includes(q) ||
        String(log.time || '').toLowerCase().includes(q) ||
        String(log.date || '').toLowerCase().includes(q);

      let matchesDate = true;
      const itemDate = toLocalDateStr(log.raw?.detected_at || log.date);

      if (fromDate && itemDate && itemDate < fromDate) matchesDate = false;
      if (toDate && itemDate && itemDate > toDate) matchesDate = false;

      const matchesType = !typeFilter || (() => {
        if (!log.type) return false;
        const logType = String(log.type).toLowerCase().replace(/_/g, " ").trim();
        const filter = typeFilter.toLowerCase().replace(/_/g, " ").trim();

        if (filter === "tower crane") {
          return logType.includes("tower crane") || logType.includes("crane");
        }
        if (filter === "dump truck") {
          return logType.includes("dump") || logType.includes("tipper") || logType.includes("tpper");
        }
        if (filter === "roller compactor") {
          return logType.includes("roller") || logType.includes("compactor");
        }
        if (filter === "cement mixer") {
          return logType.includes("cement") || logType.includes("mixer");
        }
        if (filter === "excavator") {
          return logType.includes("excavator");
        }

        return logType === filter;
      })();

      return matchesSearch && matchesDate && matchesType;
    }).map((log, index) => ({
      ...log,
      srNo: index + 1,
      ...resolveCameraDetails(log, cameraFilter?.availableOptions?.cameras, currentCamObj)
    }));
  }, [combinedLogs, searchQuery, fromDate, toDate, typeFilter, cameraFilter, currentCamObj]);

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const tableColumns = [
    { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
    {
      header: "DETECTION IMAGE", accessor: "frame", render: (row) => (
        row.frame ? (
          <img
            src={row.frame.startsWith("http") || row.frame.startsWith("data:") ? row.frame : `data:image/jpeg;base64,${row.frame}`}
            alt="Detection Snapshot"
            className="w-14 h-9 object-cover rounded-lg border shadow-sm"
          />
        ) : (
          <div className="w-14 h-9 bg-slate-800 rounded-lg flex items-center justify-center text-[9px] text-gray-400 border">No Image</div>
        )
      )
    },
    {
      header: "VEHICLE TYPE", accessor: "type", render: (row) => (
        <span className="font-semibold text-xs text-white">
          {row.type}
        </span>
      )
    },
    {
      header: "STATUS / DIRECTION", accessor: "dir", render: (row) => (
        <span className={`px-2 py-1 rounded text-[10px] font-bold ${row.dir === 'ENTRY' || row.dir === 'DETECTED' ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}>
          {row.dir}
        </span>
      )
    },
    { header: "ZONE", accessor: "zone", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.zone || 'Unknown'}</span> },
    { header: "LOCATION", accessor: "location", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.location || 'Unknown'}</span> },
    { header: "CAMERA", accessor: "camera", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.camera || 'Unknown'}</span> },
    { header: "DATE", accessor: "date", render: (row) => <span className="font-medium text-xs opacity-90">{row.date || new Date().toLocaleDateString()}</span> },
    { header: "TIME", accessor: "time" },
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

  const heavyVehicleStats = useMemo(() => {
    const s = todayStats || {};
    const c = counts || {};
    const cement = s.cement_mixer !== undefined ? s.cement_mixer : (c.cement_mixer || 0);
    const excavator = s.excavator !== undefined ? s.excavator : (c.excavator || 0);
    const roller = s.roller_compactor !== undefined ? s.roller_compactor : (c.roller_compactor || 0);
    const crane = s.tower_crane !== undefined ? s.tower_crane : (s.crane_truck !== undefined ? s.crane_truck : (c.tower_crane || c.crane_truck || 0));
    const dump = s.dump_truck !== undefined ? s.dump_truck : (s.dumper_truck !== undefined ? s.dumper_truck : (s.tpper_truck !== undefined ? s.tpper_truck : (c.dump_truck || c.dumper_truck || c.tpper_truck || 0)));
    const totalDetected = s.total !== undefined ? s.total : (total || (cement + excavator + roller + crane + dump));

    return [
      { title: "TOTAL DETECTED", count: totalDetected, color: "#3b82f6" },
      { title: "CEMENT MIXER", count: cement, color: CLASS_COLORS.cement_mixer, port: API_CONFIG.HEAVY_VEHICLE_SERVICES?.cement_mixer?.port || 9010 },
      { title: "EXCAVATOR", count: excavator, color: CLASS_COLORS.excavator, port: API_CONFIG.HEAVY_VEHICLE_SERVICES?.excavator?.port || 9011 },
      { title: "ROLLER COMPACTOR", count: roller, color: CLASS_COLORS.roller_compactor, port: API_CONFIG.HEAVY_VEHICLE_SERVICES?.roller_compactor?.port || 9012 },
      { title: "TOWER CRANE", count: crane, color: CLASS_COLORS.tower_crane, port: API_CONFIG.HEAVY_VEHICLE_SERVICES?.tower_crane?.port || 9013 },
      { title: "DUMP TRUCK", count: dump, color: CLASS_COLORS.dump_truck, port: API_CONFIG.HEAVY_VEHICLE_SERVICES?.dump_truck?.port || 9014 },
    ];
  }, [todayStats, counts, total]);

  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  const camerasList = cameraFilter.availableOptions.cameras;

  const paginatedCameras = useMemo(() => {
    if (itemsPerPage === null || itemsPerPage === Infinity) return camerasList;
    const start = (currentPage - 1) * itemsPerPage;
    return camerasList.slice(start, start + itemsPerPage);
  }, [camerasList, currentPage, itemsPerPage]);

  const cameraGridComponent = (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl border w-full"
      style={{ backgroundColor: themeUtils.getBgColor("card"), borderColor: themeUtils.getBorderColor() }}
    >
      <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-3" style={{ borderColor: themeUtils.getBorderColor() }}>
        <div className="flex items-center gap-2">
          <CameraIcon size={18} className="text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: themeUtils.getTextColor(true) }}>
            Heavy Vehicle Live Feeds ({camerasList.length} Cameras)
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
            No cameras mapped for Heavy Vehicle Detection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginatedCameras.map((cam) => (
            <div key={cam.id || cam.value} className="h-48 sm:h-56 md:h-60 lg:h-64 xl:h-72 2xl:h-80 rounded-lg overflow-hidden border" style={{ borderColor: themeUtils.getBorderColor() }}>
              <LiveCameraCard camera={cam} />
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

  const cameraGridAndStatsCards = (
    <div className="flex flex-col gap-3 w-full">
      {cameraGridComponent}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {heavyVehicleStats.map((stat, i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl border flex flex-col justify-between shadow-sm transition-all hover:shadow-md"
            style={{ backgroundColor: themeUtils.getBgColor("card"), borderColor: themeUtils.getBorderColor() }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-75" style={{ color: themeUtils.getTextColor(false) }}>
                {stat.title}
              </span>
              {stat.port && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  :{stat.port}
                </span>
              )}
            </div>
            <div className="my-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black" style={{ color: stat.color }}>{stat.count}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 opacity-80">
                Today
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <ModuleLayout
      title="Heavy Vehicle Detection"
      subtitle="Real-time multi-class construction vehicle & heavy truck tracking"
      hideLiveSystem={true}
      hideCameraInHeader={false}
      videoComponent={cameraGridAndStatsCards}
      bottomTableComponent={
        <>
          <PaginatedTable
            title="LATEST DETECTED VEHICLES"
            columns={tableColumns}
            data={filteredLiveLogs}
            itemsPerPage={10}
            headerContent={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-48">
                  <SearchBar
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, type..."
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-2 py-1 h-8 text-xs border rounded outline-none cursor-pointer"
                  style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('input'), color: themeUtils.getTextColor(true) }}
                >
                  <option value="">All Types</option>
                  {HEAVY_VEHICLE_FILTER_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <DateRangePicker
                  fromDate={fromDate}
                  toDate={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                />

                {(searchQuery || fromDate || toDate || typeFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFromDate("");
                      setToDate("");
                      setTypeFilter("");
                    }}
                    className="px-2 py-1 h-8 text-xs font-semibold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            }
          />
          <RightSideDialog
            visible={isModalOpen}
            onHide={() => setIsModalOpen(false)}
            header="Detection Record Details"
          >
            {selectedRecord && (
              <div className="flex flex-col gap-4 pt-4">
                {selectedRecord.frame && (
                  <div className="w-full rounded-xl overflow-hidden border bg-black flex items-center justify-center p-1 shadow-md">
                    <img
                      src={selectedRecord.frame.startsWith("http") || selectedRecord.frame.startsWith("data:") ? selectedRecord.frame : `data:image/jpeg;base64,${selectedRecord.frame}`}
                      alt="Detection Details"
                      className="w-full max-h-64 object-contain rounded-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">

                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Detection Type</p>
                    <p className="font-semibold text-lg" style={{ color: CLASS_COLORS[selectedRecord.type.toLowerCase().replace(/ /g, "_")] || "#f59e0b" }}>
                      {selectedRecord.type}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Status / Direction</p>
                    <p className="font-semibold text-sm text-green-500">{selectedRecord.dir}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Zone</p>
                    <p className="font-semibold text-sm">{selectedRecord.zone || 'Unknown'}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Location</p>
                    <p className="font-semibold text-sm">{selectedRecord.location || 'Unknown'}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Camera</p>
                    <p className="font-semibold text-sm">{selectedRecord.camera || 'Unknown'}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Detection Date</p>
                    <p className="font-semibold text-sm">
                      {selectedRecord.date || new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Detection Time</p>
                    <p className="font-semibold text-sm">
                      {selectedRecord.time || "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </RightSideDialog>
        </>
      }
      cameraFilter={cameraFilter}
      extraFilterData={filteredLiveLogs}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshKey(prev => prev + 1);
              toast?.info?.("Refreshed", "Vehicle count data updated");
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => {
              import('../../utils/exportUtils').then(({ exportToCSV }) => {
                exportToCSV(filteredLiveLogs, 'heavy_vehicle_detection_export');
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
