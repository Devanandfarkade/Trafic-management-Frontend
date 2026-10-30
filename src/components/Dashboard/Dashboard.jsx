import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, AlertTriangle, FileText, Car, ActivitySquare, RefreshCw, Truck, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useTheme } from '../../ui/Settings/themeUtils';
import BottomStatCard from '../../ui/common/BottomStatCard';
import ChartComponent from '../../ui/common/ChartComponent';
import InteractivePieChart from '../../ui/common/InteractivePieChart';
import GlobalCameraFilter from '../../ui/common/GlobalCameraFilter';
import DateRangePicker from '../../ui/common/DateRangePicker';
import useCameraFilter from '../../hooks/useCameraFilter';
import LiveDashboardMap from './LiveDashboardMap';
import { useToast } from '../../ui/common/CustomToast';
import { API_BASE_URL, API_CONFIG } from '../../../config.js';
import { getTodayStr, toLocalDateStr } from '../../utils/dateUtils';

function getImageUrl(relativePath) {
  if (!relativePath) return null;
  const urlPath = relativePath.replace(/\\/g, '/');
  return `${API_BASE_URL}/${urlPath}`;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const navigateWithDate = (path) => {
    const fDate = fromDate || getTodayStr();
    const tDate = toDate || getTodayStr();
    navigate(`${path}?fromDate=${fDate}&toDate=${tDate}`, {
      state: { fromDate: fDate, toDate: tDate }
    });
  };

  const toast = useToast();
  const { themeUtils } = useTheme();
  const [mapFilter, setMapFilter] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [dashboardInOut, setDashboardInOut] = useState(null);
  const [dashboardHeavy, setDashboardHeavy] = useState(null);
  const [noParkingStats, setNoParkingStats] = useState({ total: 0, pending: 0, resolved: 0, rejected: 0 });
  const [violationsList, setViolationsList] = useState([]);
  const [inOutCounts, setInOutCounts] = useState({ car_in: 0, car_out: 0, bike_in: 0, bus_in: 0, bus_out: 0, truck_in: 0, truck_out: 0, total_in: 0, total_out: 0 });
  const [inOutEvents, setInOutEvents] = useState([]);
  const [aiIncidents, setAiIncidents] = useState([]);
  const [heavyVehicles, setHeavyVehicles] = useState([]);

  // Alerts card pagination & records per page state (default 7 as requested)
  const [alertRecordsPerPage, setAlertRecordsPerPage] = useState(7);
  const [alertCurrentPage, setAlertCurrentPage] = useState(1);

  const cameraFilter = useCameraFilter(null); // fetch all cameras
  const { selectedCamera } = cameraFilter;

  // selectedMapCamera is the camera whose feed is shown in the Live Camera Feed panel.
  // Defaults to the first camera from useCameraFilter; updated when user clicks a map dot or selects from filter.
  const [selectedMapCamera, setSelectedMapCamera] = React.useState(null);
  const [targetMapCamera, setTargetMapCamera] = useState(null);

  // Track acknowledged incident IDs so red spots stop blinking on the map
  const [acknowledgedIncidentIds, setAcknowledgedIncidentIds] = useState(new Set());

  const handleAcknowledgeIncident = async (incidentId) => {
    setAcknowledgedIncidentIds(prev => new Set([...prev, incidentId, String(incidentId)]));
    try {
      await fetch(`${API_BASE_URL}/api/ai-incident/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
      });
      fetchDashboardData();
    } catch (e) {
      console.error('Failed to acknowledge incident:', e);
    }
  };

  // Track acknowledged violation IDs so red spots stop blinking on the map
  const [acknowledgedViolationIds, setAcknowledgedViolationIds] = useState(new Set());

  const handleAcknowledgeViolation = async (violationId) => {
    if (!violationId) return;
    setAcknowledgedViolationIds(prev => new Set([...prev, violationId, String(violationId)]));
    // Optimistically update local violations list
    setViolationsList(prev => prev.map(v =>
      (String(v.id) === String(violationId) || String(v.violation_id) === String(violationId))
        ? { ...v, status: 'ACKNOWLEDGED' }
        : v
    ));
    try {
      await fetch(`${API_BASE_URL}/api/no-parking/violations/${violationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
      });
      fetchDashboardData();
    } catch (e) {
      console.error('Failed to acknowledge violation:', e);
    }
  };

  // Auto-set the live feed camera to the first camera when cameras load
  useEffect(() => {
    if (selectedCamera && !selectedMapCamera) {
      setSelectedMapCamera(selectedCamera);
    }
  }, [selectedCamera, selectedMapCamera]);

  // When user selects a camera from the Global Dashboard Filter
  const initialCamLoadedRef = useRef(false);
  const prevCamFilterIdRef = useRef(null);

  useEffect(() => {
    if (!initialCamLoadedRef.current) {
      if (cameraFilter.filters.cameraId) {
        initialCamLoadedRef.current = true;
        prevCamFilterIdRef.current = cameraFilter.filters.cameraId;
      }
      return;
    }
    if (!cameraFilter.filters.cameraId) {
      if (prevCamFilterIdRef.current) {
        prevCamFilterIdRef.current = null;
        if (cameraFilter.allCameras?.length > 0) {
          setSelectedMapCamera(cameraFilter.allCameras[0]);
          setTargetMapCamera(null);
        }
      }
      return;
    }
    if (cameraFilter.filters.cameraId && cameraFilter.filters.cameraId !== prevCamFilterIdRef.current) {
      prevCamFilterIdRef.current = cameraFilter.filters.cameraId;
      const cam = cameraFilter.availableOptions.cameras.find(c => String(c.value) === String(cameraFilter.filters.cameraId)) ||
        cameraFilter.allCameras.find(c => String(c.value) === String(cameraFilter.filters.cameraId));
      if (cam) {
        setSelectedMapCamera(cam);
        setTargetMapCamera({ ...cam, _ts: Date.now() });
      }
    }
  }, [cameraFilter.filters.cameraId, cameraFilter.availableOptions.cameras, cameraFilter.allCameras]);

  const activeCamUrl = selectedMapCamera?.url || selectedCamera?.url || '';

  const wsRef = useRef(null);

  // 1. Fetch Dynamic Data & Camera Streams from Backend Node APIs
  const fetchDashboardData = async () => {
    try {
      const url = new URL(`${API_BASE_URL}/api/dashboard/stats`);
      const effectiveFrom = fromDate || getTodayStr();
      const effectiveTo = toDate || getTodayStr();
      url.searchParams.append('from_date', effectiveFrom);
      url.searchParams.append('fromDate', effectiveFrom);
      url.searchParams.append('to_date', effectiveTo);
      url.searchParams.append('toDate', effectiveTo);
      if (cameraFilter.filters.zone && cameraFilter.filters.zone !== 'all') {
        url.searchParams.append('zone_id', cameraFilter.filters.zone);
      }
      if (cameraFilter.filters.location && cameraFilter.filters.location !== 'all') {
        url.searchParams.append('location_id', cameraFilter.filters.location);
      }
      if (cameraFilter.filters.cameraId && cameraFilter.filters.cameraId !== 'all') {
        url.searchParams.append('camera_id', cameraFilter.filters.cameraId);
      }

      // 1. Fetch Aggregated Dashboard Stats
      try {
        const dashRes = await fetch(url.toString());
        if (dashRes.ok) {
          const data = await dashRes.json();
          if (data.success && data.stats) {
            setDashboardSummary(data.stats);
          }
        }
      } catch (e) { }

      // 2. Fetch In/Out Summary (Type-wise)
      try {
        const inOutRes = await fetch(`${API_BASE_URL}/api/dashboard/in-out-summary${url.search}`);
        if (inOutRes.ok) {
          const data = await inOutRes.json();
          if (data.success) {
            setDashboardInOut(data);
          }
        }
      } catch (e) { }

      // 3. Fetch Heavy Vehicle Summary (Type-wise)
      try {
        const heavyRes = await fetch(`${API_BASE_URL}/api/dashboard/heavy-vehicle-summary${url.search}`);
        if (heavyRes.ok) {
          const data = await heavyRes.json();
          if (data.success) {
            setDashboardHeavy(data);
          }
        }
      } catch (e) { }

      // 4. Fetch Live Violations
      try {
        const violRes = await fetch(`${API_BASE_URL}/api/dashboard/live-violations${url.search}&limit=20`);
        if (violRes.ok) {
          const data = await violRes.json();
          if (data.violations) {
            setViolationsList(data.violations);
          }
        }
      } catch (e) { }

      // 5. Fetch No Parking Stats
      try {
        const statsRes = await fetch(`${API_BASE_URL}/api/no-parking/stats${url.search}`);
        if (statsRes.ok) {
          const data = await statsRes.json();
          if (data.stats) setNoParkingStats(data.stats);
        }
      } catch (e) { }

      // 6. Fetch AI Incidents
      try {
        const incUrl = new URL(`${API_BASE_URL}/api/ai-incident/incidents${url.search}`);
        incUrl.searchParams.append('limit', '20');
        if (cameraFilter.filters.cameraId && cameraFilter.filters.cameraId !== 'all') {
          incUrl.searchParams.append('camera', cameraFilter.filters.cameraId);
        }
        const incidentsRes = await fetch(incUrl.toString());
        if (incidentsRes.ok) {
          const data = await incidentsRes.json();
          if (data.incidents) setAiIncidents(data.incidents);
        }
      } catch (e) { }

      // 7. Fetch Heavy Vehicles
      try {
        const hvUrl = new URL(`${API_BASE_URL}/api/heavy-vehicle/detections${url.search}`);
        hvUrl.searchParams.append('limit', '20');
        if (cameraFilter.filters.cameraId && cameraFilter.filters.cameraId !== 'all') {
          hvUrl.searchParams.append('camera', cameraFilter.filters.cameraId);
        }
        const hvRes = await fetch(hvUrl.toString());
        if (hvRes.ok) {
          const data = await hvRes.json();
          if (data.detections) setHeavyVehicles(data.detections);
        }
      } catch (e) { }

    } catch (err) {
      console.error("Error fetching dashboard dynamic data:", err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFromDate('');
    setToDate('');
    cameraFilter.actions.clearFilters();
    if (cameraFilter.allCameras?.length > 0) {
      setSelectedMapCamera(cameraFilter.allCameras[0]);
    }
    setTargetMapCamera(null);
    await fetchDashboardData();
    if (cameraFilter?.refetch) {
      await cameraFilter.refetch();
    }
    toast?.info?.("Refreshed", "Dashboard data updated");
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 3000);

    const onCustomRefresh = () => {
      setFromDate('');
      setToDate('');
      handleRefresh();
    };
    window.addEventListener('app:refresh', onCustomRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('app:refresh', onCustomRefresh);
    };
  }, [fromDate, toDate, cameraFilter.filters.zone, cameraFilter.filters.location, cameraFilter.filters.cameraId]);

  // Derived Metrics
  const totalVehiclesDetected = dashboardSummary?.vehicles_detected?.total !== undefined
    ? dashboardSummary.vehicles_detected.total
    : ((inOutCounts.total_in || 0) + (inOutCounts.total_out || 0));

  // Generate Dynamic In/Out Vehicle Count (Type-wise) Pie Chart Data
  const generateInOutPieData = () => {
    const colors = {
      Car: '#3b82f6',     // Blue
      Bike: '#10b981',    // Emerald
      Bus: '#8b5cf6',     // Purple
      Truck: '#f59e0b',   // Amber
    };

    const itemsSource = dashboardInOut?.items || [
      { name: 'Car', inCount: 0, outCount: 0, count: 0, color: colors.Car },
      { name: 'Bike', inCount: 0, outCount: 0, count: 0, color: colors.Bike },
      { name: 'Bus', inCount: 0, outCount: 0, count: 0, color: colors.Bus },
      { name: 'Truck', inCount: 0, outCount: 0, count: 0, color: colors.Truck },
    ];

    const totalVehicles = dashboardInOut?.total || 0;
    const C = 251.327; // 2 * pi * 40
    let offsetAcc = 0;

    const items = itemsSource.map(item => {
      const percentage = totalVehicles > 0 ? Math.round((item.count / totalVehicles) * 100) : 0;
      const strokeDash = totalVehicles > 0 ? (item.count / totalVehicles) * C : 0;
      const strokeOffset = -offsetAcc;
      offsetAcc += strokeDash;

      return {
        ...item,
        percentage,
        strokeDash: `${strokeDash.toFixed(2)} ${C.toFixed(2)}`,
        strokeOffset: strokeOffset.toFixed(2),
      };
    });

    return {
      total: totalVehicles,
      totalIn: dashboardInOut?.totalIn || 0,
      totalOut: dashboardInOut?.totalOut || 0,
      items,
    };
  };

  const inOutPieData = generateInOutPieData();

  const filteredViolations = violationsList;
  const filteredHeavy = heavyVehicles;
  const filteredAiIncidents = aiIncidents;

  // Enrich violations with coordinates so they always display as red dots on the map
  const violationsWithCoords = filteredViolations.map(v => {
    let lat = v.latitude ? parseFloat(v.latitude) : null;
    let lng = v.longitude ? parseFloat(v.longitude) : null;
    if (isNaN(lat) || isNaN(lng) || !lat || !lng) {
      const matchedCam = cameraFilter.allCameras?.find(c =>
        (v.camera && (c.name === v.camera || c.label === v.camera || c.camera_code === v.camera || c.rtsp_url === v.camera || c.url === v.camera)) ||
        (v.stream_id && (c.rtsp_url === v.stream_id || c.url === v.stream_id || c.camera_code === v.stream_id)) ||
        (v.location && c.location === v.location)
      );
      if (matchedCam && matchedCam.latitude && matchedCam.longitude) {
        lat = parseFloat(matchedCam.latitude);
        lng = parseFloat(matchedCam.longitude);
      } else if (cameraFilter.allCameras?.length > 0) {
        const fallbackCam = cameraFilter.allCameras.find(c => c.latitude && c.longitude) || cameraFilter.allCameras[0];
        lat = parseFloat(fallbackCam.latitude || 18.1500);
        lng = parseFloat(fallbackCam.longitude || 74.5833);
      } else {
        lat = 18.1500;
        lng = 74.5833;
      }
    }
    return {
      ...v,
      latitude: lat,
      longitude: lng,
      isViolation: true,
    };
  });

  // Heavy Vehicle Detections Pie Chart
  const generateHeavyVehiclePieData = () => {
    if (!dashboardHeavy || !dashboardHeavy.items || dashboardHeavy.total === 0) {
      return [];
    }
    return dashboardHeavy.items.filter(item => item.count > 0);
  };

  const heavyVehiclePieData = generateHeavyVehiclePieData();

  const isDateInRange = (dateVal) => {
    if (!dateVal) return true;
    const dStr = toLocalDateStr(dateVal);
    if (!dStr) return true;
    const effectiveFrom = fromDate || getTodayStr();
    const effectiveTo = toDate || getTodayStr();
    if (effectiveFrom && dStr < effectiveFrom) return false;
    if (effectiveTo && dStr > effectiveTo) return false;
    return true;
  };

  // Generate Dynamic Critical Alerts List Aggregated from ALL modules
  const aggregatedAlerts = [
    ...filteredViolations
      .filter(v => (v.status === 'UNRESOLVED' || !v.status) && isDateInRange(v.detected_at || v.time))
      .map(v => {
        const timeVal = v.detected_at || v.time;
        return {
          id: v.id || v.violation_id,
          module: 'No Parking',
          title: `No Parking: ${v.plate || v.vehicle_id || 'Vehicle'}`,
          loc: v.location || v.camera || v.stream_id || 'Unknown Location',
          camera: v.camera || v.stream_id,
          timeObj: timeVal ? new Date(timeVal) : new Date(),
          icon: AlertTriangle,
          bg: 'bg-red-500/20',
          text: 'text-red-500'
        };
      }),
    ...filteredHeavy
      .filter(v => (v.status === 'UNRESOLVED' || !v.status) && isDateInRange(v.detected_at || v.time))
      .map(v => {
        const timeVal = v.detected_at || v.time;
        return {
          id: v.id,
          module: 'Heavy Vehicle',
          title: `Heavy Vehicle Detected`,
          loc: v.location || v.camera || 'Unknown Location',
          camera: v.camera,
          timeObj: timeVal ? new Date(timeVal) : new Date(),
          icon: AlertTriangle,
          bg: 'bg-orange-500/20',
          text: 'text-orange-500'
        };
      }),
    ...filteredAiIncidents
      .filter(i => (i.severity === 'high' || i.status === 'UNRESOLVED') && isDateInRange(i.detected_at || i.time))
      .map(i => {
        const timeVal = i.detected_at || i.time;
        return {
          id: i.id,
          module: 'AI Incident',
          title: `Incident: ${i.type || 'Unknown'}`,
          loc: i.location || i.camera || 'Unknown Location',
          camera: i.camera,
          timeObj: timeVal ? new Date(timeVal) : new Date(),
          icon: AlertTriangle,
          bg: 'bg-purple-500/20',
          text: 'text-purple-500'
        };
      })
  ];

  // Sort by newest first
  const criticalAlerts = aggregatedAlerts
    .sort((a, b) => b.timeObj - a.timeObj)
    .map(a => ({
      ...a,
      time: a.timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

  // Alert Pagination computations
  const totalAlertPages = Math.max(1, Math.ceil(criticalAlerts.length / alertRecordsPerPage));
  const currentAlertPageSafe = Math.min(alertCurrentPage, totalAlertPages);
  const startAlertIdx = (currentAlertPageSafe - 1) * alertRecordsPerPage;
  const paginatedAlerts = criticalAlerts.slice(startAlertIdx, startAlertIdx + alertRecordsPerPage);

  return (
    <div className="flex flex-col gap-2 w-full h-full overflow-y-auto overflow-x-hidden text-gray-900 dark:text-white font-sans hide-scrollbar">

      {/* 0. FILTER BAR / DASHBOARD HEADER - 100% PC Screen Single Line */}
      <div className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border border-gray-200 dark:border-blue-900/40 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm shrink-0 flex items-center justify-between gap-2 transition-colors w-full min-h-[46px] relative z-[10000]">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse ring-4 ring-blue-500/20"></div>
          <h2 className="text-xs sm:text-sm font-bold tracking-wider text-gray-900 dark:text-white uppercase select-none">
            Dashboard
          </h2>
        </div>
        <div className="flex items-center gap-1.5 xl:gap-2 justify-end flex-nowrap shrink-0">
          <DateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
            onClear={() => {
              setFromDate('');
              setToDate('');
            }}
          />
          <GlobalCameraFilter
            cameraFilter={cameraFilter}
            className="flex-nowrap justify-end shrink-0"
            size="sm"
            onCameraSelect={(camVal, camObj) => {
              if (!camVal) {
                if (cameraFilter.allCameras?.length > 0) {
                  setSelectedMapCamera(cameraFilter.allCameras[0]);
                }
                setTargetMapCamera(null);
                return;
              }
              const cam = camObj || cameraFilter.availableOptions.cameras.find(c => String(c.value) === String(camVal)) ||
                cameraFilter.allCameras.find(c => String(c.value) === String(camVal));
              if (cam) {
                setSelectedMapCamera(cam);
                setTargetMapCamera({ ...cam, _ts: Date.now() });
              }
            }}
            onLocationSelect={(locId) => {
              if (!locId) {
                if (cameraFilter.allCameras?.length > 0) {
                  setSelectedMapCamera(cameraFilter.allCameras[0]);
                }
                setTargetMapCamera(null);
                return;
              }
              const matchedCam = cameraFilter.allCameras.find(c =>
                String(c.location_id) === String(locId) || String(c.location) === String(locId)
              );
              if (matchedCam) {
                setSelectedMapCamera(matchedCam);
                setTargetMapCamera({ ...matchedCam, _ts: Date.now() });
              }
            }}
            onClear={() => {
              if (cameraFilter.allCameras?.length > 0) {
                setSelectedMapCamera(cameraFilter.allCameras[0]);
              }
              setTargetMapCamera(null);
              fetchDashboardData();
            }}
          />
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 h-[34px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
            title="Refresh dashboard data and reset filters"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 1. TOP METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <BottomStatCard
          icon={<Camera size={22} className="text-blue-500" />}
          title="TOTAL CAMERAS"
          value={dashboardSummary?.cameras?.total ?? cameraFilter.allCameras.length}
          // subtitle={`${dashboardSummary?.cameras?.active ?? cameraFilter.allCameras.length} Active / ${dashboardSummary?.cameras?.inactive ?? 0} Inactive`}
          onClick={() => navigateWithDate('/live-monitoring')}
        />
        <BottomStatCard
          icon={<Car size={22} className="text-amber-500" />}
          title="VEHICLES DETECTED"
          value={totalVehiclesDetected.toLocaleString()}
          subtitle={`In: ${dashboardSummary?.vehicles_detected?.total_in ?? inOutCounts.total_in ?? 0} | Out: ${dashboardSummary?.vehicles_detected?.total_out ?? inOutCounts.total_out ?? 0}`}
          onClick={() => navigateWithDate('/traffic-behavior')}
        />
        <BottomStatCard
          icon={<FileText size={22} className="text-red-500" />}
          title="VIOLATIONS"
          value={(dashboardSummary?.violations_today?.total ?? noParkingStats.total ?? 0).toLocaleString()}
          subtitle={fromDate && toDate ? (fromDate === toDate ? `Date: ${fromDate}` : `${fromDate} to ${toDate}`) : "All Violations"}
          onClick={() => navigateWithDate('/no-parking')}
        />
        <BottomStatCard
          icon={<AlertTriangle size={22} className="text-orange-500" />}
          title="ALERTS"
          value={dashboardSummary?.alerts_today?.total ?? criticalAlerts.length}
          subtitle="Active Unresolved Alerts"
          onClick={() => navigateWithDate('/alerts')}
        />
      </div>

      {/* 2. MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 flex-1 min-h-0">

        {/* LEFT & CENTER COLUMNS */}
        <div className="xl:col-span-3 flex flex-col gap-3 min-h-0 h-full">

          {/* MAP COMPONENT */}
          <div className="relative flex-1 rounded-2xl border border-gray-200 dark:border-blue-900/40 bg-gray-100 dark:bg-[#0d131f] overflow-hidden min-h-[450px] shadow-xl">
            <LiveDashboardMap
              cameras={cameraFilter.availableOptions.cameras}
              criticalAlerts={criticalAlerts}
              aiIncidents={filteredAiIncidents}
              violations={violationsWithCoords}
              mapFilter={mapFilter}
              onCameraClick={(cam) => setSelectedMapCamera(cam)}
              acknowledgedIncidentIds={acknowledgedIncidentIds}
              onAcknowledgeIncident={handleAcknowledgeIncident}
              acknowledgedViolationIds={acknowledgedViolationIds}
              onAcknowledgeViolation={handleAcknowledgeViolation}
              targetCamera={targetMapCamera}
              selectedMapCamera={selectedMapCamera}
            />


            {/* Title Overlay */}
            <div className="absolute top-4 left-4 z-[500] pointer-events-none">
              <h2 className="text-sm font-bold tracking-widest text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">BARAMATI CITY - LIVE MONITORING</h2>
            </div>

            {/* Legend Overlay */}
            <div className="absolute top-4 right-4 z-[500] bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border border-gray-200 dark:border-blue-900/50 rounded-xl p-3 text-xs flex flex-col gap-2 pointer-events-none shadow-xl">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></div> Active Cameras</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]"></div> Incidents</div>
            </div>

            {/* Bottom Filters */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border border-gray-200 dark:border-blue-900/50 rounded-full p-1.5 flex items-center gap-1 text-xs shadow-xl transition-all">
              {['All', 'Cameras', 'Alerts'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setMapFilter(filter)}
                  className={`px-4 py-1.5 rounded-full font-bold transition-colors ${mapFilter === filter ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10'}`}
                >
                  {filter === 'Cameras' && <Camera size={12} className="inline mr-1" />}
                  {filter === 'Alerts' && <AlertTriangle size={12} className="inline mr-1" />}
                  {filter}
                </button>
              ))}
            </div>

          </div>

          {/* BOTTOM ROW (Under Map) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[280px] shrink-0">

            {/* Live Violations List */}
            <div className="bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border border-gray-200 dark:border-blue-900/40 rounded-2xl flex flex-col overflow-hidden shadow-xl">
              <div className="p-3 border-b border-gray-200 dark:border-blue-900/40 flex justify-between items-center bg-gray-50/50 dark:bg-[#151e32]/50 backdrop-blur-sm">
                <h3 className="text-[11px] font-bold tracking-widest text-gray-600 dark:text-gray-300 uppercase">Live Violations</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-blue-400 font-semibold">{filteredViolations.length} Violations</span>
                  <button
                    onClick={() => navigateWithDate('/no-parking')}
                    className="text-xs text-blue-500 hover:text-blue-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    View All ➔
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto hide-scrollbar p-2 flex flex-col gap-2">
                {filteredViolations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-xs text-gray-500 gap-1.5">
                    <Car size={26} className="opacity-40" />
                    <span>No violations recorded for selected date range</span>
                  </div>
                ) : (
                  filteredViolations.map((v, i) => {
                    const vId = v.id || v.violation_id;
                    const isAck = (acknowledgedViolationIds && (acknowledgedViolationIds.has(vId) || acknowledgedViolationIds.has(String(vId)))) ||
                      v.status === 'ACKNOWLEDGED' || v.status === 'RESOLVED';
                    const imgSrc = v.violation_image_path
                      ? getImageUrl(v.violation_image_path)
                      : v.violation_image_base64
                        ? (v.violation_image_base64.startsWith('data:') ? v.violation_image_base64 : `data:image/jpeg;base64,${v.violation_image_base64}`)
                        : null;

                    return (
                      <div
                        key={`viol-${vId || 'item'}-${i}`}
                        onClick={() => {
                          const matchedCam = cameraFilter.allCameras?.find(c =>
                            (v.camera && (c.name === v.camera || c.label === v.camera || c.camera_code === v.camera || c.rtsp_url === v.camera)) ||
                            (v.location && c.location === v.location)
                          );
                          if (matchedCam) {
                            setSelectedMapCamera(matchedCam);
                            setTargetMapCamera({ ...matchedCam, _ts: Date.now() });
                          }
                        }}
                        className="bg-gray-100 dark:bg-black/20 rounded-lg p-2 flex items-center gap-3 border border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-black/40 transition-colors cursor-pointer"
                      >
                        <div className="w-16 h-10 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden relative border border-gray-300 dark:border-gray-700 shrink-0">
                          {imgSrc ? (
                            <img src={imgSrc} alt="Vehicle" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-600">
                              <Car size={14} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <Car size={10} className="text-red-500" />
                            <span className="text-[11px] font-bold text-red-500 truncate">No Parking</span>
                          </div>
                          <div className="text-[12px] font-medium text-gray-900 dark:text-white truncate">{v.plate || `Vehicle #${v.vehicle_id || 'N/A'}`}</div>
                          <div className="text-[9px] text-gray-500 truncate">{v.camera || v.stream_id || 'Main Gate'}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="text-[10px] text-gray-400 font-medium">
                            {v.time ? new Date(v.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </div>
                          {!isAck ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcknowledgeViolation(vId);
                              }}
                              title="Acknowledge violation & stop blinking on map"
                              className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <span>✓</span> OK
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              ✓ Ack
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* In/Out Vehicle Count (Type-wise) */}
            <div className="bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border border-gray-200 dark:border-blue-900/40 rounded-2xl flex flex-col overflow-hidden shadow-xl">
              <div className="p-3 border-b border-gray-200 dark:border-blue-900/40 flex justify-between items-center bg-gray-50/50 dark:bg-[#151e32]/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <ActivitySquare size={13} className="text-blue-500" />
                  <h3 className="text-[11px] font-bold tracking-widest text-gray-600 dark:text-gray-300 uppercase">In/Out Count by Vehicle Type</h3>
                </div>
                <button
                  onClick={() => navigateWithDate('/traffic-behavior')}
                  className="text-xs text-blue-500 hover:text-blue-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  View All ➔
                </button>
              </div>
              <div className="flex-1 flex flex-row items-center justify-center p-2">
                <div className="w-1/2 h-full relative flex items-center justify-center pl-2">
                  <svg viewBox="0 0 100 100" className="w-full h-full max-w-[135px] max-h-[135px] drop-shadow-xl">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#1f2937" strokeWidth="15" />
                    {inOutPieData.items.map((item, idx) => (
                      <circle
                        key={`ring-${item.name}-${idx}`}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={item.color}
                        strokeWidth="15"
                        strokeDasharray={item.strokeDash}
                        strokeDashoffset={item.strokeOffset}
                        transform="rotate(-90 50 50)"
                        strokeLinecap="round"
                        className="transition-all duration-500 hover:opacity-80"
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{inOutPieData.total.toLocaleString()}</span>
                    <span className="text-[8px] text-gray-400 uppercase font-semibold">Total</span>
                  </div>
                </div>
                <div className="w-1/2 flex flex-col gap-2 pl-3 pr-2 overflow-y-auto hide-scrollbar max-h-full py-1">
                  {inOutPieData.items.map((d, idx) => (
                    <div key={`pie-${d.name}-${idx}`} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: d.color }}></div>
                          <span className="font-semibold text-gray-700 dark:text-gray-200 truncate">{d.name}</span>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white shrink-0">{d.count} <span className="text-[9px] text-gray-400 font-normal">({d.percentage}%)</span></span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-gray-400 pl-3.5">
                        <span>In: <strong className="text-emerald-500">{d.inCount}</strong></span>
                        <span>Out: <strong className="text-blue-500">{d.outCount}</strong></span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-0.5 pt-1 border-t border-gray-200 dark:border-gray-800/80 flex items-center justify-between text-[9px] font-bold text-gray-500">
                    <span>Total In: <strong className="text-emerald-500 font-bold">{inOutPieData.totalIn}</strong></span>
                    <span>Total Out: <strong className="text-blue-500 font-bold">{inOutPieData.totalOut}</strong></span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="xl:col-span-1 flex flex-col gap-3 min-h-0 h-full">

          {/* Alerts */}
          <div className="bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border border-gray-200 dark:border-blue-900/40 rounded-2xl flex flex-col overflow-hidden shadow-xl flex-1 min-h-[450px] max-h-[450px] h-[450px]">
            <div className="p-3 border-b border-gray-200 dark:border-blue-900/40 flex justify-between items-center bg-gray-50/50 dark:bg-[#151e32]/50 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-orange-500" />
                <h3 className="text-[11px] font-bold tracking-widest text-gray-600 dark:text-gray-300 uppercase">Alerts</h3>
                <span className="text-[10px] bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full font-bold">
                  {criticalAlerts.length} Active
                </span>
              </div>
              <button
                onClick={() => navigateWithDate('/alerts')}
                className="text-xs text-blue-500 hover:text-blue-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                View All ➔
              </button>
            </div>

            {/* Scrollable list inside the card (height stays strictly fixed) */}
            <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-2 flex flex-col gap-1.5">
              {paginatedAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-xs text-gray-500 gap-2">
                  <AlertTriangle size={28} className="opacity-30 text-gray-400" />
                  <span>No active critical alerts</span>
                </div>
              ) : (
                paginatedAlerts.map((alert, i) => (
                  <div
                    key={`alert-${alert.id || 'item'}-${i}`}
                    onClick={() => {
                      const matchedCam = cameraFilter.allCameras?.find(c =>
                        (alert.camera && (c.name === alert.camera || c.label === alert.camera || c.camera_code === alert.camera || c.rtsp_url === alert.camera)) ||
                        (alert.loc && (c.location === alert.loc || c.name === alert.loc))
                      );
                      if (matchedCam) {
                        setSelectedMapCamera(matchedCam);
                        setTargetMapCamera({ ...matchedCam, _ts: Date.now() });
                      }
                    }}
                    className="p-2 bg-gray-100 dark:bg-black/20 rounded-lg flex items-start justify-between border border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-black/40 transition-colors cursor-pointer shrink-0"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-full ${alert.bg} flex items-center justify-center shrink-0`}>
                        <alert.icon size={13} className={alert.text} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 dark:text-white mb-0.5 truncate">{alert.title}</div>
                        <div className="text-[10px] text-gray-400 truncate">{alert.loc}</div>
                      </div>
                    </div>
                    <div className="text-[9px] text-gray-500 font-medium whitespace-nowrap mt-1 ml-2 shrink-0">{alert.time}</div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination & Records Per Page Footer */}
            <div className="p-2 px-3 border-t border-gray-200 dark:border-blue-900/40 bg-gray-50/50 dark:bg-[#151e32]/50 backdrop-blur-sm flex items-center justify-between shrink-0 text-xs">
              {/* Records Per Page Dropdown */}
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                <span className="font-semibold uppercase tracking-wider">Per page:</span>
                <select
                  value={alertRecordsPerPage}
                  onChange={(e) => {
                    setAlertRecordsPerPage(Number(e.target.value));
                    setAlertCurrentPage(1);
                  }}
                  className="px-1.5 py-0.5 text-[11px] font-bold bg-white dark:bg-[#1f293d] border border-gray-300 dark:border-blue-900/60 rounded text-gray-800 dark:text-gray-200 outline-none cursor-pointer hover:border-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value={7}>7</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Range & Navigation Controls */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                  {criticalAlerts.length > 0 ? (
                    <>
                      <span className="font-bold text-gray-700 dark:text-gray-200">{startAlertIdx + 1}</span>-
                      <span className="font-bold text-gray-700 dark:text-gray-200">{Math.min(startAlertIdx + alertRecordsPerPage, criticalAlerts.length)}</span> of{' '}
                      <span className="font-bold text-gray-700 dark:text-gray-200">{criticalAlerts.length}</span>
                    </>
                  ) : (
                    '0 of 0'
                  )}
                </span>
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => setAlertCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentAlertPageSafe <= 1}
                    title="Previous Page"
                    className="p-1 rounded bg-white dark:bg-[#1f293d] border border-gray-300 dark:border-blue-900/60 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#28354f] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 px-0.5 min-w-[24px] text-center">
                    {currentAlertPageSafe}/{totalAlertPages}
                  </span>
                  <button
                    onClick={() => setAlertCurrentPage(prev => Math.min(prev + 1, totalAlertPages))}
                    disabled={currentAlertPageSafe >= totalAlertPages}
                    title="Next Page"
                    className="p-1 rounded bg-white dark:bg-[#1f293d] border border-gray-300 dark:border-blue-900/60 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#28354f] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Heavy Vehicle Detections Pie Chart Overview */}
          <div className="bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border border-gray-200 dark:border-blue-900/40 rounded-2xl flex flex-col overflow-hidden shadow-xl h-[280px] shrink-0">
            <div className="p-3 border-b border-gray-200 dark:border-blue-900/40 flex justify-between items-center bg-gray-50/50 dark:bg-[#151e32]/50 backdrop-blur-sm">
              <h3 className="text-[11px] font-bold tracking-widest text-gray-600 dark:text-gray-300 uppercase flex items-center gap-1.5">
                <Truck size={14} className="text-amber-500" /> Heavy Vehicle Detections Overview
              </h3>
              <button
                onClick={() => navigateWithDate('/vehicle-count')}
                className="text-xs text-blue-500 hover:text-blue-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                View All ➔
              </button>
            </div>
            <div className="flex-1 p-2 flex items-center justify-center overflow-hidden">
              {heavyVehiclePieData.length > 0 ? (
                <InteractivePieChart
                  data={heavyVehiclePieData}
                  themeUtils={themeUtils}
                  customSize={130}
                  layout="horizontal"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 opacity-60">
                  <Truck size={32} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    No heavy vehicle detections for date range
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

