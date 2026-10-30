import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../ui/Settings/themeUtils';
import ModuleLayout from '../../ui/layout/ModuleLayout';
import useVehicleCounter from '../../hooks/useVehicleCounter';
import TrafficVideoFeed from './TrafficVideoFeed';
import TrafficRightPanel from './TrafficRightPanel';
import TrafficBottomMetrics from './TrafficBottomMetrics';
import PaginatedTable from '../../ui/common/PaginatedTable';
import RightSideDialog from '../../ui/common/RightSideDialog';
import SearchBar from '../../ui/common/SearchBar';
import { ArrowRight, ArrowLeft, Eye, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../../config.js';
import useCameraFilter from '../../hooks/useCameraFilter';
import LiveCameraCard from '../LiveMonitoring/LiveCameraCard';
import Pagination from '../../ui/common/Pagination';
import RecordsPerPage from '../../ui/common/RecordsPerPage';
import DateRangePicker from '../../ui/common/DateRangePicker';
import { resolveCameraDetails } from '../../utils/cameraUtils';
import { getTodayStr, toLocalDateStr } from '../../utils/dateUtils';
import { useToast } from '../../ui/common/CustomToast';

function getImageUrl(relativePath) {
  if (!relativePath) return null;
  const urlPath = relativePath.replace(/\\/g, '/');
  return `${API_BASE_URL}/${urlPath}`;
}

function formatLogDateTime(rawTime, rawEvent) {
  let dateStr = "";
  let timeStr = "";

  const candidate = rawEvent?.event_time || rawEvent?.timestamp || rawEvent?.created_at || rawTime || rawEvent?.time_str;

  if (candidate) {
    if (typeof candidate === 'number' || (typeof candidate === 'string' && /^\d{10,13}$/.test(candidate.trim()))) {
      const num = Number(candidate);
      const d = new Date(num > 1e11 ? num : num * 1000);
      if (!isNaN(d.getTime())) {
        dateStr = toLocalDateStr(d);
        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
    } else {
      const d = new Date(candidate);
      if (!isNaN(d.getTime())) {
        dateStr = toLocalDateStr(d);
        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
    }
  }

  // Fallback string extraction if date object parsing was not clean
  if (!dateStr || !timeStr) {
    const str = String(rawTime || candidate || '');
    if (!dateStr) {
      const matchDate = str.match(/\d{4}-\d{2}-\d{2}/) || str.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/);
      dateStr = matchDate ? matchDate[0] : getTodayStr();
    }
    if (!timeStr) {
      const matchTime = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (matchTime) {
        const hh = parseInt(matchTime[1], 10);
        const mm = matchTime[2].padStart(2, '0');
        const ss = (matchTime[3] || '00').padStart(2, '0');
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const h12 = hh % 12 || 12;
        timeStr = `${String(h12).padStart(2, '0')}:${mm}:${ss} ${ampm}`;
      } else {
        const now = new Date();
        timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
    }
  }

  return { date: dateStr, time: timeStr };
}

export default function TrafficBehavior() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();
  const [refreshKey, setRefreshKey] = useState(0);

  const cameraFilter = useCameraFilter('in_out');
  const { allCameras: cameras, selectedCamera: currentCamObj } = cameraFilter;
  const currentCam = currentCamObj || (cameras.length > 0 ? cameras[0] : null) || { value: '', label: '', url: '' };

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  const [directionFilter, setDirectionFilter] = useState("");

  const [dbEvents, setDbEvents] = useState([]);
  const [dbCounts, setDbCounts] = useState(null);

  const {
    isConnected,
    isLoading,
    frame,
    counts,
    events,
    error,
    connect,
    disconnect,
  } = useVehicleCounter(currentCam.url, undefined, undefined, null, currentCam.ws_url);

  // Track last persisted event count to avoid duplicate POSTs
  const lastPersistedCountRef = useRef(0);

  // Auto connect when camera changes or component mounts
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [currentCam.url, connect, disconnect]);

  // Fetch initial history logs & counts from database on mount
  const fetchDbData = React.useCallback(() => {
    if (!API_BASE_URL) return;

    let url = `${API_BASE_URL}/api/in-out/events?limit=100`;
    if (cameraFilter?.filters?.zone && cameraFilter.filters.zone !== 'all') url += `&zone_id=${cameraFilter.filters.zone}`;
    if (cameraFilter?.filters?.location && cameraFilter.filters.location !== 'all') url += `&location_id=${cameraFilter.filters.location}`;
    if (cameraFilter?.filters?.cameraId && cameraFilter.filters.cameraId !== 'all') url += `&camera_id=${cameraFilter.filters.cameraId}`;
    if (fromDate) url += `&from_date=${fromDate}`;
    if (toDate) url += `&to_date=${toDate}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.events) {
          const logs = data.events.map((e) => {
            const dt = formatLogDateTime(e.time_str || e.event_time, e);
            return {
              id: e.event_id || e.id || e.track_id,
              dir: e.direction,
              type: e.vehicle_display || e.vehicle_type,
              date: dt.date,
              time: dt.time,
              track_id: e.track_id,
              image_path: e.image_path,
              image_base64: null,
              raw: e
            };
          });
          setDbEvents(logs);
        }
      })
      .catch((err) => console.error("Error fetching in-out events:", err));

    let countsUrl = `${API_BASE_URL}/api/in-out/counts?dummy=1`;
    if (cameraFilter?.filters?.zone && cameraFilter.filters.zone !== 'all') countsUrl += `&zone_id=${cameraFilter.filters.zone}`;
    if (cameraFilter?.filters?.location && cameraFilter.filters.location !== 'all') countsUrl += `&location_id=${cameraFilter.filters.location}`;
    if (cameraFilter?.filters?.cameraId && cameraFilter.filters.cameraId !== 'all') countsUrl += `&camera_id=${cameraFilter.filters.cameraId}`;
    if (fromDate) countsUrl += `&from_date=${fromDate}`;
    if (toDate) countsUrl += `&to_date=${toDate}`;

    fetch(countsUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.counts) {
          setDbCounts(data.counts);
        }
      })
      .catch((err) => console.error("Error fetching in-out counts:", err));
  }, [refreshKey, cameraFilter?.filters?.zone, cameraFilter?.filters?.location, cameraFilter?.filters?.cameraId, fromDate, toDate]);

  useEffect(() => {
    fetchDbData();
    const interval = setInterval(fetchDbData, 3000);
    const handleRefresh = () => fetchDbData();
    window.addEventListener("app:refresh", handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("app:refresh", handleRefresh);
    };
  }, [fetchDbData, refreshKey]);

  useEffect(() => {
    if (!API_BASE_URL || events.length === 0) return;
    const newEvents = events.slice(0, events.length - lastPersistedCountRef.current);
    if (newEvents.length === 0) return;
    lastPersistedCountRef.current = events.length;

    const payload = newEvents.map((e) => ({
      event_id: e.event_id || null,
      stream_id: e.stream_id || currentCam.value,
      track_id: e.track_id != null ? String(e.track_id) : null,
      vehicle_type: e.vehicle_type || null,
      vehicle_display: e.vehicle_display || null,
      direction: e.direction || null,
      direction_arrow: e.direction_arrow || (e.direction === 'in' ? '⬇' : '⬆'),
      direction_text: e.direction_text || (e.direction === 'in' ? 'IN' : 'OUT'),
      camera: currentCam.value,
      image_base64: e.image_base64 || null,
      time_str: e.time_str || null,
      timestamp: e.timestamp || null,
      event_time: e.event_time || null,
    }));

    fetch(`${API_BASE_URL}/api/in-out/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(() => fetchDbData())
      .catch((err) => console.error('Failed to persist in-out events:', err));
  }, [events, currentCam.value, fetchDbData, refreshKey]);

  const activeCounts = (counts && (counts.car_in || counts.car_out || counts.bike_in || counts.bike_out || counts.bus_in || counts.bus_out || counts.auto_in || counts.auto_out || counts.rickshaw_in || counts.rickshaw_out || counts.other_in || counts.other_out)) ? counts : (dbCounts || counts || {});

  const carsIn = activeCounts.car_in || 0;
  const carsOut = activeCounts.car_out || 0;
  const bikesIn = activeCounts.bike_in || (activeCounts.motorcycle_in || 0);
  const bikesOut = activeCounts.bike_out || (activeCounts.motorcycle_out || 0);
  const heavyIn = (activeCounts.truck_in || 0) + (activeCounts.heavy_in || 0);
  const heavyOut = (activeCounts.truck_out || 0) + (activeCounts.heavy_out || 0);
  const busesIn = activeCounts.bus_in || 0;
  const busesOut = activeCounts.bus_out || 0;
  const autoIn = (activeCounts.auto_in || 0) + (activeCounts.rickshaw_in || 0);
  const autoOut = (activeCounts.auto_out || 0) + (activeCounts.rickshaw_out || 0);
  const otherIn = activeCounts.other_in || 0;
  const otherOut = activeCounts.other_out || 0;

  const totalIn = carsIn + bikesIn + heavyIn + busesIn + autoIn + otherIn;
  const totalOut = carsOut + bikesOut + heavyOut + busesOut + autoOut + otherOut;
  const total = totalIn + totalOut;

  const incomingData = [
    { name: 'Car', count: carsIn, percentage: totalIn ? ((carsIn / totalIn) * 100).toFixed(1) : 0, color: '#3b82f6' },
    { name: 'Bike', count: bikesIn, percentage: totalIn ? ((bikesIn / totalIn) * 100).toFixed(1) : 0, color: '#10b981' },
    { name: 'Truck', count: heavyIn, percentage: totalIn ? ((heavyIn / totalIn) * 100).toFixed(1) : 0, color: '#f59e0b' },
    { name: 'Bus', count: busesIn, percentage: totalIn ? ((busesIn / totalIn) * 100).toFixed(1) : 0, color: '#ef4444' },
    { name: 'Auto Rickshaw', count: autoIn, percentage: totalIn ? ((autoIn / totalIn) * 100).toFixed(1) : 0, color: '#eab308' },
    { name: 'Other', count: otherIn, percentage: totalIn ? ((otherIn / totalIn) * 100).toFixed(1) : 0, color: '#06b6d4' },
  ].filter(d => d.count > 0);

  const outgoingData = [
    { name: 'Car', count: carsOut, percentage: totalOut ? ((carsOut / totalOut) * 100).toFixed(1) : 0, color: '#3b82f6' },
    { name: 'Bike', count: bikesOut, percentage: totalOut ? ((bikesOut / totalOut) * 100).toFixed(1) : 0, color: '#10b981' },
    { name: 'Truck', count: heavyOut, percentage: totalOut ? ((heavyOut / totalOut) * 100).toFixed(1) : 0, color: '#f59e0b' },
    { name: 'Bus', count: busesOut, percentage: totalOut ? ((busesOut / totalOut) * 100).toFixed(1) : 0, color: '#ef4444' },
    { name: 'Auto Rickshaw', count: autoOut, percentage: totalOut ? ((autoOut / totalOut) * 100).toFixed(1) : 0, color: '#eab308' },
    { name: 'Other', count: otherOut, percentage: totalOut ? ((otherOut / totalOut) * 100).toFixed(1) : 0, color: '#06b6d4' },
  ].filter(d => d.count > 0);

  const liveLogs = React.useMemo(() => {
    const formattedLive = events.map((e) => {
      const dt = formatLogDateTime(e.time_str || e.timestamp, e);
      return {
        id: e.event_id || e.track_id,
        dir: e.direction,
        type: e.vehicle_display || e.vehicle_type,
        date: dt.date,
        time: dt.time,
        track_id: e.track_id,
        image_base64: e.image_base64,
        image_path: e.image_path || null,
        ...e
      };
    });

    const liveKeys = new Set(formattedLive.map(l => `${l.track_id}-${l.time}`));
    const filteredDb = dbEvents.filter(d => !liveKeys.has(`${d.track_id}-${d.time}`));

    const merged = [...formattedLive, ...filteredDb];
    return merged.map((log, index) => ({
      ...log,
      srNo: index + 1,
      ...resolveCameraDetails(log, cameraFilter?.availableOptions?.cameras, currentCamObj)
    }));
  }, [events, dbEvents, cameraFilter, currentCamObj]);

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const filteredLiveLogs = liveLogs.filter(log => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      String(log.srNo || '').toLowerCase().includes(q) ||
      String(log.type || '').toLowerCase().includes(q) ||
      String(log.dir || '').toLowerCase().includes(q) ||
      String(log.date || '').toLowerCase().includes(q) ||
      String(log.time || '').toLowerCase().includes(q);

    let matchesDate = true;
    const itemDate = toLocalDateStr(log.raw?.event_time || log.raw?.timestamp || log.date);
    if (fromDate && itemDate && itemDate < fromDate) matchesDate = false;
    if (toDate && itemDate && itemDate > toDate) matchesDate = false;

    const matchesType = !typeFilter || (() => {
      if (!log.type) return false;
      const logTypeStr = String(log.type).toLowerCase();
      const filterStr = typeFilter.toLowerCase();
      if (filterStr === 'auto rickshaw' || filterStr === 'autorickshaw' || filterStr === 'auto' || filterStr === 'rickshaw') {
        return logTypeStr.includes('auto') || logTypeStr.includes('rickshaw');
      }
      if (filterStr === 'other') {
        const known = ['car', 'bike', 'motorcycle', 'truck', 'heavy', 'bus', 'auto', 'rickshaw'];
        return logTypeStr.includes('other') || !known.some(k => logTypeStr.includes(k));
      }
      return logTypeStr.includes(filterStr);
    })();
    const matchesDirection = !directionFilter || log.dir === directionFilter;

    return matchesSearch && matchesDate && matchesType && matchesDirection;
  });

  const tableColumns = [
    { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
    {
      header: "DIR", accessor: "dir", render: (row) => (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/5 dark:bg-white/5">
          {row.dir === "in"
            ? <ArrowRight className="w-4 h-4 text-green-500" />
            : <ArrowLeft className="w-4 h-4 text-orange-500" />
          }
        </div>
      )
    },
    { header: "VEHICLE TYPE", accessor: "type", render: (row) => <span className="font-bold">{row.type}</span> },
    { header: "ZONE", accessor: "zone", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.zone || 'Unknown'}</span> },
    { header: "LOCATION", accessor: "location", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.location || 'Unknown'}</span> },
    { header: "CAMERA", accessor: "camera", render: (row) => <span className="opacity-80" style={{ color: themeUtils.getTextColor(false) }}>{row.camera || 'Unknown'}</span> },
    { header: "DATE", accessor: "date", render: (row) => <span className="font-medium text-xs opacity-90">{row.date}</span> },
    { header: "TIME", accessor: "time", render: (row) => <span className="font-mono text-xs font-semibold text-white-500 dark:text-white-400">{row.time}</span> },
    {
      header: "ACTION", accessor: "action", render: (row) => (
        <button
          onClick={() => handleViewDetails(row)}
          className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors cursor-pointer"
          title="View Snapshot"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

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
            In / Out Live Feeds ({camerasList.length} Cameras)
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
            No cameras mapped for In / Out Detection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginatedCameras.map((cam) => (
            <div key={cam.id || cam.value} className="h-48 sm:h-56 md:h-60 lg:h-64 xl:h-72 2xl:h-80 rounded-lg overflow-hidden border" style={{ borderColor: themeUtils.getBorderColor() }}>
              <LiveCameraCard camera={cam} enableLineAdjust={true} />
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

  const inOutStats = React.useMemo(() => {
    const c = dbCounts || {};
    const carIn = parseInt(c.car_in !== undefined ? c.car_in : (counts?.car_in || 0));
    const carOut = parseInt(c.car_out !== undefined ? c.car_out : (counts?.car_out || 0));
    const bikeIn = parseInt(c.bike_in !== undefined ? c.bike_in : (c.motorcycle_in || counts?.bike_in || 0));
    const bikeOut = parseInt(c.bike_out !== undefined ? c.bike_out : (c.motorcycle_out || counts?.bike_out || 0));
    const truckIn = parseInt(c.truck_in !== undefined ? c.truck_in : (counts?.truck_in || 0));
    const truckOut = parseInt(c.truck_out !== undefined ? c.truck_out : (counts?.truck_out || 0));
    const busIn = parseInt(c.bus_in !== undefined ? c.bus_in : (counts?.bus_in || 0));
    const busOut = parseInt(c.bus_out !== undefined ? c.bus_out : (counts?.bus_out || 0));
    const autoIn = parseInt(c.auto_in !== undefined ? c.auto_in : (c.rickshaw_in || counts?.auto_in || counts?.rickshaw_in || 0));
    const autoOut = parseInt(c.auto_out !== undefined ? c.auto_out : (c.rickshaw_out || counts?.auto_out || counts?.rickshaw_out || 0));
    const otherIn = parseInt(c.other_in !== undefined ? c.other_in : (counts?.other_in || 0));
    const otherOut = parseInt(c.other_out !== undefined ? c.other_out : (counts?.other_out || 0));

    const totalIn = carIn + bikeIn + truckIn + busIn + autoIn + otherIn;
    const totalOut = carOut + bikeOut + truckOut + busOut + autoOut + otherOut;

    return [
      { title: "TOTAL VEHICLES COUNT", in: totalIn, out: totalOut, total: totalIn + totalOut, color: "text-blue-500" },
      { title: "CAR", in: carIn, out: carOut, total: carIn + carOut, color: "text-green-500" },
      { title: "BIKE", in: bikeIn, out: bikeOut, total: bikeIn + bikeOut, color: "text-purple-500" },
      { title: "TRUCK", in: truckIn, out: truckOut, total: truckIn + truckOut, color: "text-amber-500" },
      { title: "BUS", in: busIn, out: busOut, total: busIn + busOut, color: "text-red-500" },
      { title: "AUTO RICKSHAW", in: autoIn, out: autoOut, total: autoIn + autoOut, color: "text-yellow-500" },
      { title: "OTHER", in: otherIn, out: otherOut, total: otherIn + otherOut, color: "text-cyan-500" },
    ];
  }, [dbCounts, counts]);

  return (
    <ModuleLayout
      title="In and Out Detection"
      subtitle="Real-time entry, exit, and directional vehicle flow monitoring"
      hideLiveSystem={true}
      hideCameraInHeader={false}
      videoComponent={cameraGridComponent}
      bottomTableComponent={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            {inOutStats.map((stat, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl border flex flex-col justify-between shadow-sm transition-all hover:shadow-md"
                style={{ backgroundColor: themeUtils.getBgColor("card"), borderColor: themeUtils.getBorderColor() }}
              >
                <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-75" style={{ color: themeUtils.getTextColor(false) }}>
                  {stat.title}
                </span>
                <div className="my-1.5 flex items-baseline justify-between">
                  <span className={`text-2xl font-black ${stat.color}`}>{stat.total}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 opacity-80">
                    Total
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold border-t pt-2" style={{ borderColor: themeUtils.getBorderColor() }}>
                  <span className="text-green-500">IN: {stat.in}</span>
                  <span className="text-orange-500">OUT: {stat.out}</span>
                </div>
              </div>
            ))}
          </div>

          <PaginatedTable
            title="LIVE DETECTIONS LOG"
            columns={tableColumns}
            data={filteredLiveLogs}
            itemsPerPage={10}
            headerContent={
              <div className="flex items-center gap-2">
                <div className="w-56">
                  <SearchBar
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search SR NO, type, direction..."
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-2 py-1 h-8 text-xs border rounded outline-none focus:border-blue-500 cursor-pointer"
                  style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('input'), color: themeUtils.getTextColor(true) }}
                >
                  <option value="">All Types</option>
                  <option value="Car">Car</option>
                  <option value="Bike">Bike</option>
                  <option value="Truck">Truck</option>
                  <option value="Bus">Bus</option>
                  <option value="Auto Rickshaw">Auto Rickshaw</option>
                  <option value="Other">Other</option>
                </select>
                <select
                  value={directionFilter}
                  onChange={(e) => setDirectionFilter(e.target.value)}
                  className="px-2 py-1 h-8 text-xs border rounded outline-none focus:border-blue-500 cursor-pointer"
                  style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('input'), color: themeUtils.getTextColor(true) }}
                >
                  <option value="">All Directions</option>
                  <option value="in">Entry</option>
                  <option value="out">Exit</option>
                </select>
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
            header="Crossing Event Details"
          >
            {selectedRecord && (
              <div className="flex flex-col gap-6 pt-4">
                {(selectedRecord.image_path || selectedRecord.image_base64) && (
                  <div className="w-full rounded-xl overflow-hidden border" style={{ borderColor: themeUtils.getBorderColor() }}>
                    <img
                      src={
                        selectedRecord.image_path
                          ? getImageUrl(selectedRecord.image_path)
                          : selectedRecord.image_base64?.startsWith('data:')
                            ? selectedRecord.image_base64
                            : `data:image/jpeg;base64,${selectedRecord.image_base64}`
                      }
                      alt="Vehicle Snapshot"
                      className="w-full h-auto object-cover max-h-[300px]"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">

                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Vehicle Type</p>
                    <p className="font-semibold text-lg text-blue-500">{selectedRecord.type}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Direction</p>
                    <p className={`font-semibold text-sm ${selectedRecord.dir === 'in' ? 'text-green-500' : 'text-orange-500'}`}>
                      {selectedRecord.dir === 'in' ? 'ENTRY' : 'EXIT'}
                    </p>
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
                    <p className="font-semibold text-sm">{selectedRecord.date || 'N/A'}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Detection Time</p>
                    <p className="font-semibold text-sm font-mono text-blue-500">{selectedRecord.time || 'N/A'}</p>
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
              toast?.info?.("Refreshed", "Traffic behavior data refreshed");
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => {
              import('../../utils/exportUtils').then(({ exportToCSV }) => {
                exportToCSV(filteredLiveLogs, 'in_out_detection_export');
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
