import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../ui/Settings/themeUtils';
import PageHeader from '../../ui/common/PageHeader';
import GlobalCameraFilter from '../../ui/common/GlobalCameraFilter';
import useCameraFilter from '../../hooks/useCameraFilter';
import RecordsPerPage from '../../ui/common/RecordsPerPage';
import Pagination from '../../ui/common/Pagination';
import RightSideDialog from '../../ui/common/RightSideDialog';
import DateRangePicker from '../../ui/common/DateRangePicker';
import BottomStatCard from '../../ui/common/BottomStatCard';
import {
  Filter,
  AlertTriangle,
  Clock,
  MapPin,
  Camera,
  AlertOctagon,
  Calendar,
  Eye,
  Image as ImageIcon,
  RefreshCw,
  Download,
  Siren,
  TrendingUp,
  Activity,
  Layers,
  PieChart as PieIcon,
  BarChart2
} from 'lucide-react';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { API_BASE_URL } from '../../../config.js';
import { getTodayStr, toLocalDateStr } from '../../utils/dateUtils';
import { useToast } from '../../ui/common/CustomToast';

function getImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith('data:')) return imagePath;
  if (imagePath.startsWith('http')) return imagePath;
  const cleanPath = imagePath.replace(/\\/g, '/');
  return `${API_BASE_URL}/${cleanPath}`;
}

export default function Alerts() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [fromDate, setFromDate] = useState(() => location.state?.fromDate || searchParams.get('fromDate') || "");
  const [toDate, setToDate] = useState(() => location.state?.toDate || searchParams.get('toDate') || "");

  useEffect(() => {
    const from = location.state?.fromDate || searchParams.get('fromDate') || "";
    const to = location.state?.toDate || searchParams.get('toDate') || "";
    setFromDate(from);
    setToDate(to);
  }, [location.pathname, location.search, location.key]);

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('All');

  // Camera, Zone & Location Global Filter Hook
  const cameraFilter = useCameraFilter(null);

  // Modal State for View Action
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Pagination & Records per page state
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [alertsList, setAlertsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts?limit=500`);
      const data = await res.json();
      if (data.success && data.alerts) {
        setAlertsList(data.alerts);
      }
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAlerts();
    if (cameraFilter?.refetch) {
      await cameraFilter.refetch();
    }
    toast?.info?.("Refreshed", "System alerts updated");
    setTimeout(() => setIsRefreshing(false), 600);
  };

  useEffect(() => {
    fetchAlerts();
    const intervalId = setInterval(fetchAlerts, 3000); // refresh every 3 seconds

    return () => clearInterval(intervalId);
  }, [fetchAlerts, refreshKey]);

  // Zone map for name resolution
  const zoneNameMap = useMemo(() => {
    const map = {};
    (cameraFilter.availableOptions?.zones || []).forEach(z => {
      map[String(z.id || z.zone_id)] = z.name || z.zone || '';
    });
    return map;
  }, [cameraFilter.availableOptions?.zones]);

  // Helper to extract Camera & Zone info for an alert record
  const getAlertCameraAndZone = (alert) => {
    const allCams = cameraFilter.allCameras || [];
    const rawCam = alert.camera || alert.camera_name || alert.camera_code || alert.cam;
    const rawLoc = alert.loc || alert.location;
    const rawZone = alert.zone || alert.zone_name;

    const matchedCam = allCams.find(c =>
      (rawCam && (String(c.value) === String(rawCam) || String(c.id) === String(rawCam) || c.label === rawCam || c.name === rawCam)) ||
      (rawLoc && (c.location === rawLoc || String(c.location_id) === String(alert.location_id)))
    );

    const camName = rawCam || matchedCam?.label || matchedCam?.name || '—';
    const zoneName = rawZone || matchedCam?.zone_name || zoneNameMap[String(alert.zone_id || matchedCam?.zone_id)] || '—';
    const locName = rawLoc || matchedCam?.location || '—';

    return {
      camName,
      zoneName,
      locName,
      camId: matchedCam?.value || matchedCam?.id || rawCam,
      zoneId: alert.zone_id || matchedCam?.zone_id,
      locId: alert.location_id || matchedCam?.location_id
    };
  };

  // Filtered dataset
  const filteredAlerts = useMemo(() => {
    const query = (cameraFilter.filters.searchQuery || '').trim().toLowerCase();
    const selZone = cameraFilter.filters.zone;
    const selLoc = cameraFilter.filters.location;
    const selCam = cameraFilter.filters.cameraId;

    return alertsList.filter(alert => {
      const alertDateStr = toLocalDateStr(alert.date || alert.time || alert.detected_at || alert.created_at);
      let matchesDate = true;
      if (fromDate && alertDateStr && alertDateStr < fromDate) matchesDate = false;
      if (toDate && alertDateStr && alertDateStr > toDate) matchesDate = false;

      if (!matchesDate) return false;

      const { camName, zoneName, locName, camId, zoneId, locId } = getAlertCameraAndZone(alert);

      // Zone filter
      if (selZone) {
        const zoneMatch = String(zoneId) === String(selZone) ||
          zoneName.toLowerCase() === (zoneNameMap[String(selZone)] || '').toLowerCase();
        if (!zoneMatch) return false;
      }

      // Location filter
      if (selLoc) {
        const locMatch = String(locId) === String(selLoc) ||
          locName.toLowerCase() === (cameraFilter.availableOptions.locations?.find(l => String(l.id) === String(selLoc))?.name || '').toLowerCase();
        if (!locMatch) return false;
      }

      // Camera filter
      if (selCam) {
        const camMatch = String(camId) === String(selCam) ||
          camName.toLowerCase() === (cameraFilter.allCameras?.find(c => String(c.value) === String(selCam))?.label || '').toLowerCase();
        if (!camMatch) return false;
      }

      // Severity filter
      if (severityFilter !== 'All' && alert.severity !== severityFilter) {
        return false;
      }

      // Search query filter
      if (query) {
        const matchesSearch =
          String(alert.id || '').toLowerCase().includes(query) ||
          String(alert.type || '').toLowerCase().includes(query) ||
          locName.toLowerCase().includes(query) ||
          camName.toLowerCase().includes(query) ||
          zoneName.toLowerCase().includes(query) ||
          String(alert.severity || '').toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [alertsList, cameraFilter.filters, cameraFilter.allCameras, cameraFilter.availableOptions, zoneNameMap, fromDate, toDate, severityFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [cameraFilter.filters.searchQuery, cameraFilter.filters.zone, cameraFilter.filters.location, cameraFilter.filters.cameraId, fromDate, toDate, severityFilter, itemsPerPage]);

  // Dynamic Metrics Calculation
  const stats = useMemo(() => {
    const total = filteredAlerts.length;
    const criticalHigh = filteredAlerts.filter(a => a.severity === 'Critical' || a.severity === 'High').length;
    const uniqueLocs = new Set(filteredAlerts.map(a => a.loc).filter(Boolean)).size;
    const todayStr = getTodayStr();
    const todayCount = filteredAlerts.filter(a => {
      const dStr = toLocalDateStr(a.date || a.time || a.detected_at || a.created_at);
      return dStr === todayStr;
    }).length;

    return { total, criticalHigh, uniqueLocs, todayCount };
  }, [filteredAlerts]);

  // Default 7-day date window (today and past 6 days)
  const { defaultStartDate, defaultEndDate } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return {
      defaultStartDate: toLocalDateStr(start),
      defaultEndDate: toLocalDateStr(end)
    };
  }, []);

  const activeStartDate = fromDate || defaultStartDate;
  const activeEndDate = toDate || defaultEndDate;

  // Alerts within the recent 7 days (or user-selected date range)
  const pieAlerts = useMemo(() => {
    return filteredAlerts.filter(a => {
      const dStr = toLocalDateStr(a.date || a.time || a.detected_at || a.created_at);
      if (!dStr) return true;
      if (activeStartDate && dStr < activeStartDate) return false;
      if (activeEndDate && dStr > activeEndDate) return false;
      return true;
    });
  }, [filteredAlerts, activeStartDate, activeEndDate]);

  // Dynamic Pie Data: Alerts Breakdown by Type (Recent 7 Days)
  const pieData = useMemo(() => {
    const typeCounts = {};
    pieAlerts.forEach(a => {
      const t = a.type || 'Other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4'];
    return Object.entries(typeCounts).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length]
    }));
  }, [pieAlerts]);

  // Dynamic Bar Data: Alert Volume Trend (Last 7 Days ending on current date)
  const barData = useMemo(() => {
    const dateCounts = {};
    alertsList.forEach(a => {
      const dStr = toLocalDateStr(a.date || a.time || a.detected_at || a.created_at);
      if (dStr) {
        dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
      }
    });

    let endDate = new Date();
    if (toDate) {
      endDate = new Date(toDate);
    }

    let startDate;
    if (fromDate) {
      startDate = new Date(fromDate);
    } else {
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);
    }

    const result = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, '0');
      const day = String(curr.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;

      result.push({
        date: `${day}-${month}`,
        count: dateCounts[key] || 0
      });
      curr.setDate(curr.getDate() + 1);
    }

    return result;
  }, [alertsList, fromDate, toDate]);

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedAlerts = useMemo(() => {
    if (!sortConfig.key) return filteredAlerts;

    return [...filteredAlerts].sort((a, b) => {
      let valA, valB;
      const { camName: camA, zoneName: zoneA, locName: locA } = getAlertCameraAndZone(a);
      const { camName: camB, zoneName: zoneB, locName: locB } = getAlertCameraAndZone(b);

      switch (sortConfig.key) {
        case 'id':
          valA = a.id || '';
          valB = b.id || '';
          break;
        case 'type':
          valA = a.type || '';
          valB = b.type || '';
          break;
        case 'zone':
          valA = zoneA || '';
          valB = zoneB || '';
          break;
        case 'location':
          valA = locA || '';
          valB = locB || '';
          break;
        case 'camera':
          valA = camA || '';
          valB = camB || '';
          break;
        case 'date':
          valA = a.date || a.detected_at || a.time || '';
          valB = b.date || b.detected_at || b.time || '';
          break;
        case 'time':
          valA = a.time || '';
          valB = b.time || '';
          break;
        case 'severity':
          valA = a.severity || '';
          valB = b.severity || '';
          break;
        default:
          valA = a[sortConfig.key] || '';
          valB = b[sortConfig.key] || '';
      }

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (!isNaN(valA) && !isNaN(valB) && valA !== '' && valB !== '') {
        return sortConfig.direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }

      const dateA = new Date(valA);
      const dateB = new Date(valB);
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime()) && typeof valA === 'string' && (valA.includes('-') || valA.includes('/'))) {
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

      return sortConfig.direction === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredAlerts, sortConfig, getAlertCameraAndZone]);

  // Paginated Slicing
  const totalItems = sortedAlerts.length;
  const paginatedAlerts = useMemo(() => {
    if (itemsPerPage === null || itemsPerPage === Infinity || !itemsPerPage) {
      return sortedAlerts.map((item, idx) => ({ ...item, srNo: idx + 1 }));
    }
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAlerts.slice(start, start + itemsPerPage).map((item, idx) => ({
      ...item,
      srNo: start + idx + 1
    }));
  }, [sortedAlerts, currentPage, itemsPerPage]);

  const handleOpenViewModal = (alert) => {
    setSelectedAlert(alert);
    setIsModalOpen(true);
  };

  const isDark = theme.mode === "Dark";
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor("card");

  return (
    <div className="flex flex-col gap-4 w-full h-full text-gray-900 dark:text-white font-sans overflow-y-auto pb-6">
      {/* Page Header */}
      <PageHeader
        title="System Alerts Log"
        subtitle="Comprehensive log of all AI-generated traffic alerts"
        icon={Siren}
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 h-[34px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => {
                import('../../utils/exportUtils').then(({ exportToCSV }) => {
                  exportToCSV(filteredAlerts, 'system_alerts_export');
                });
              }}
              className="flex items-center gap-2 px-3 py-1.5 h-[34px] bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg text-xs font-bold transition-all border border-green-500/30 shadow-sm shrink-0 cursor-pointer"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        }
      />

      {/* Dynamic Informative Stats Cards Row (Same as Dashboard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <BottomStatCard
          icon={<Siren size={22} className="text-blue-500" />}
          title="TOTAL SYSTEM ALERTS"
          value={stats.total}
          subtitle="Filtered Record Count"
        />
        <BottomStatCard
          icon={<AlertOctagon size={22} className="text-red-500" />}
          title="CRITICAL / HIGH ALERTS"
          value={stats.criticalHigh}
          subtitle="High Priority Incidents"
        />
        <BottomStatCard
          icon={<MapPin size={22} className="text-purple-500" />}
          title="HOTSPOT LOCATIONS"
          value={stats.uniqueLocs}
          subtitle="Unique Monitored Sites"
        />
        <BottomStatCard
          icon={<Clock size={22} className="text-emerald-500" />}
          title="TODAY'S DETECTIONS"
          value={stats.todayCount}
          subtitle="Logged Last 24 Hours"
        />
      </div>

      {/* Informative Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart: Alert Breakdown by Type (Recent 7 Days) */}
        <div
          className="p-5 rounded-2xl border border-gray-200 dark:border-blue-900/40 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md shadow-xl flex flex-col h-[300px]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PieIcon size={16} className="text-blue-500 shrink-0" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.headerBg || '#3b82f6' }}>
                  Alert Breakdown by Type (Recent 7 Days)
                </h3>
                <p className="text-[10px] font-medium opacity-75" style={{ color: textSecondary }}>
                  {fromDate && toDate
                    ? `Date Range: ${fromDate} to ${toDate} • ${pieAlerts.length} records`
                    : fromDate
                      ? `From ${fromDate} onwards • ${pieAlerts.length} records`
                      : toDate
                        ? `Up to ${toDate} • ${pieAlerts.length} records`
                        : `Past 7 Days (${defaultStartDate} to ${defaultEndDate}) • ${pieAlerts.length} alerts`}
                </p>
              </div>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'rgba(59, 130, 246, 0.3)',
                color: '#3b82f6'
              }}
            >
              {fromDate || toDate ? 'Filtered Date Scope' : 'Recent 7 Days'}
            </span>
          </div>

          <div className="flex-1 w-full min-h-0">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: cardBg,
                      borderColor: borderColor,
                      borderRadius: '8px',
                      color: textPrimary,
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }}
                    itemStyle={{ color: textPrimary, fontWeight: 'bold' }}
                    labelStyle={{ color: textPrimary, fontWeight: 'bold' }}
                    formatter={(value, name) => [`${value} Alerts`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span style={{ color: textPrimary, fontSize: '11px', fontWeight: '600' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                No alert type data available
              </div>
            )}
          </div>
        </div>

        {/* Bar Chart: Alert Volume Trend (Last 7 Days) */}
        <div
          className="p-5 rounded-2xl border border-gray-200 dark:border-blue-900/40 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md shadow-xl flex flex-col h-[300px]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-blue-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.headerBg || '#3b82f6' }}>
                Alert Volume Trend (Last 7 Days)
              </h3>
            </div>
            <span className="text-[10px] font-semibold opacity-60" style={{ color: textSecondary }}>
              Date Format (DD-MM)
            </span>
          </div>

          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: textSecondary, fontSize: 11, fontWeight: 'bold' }}
                  axisLine={{ stroke: borderColor }}
                />
                <YAxis
                  tick={{ fill: textSecondary, fontSize: 11 }}
                  axisLine={{ stroke: borderColor }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: cardBg,
                    borderColor: borderColor,
                    borderRadius: '8px',
                    color: textPrimary,
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                  }}
                  itemStyle={{ color: textPrimary, fontWeight: 'bold' }}
                  labelStyle={{ color: textPrimary, fontWeight: 'bold' }}
                  formatter={(value) => [`${value} Alerts`, 'Volume']}
                />
                <Bar
                  dataKey="count"
                  name="Alerts"
                  fill={theme.headerBg || '#3b82f6'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Container Card: Toolbar & Data Table */}
      <div
        className="flex flex-col gap-4 p-4 rounded-2xl border border-gray-200 dark:border-blue-900/40 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md shadow-xl flex-1 overflow-hidden"
      >
        {/* Header Toolbar: Title/Records on Left, Search & Filters on Right */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3 shrink-0">
            <RecordsPerPage
              value={itemsPerPage}
              onChange={(val) => {
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              options={[5, 10, 25, 50]}
              label="Show"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 justify-start xl:justify-end w-full xl:w-auto">
            {/* Global Camera Filter (Search, Zone, Location, Camera) */}
            <GlobalCameraFilter cameraFilter={cameraFilter} hideCamera={false} />

            {/* Date Range Picker */}
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onFromChange={setFromDate}
              onToChange={setToDate}
            />

            {/* Severity Dropdown Filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`flex items-center gap-2 px-3 h-[34px] rounded-lg text-xs font-semibold transition-all border ${showFilterMenu ? 'shadow-md scale-105' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                style={{
                  borderColor,
                  color: showFilterMenu ? (theme.headerBg || '#3b82f6') : textPrimary,
                  backgroundColor: showFilterMenu ? `${theme.headerBg || '#3b82f6'}15` : 'transparent'
                }}
              >
                <Filter className="w-3.5 h-3.5" /> Severity: {severityFilter}
              </button>

              {showFilterMenu && (
                <div className="absolute top-full mt-2 right-0 z-50 w-40 rounded-xl shadow-lg border p-2 animate-fade-in" style={{ backgroundColor: cardBg, borderColor }}>
                  <div className="text-[10px] font-bold mb-1.5 px-2 uppercase opacity-60" style={{ color: textPrimary }}>Severity Filter</div>
                  {['All', 'Critical', 'High', 'Medium', 'Low'].map(sev => (
                    <button
                      key={sev}
                      onClick={() => { setSeverityFilter(sev); setShowFilterMenu(false); }}
                      className="w-full text-left px-3 py-1 rounded-md text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      style={{
                        color: textPrimary,
                        backgroundColor: severityFilter === sev ? `${theme.headerBg || '#3b82f6'}20` : 'transparent'
                      }}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Standard Page Table Component */}
        <div
          className="border rounded-lg shadow-sm overflow-x-auto flex-1"
          style={{ backgroundColor: cardBg, borderColor }}
        >
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr style={theme.headerBg?.includes("gradient") ? { background: theme.headerBg } : { backgroundColor: theme.headerBg || "#3b82f6" }}>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b w-12 text-white" style={{ borderColor: `${borderColor}40` }}>SR.NO</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b w-16 text-white" style={{ borderColor: `${borderColor}40` }}>IMAGE</th>
                <th
                  onClick={() => handleSort('id')}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b min-w-[90px] cursor-pointer select-none hover:opacity-90 transition-opacity text-white"
                  style={{ borderColor: `${borderColor}40` }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>ALERT ID</span>
                    <span className="inline-flex items-center text-[10px] text-white">
                      {sortConfig.key !== 'id' && <FaSort className="opacity-60" />}
                      {sortConfig.key === 'id' && sortConfig.direction === 'asc' && <FaSortUp className="text-white" />}
                      {sortConfig.key === 'id' && sortConfig.direction === 'desc' && <FaSortDown className="text-white" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('type')}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b min-w-[150px] cursor-pointer select-none hover:opacity-90 transition-opacity text-white"
                  style={{ borderColor: `${borderColor}40` }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>ALERT TYPE</span>
                    <span className="inline-flex items-center text-[10px] text-white">
                      {sortConfig.key !== 'type' && <FaSort className="opacity-60" />}
                      {sortConfig.key === 'type' && sortConfig.direction === 'asc' && <FaSortUp className="text-white" />}
                      {sortConfig.key === 'type' && sortConfig.direction === 'desc' && <FaSortDown className="text-white" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('zone')}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b min-w-[120px] cursor-pointer select-none hover:opacity-90 transition-opacity text-white"
                  style={{ borderColor: `${borderColor}40` }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>ZONE</span>
                    <span className="inline-flex items-center text-[10px] text-white">
                      {sortConfig.key !== 'zone' && <FaSort className="opacity-60" />}
                      {sortConfig.key === 'zone' && sortConfig.direction === 'asc' && <FaSortUp className="text-white" />}
                      {sortConfig.key === 'zone' && sortConfig.direction === 'desc' && <FaSortDown className="text-white" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('location')}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b min-w-[140px] cursor-pointer select-none hover:opacity-90 transition-opacity text-white"
                  style={{ borderColor: `${borderColor}40` }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>LOCATION</span>
                    <span className="inline-flex items-center text-[10px] text-white">
                      {sortConfig.key !== 'location' && <FaSort className="opacity-60" />}
                      {sortConfig.key === 'location' && sortConfig.direction === 'asc' && <FaSortUp className="text-white" />}
                      {sortConfig.key === 'location' && sortConfig.direction === 'desc' && <FaSortDown className="text-white" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('camera')}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b min-w-[140px] cursor-pointer select-none hover:opacity-90 transition-opacity text-white"
                  style={{ borderColor: `${borderColor}40` }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>CAMERA NAME</span>
                    <span className="inline-flex items-center text-[10px] text-white">
                      {sortConfig.key !== 'camera' && <FaSort className="opacity-60" />}
                      {sortConfig.key === 'camera' && sortConfig.direction === 'asc' && <FaSortUp className="text-white" />}
                      {sortConfig.key === 'camera' && sortConfig.direction === 'desc' && <FaSortDown className="text-white" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b min-w-[90px] cursor-pointer select-none hover:opacity-90 transition-opacity text-white"
                  style={{ borderColor: `${borderColor}40` }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>DATE</span>
                    <span className="inline-flex items-center text-[10px] text-white">
                      {sortConfig.key !== 'date' && <FaSort className="opacity-60" />}
                      {sortConfig.key === 'date' && sortConfig.direction === 'asc' && <FaSortUp className="text-white" />}
                      {sortConfig.key === 'date' && sortConfig.direction === 'desc' && <FaSortDown className="text-white" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('time')}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b min-w-[80px] cursor-pointer select-none hover:opacity-90 transition-opacity text-white"
                  style={{ borderColor: `${borderColor}40` }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>TIME</span>
                    <span className="inline-flex items-center text-[10px] text-white">
                      {sortConfig.key !== 'time' && <FaSort className="opacity-60" />}
                      {sortConfig.key === 'time' && sortConfig.direction === 'asc' && <FaSortUp className="text-white" />}
                      {sortConfig.key === 'time' && sortConfig.direction === 'desc' && <FaSortDown className="text-white" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('severity')}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b min-w-[100px] cursor-pointer select-none hover:opacity-90 transition-opacity text-white"
                  style={{ borderColor: `${borderColor}40` }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>SEVERITY</span>
                    <span className="inline-flex items-center text-[10px] text-white">
                      {sortConfig.key !== 'severity' && <FaSort className="opacity-60" />}
                      {sortConfig.key === 'severity' && sortConfig.direction === 'asc' && <FaSortUp className="text-white" />}
                      {sortConfig.key === 'severity' && sortConfig.direction === 'desc' && <FaSortDown className="text-white" />}
                    </span>
                  </div>
                </th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b w-20 text-center text-white" style={{ borderColor: `${borderColor}40` }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11} className="py-8 text-center text-xs" style={{ color: textSecondary }}>Loading alerts...</td></tr>
              ) : paginatedAlerts.length > 0 ? (
                paginatedAlerts.map((row) => {
                  const imgSrc = getImageUrl(row.image);
                  const { camName, zoneName, locName } = getAlertCameraAndZone(row);
                  return (
                    <tr key={row.srNo} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor }}>
                      <td className="px-3 py-2.5 text-xs"><span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max inline-block">{row.srNo}</span></td>
                      <td className="px-3 py-2.5 text-xs">
                        <div className="w-12 h-9 rounded bg-black/20 border overflow-hidden flex items-center justify-center relative shrink-0" style={{ borderColor }}>
                          {imgSrc ? (
                            <img src={imgSrc} alt="Alert Snapshot" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={14} className="opacity-40" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono font-bold opacity-80">{row.id}</td>
                      <td className="px-3 py-2.5 text-xs font-bold flex items-center gap-2">
                        {row.severity === 'Critical' ? (
                          <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <AlertTriangle className={`w-4 h-4 shrink-0 ${row.severity === 'High' ? 'text-orange-500' : 'text-yellow-500'}`} />
                        )}
                        <span>{row.type}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 text-[11px] font-semibold inline-block">
                          {zoneName}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <div className="flex items-center gap-1.5 opacity-90">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{locName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {camName}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{row.date || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{row.time || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${row.severity === 'Critical' ? 'bg-red-500/20 text-red-500' :
                          row.severity === 'High' ? 'bg-orange-500/20 text-orange-500' : 'bg-yellow-500/20 text-yellow-600'
                          }`}>
                          {row.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-center">
                        <button
                          onClick={() => handleOpenViewModal(row)}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={11} className="py-6 text-center text-xs" style={{ color: textSecondary }}>No alerts found. Try adjusting your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Component */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredAlerts.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* View Alert Details Modal */}
      <RightSideDialog
        visible={isModalOpen}
        onHide={() => setIsModalOpen(false)}
        header="Alert Details"
      >
        {selectedAlert && (() => {
          const selectedMeta = getAlertCameraAndZone(selectedAlert);
          return (
            <div className="flex flex-col gap-5 pt-2">
              {/* Snapshot Image */}
              <div className="w-full rounded-xl overflow-hidden border bg-slate-900 flex items-center justify-center min-h-[180px]" style={{ borderColor }}>
                {getImageUrl(selectedAlert.image) ? (
                  <img src={getImageUrl(selectedAlert.image)} alt="Alert Snapshot" className="w-full max-h-64 object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-6 text-gray-400">
                    <ImageIcon size={32} />
                    <span className="text-xs">No snapshot image available</span>
                  </div>
                )}
              </div>

              {/* Alert Summary Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Alert ID</p>
                  <p className="font-mono font-bold text-sm" style={{ color: textPrimary }}>{selectedAlert.id}</p>
                </div>

                <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Severity</p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md inline-block ${selectedAlert.severity === 'Critical' ? 'bg-red-500/20 text-red-500' :
                    selectedAlert.severity === 'High' ? 'bg-orange-500/20 text-orange-500' : 'bg-yellow-500/20 text-yellow-600'
                    }`}>
                    {selectedAlert.severity}
                  </span>
                </div>

                <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Alert Type</p>
                  <p className="font-bold text-xs text-blue-500 truncate" title={selectedAlert.type}>{selectedAlert.type}</p>
                </div>

                <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Zone</p>
                  <p className="font-semibold text-xs truncate" style={{ color: textPrimary }} title={selectedMeta.zoneName}>{selectedMeta.zoneName}</p>
                </div>

                <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Camera Name</p>
                  <p className="font-semibold text-xs truncate" style={{ color: textPrimary }} title={selectedMeta.camName}>{selectedMeta.camName}</p>
                </div>

                <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Location</p>
                  <p className="font-semibold text-xs truncate" style={{ color: textPrimary }} title={selectedMeta.locName}>{selectedMeta.locName}</p>
                </div>

                <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Detection Date</p>
                  <p className="font-mono text-xs font-semibold" style={{ color: textPrimary }}>{selectedAlert.date || 'N/A'}</p>
                </div>

                <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Detection Time</p>
                  <p className="font-mono text-xs font-semibold" style={{ color: textPrimary }}>{selectedAlert.time || 'N/A'}</p>
                </div>
              </div>
            </div>
          );
        })()}
      </RightSideDialog>
    </div>
  );
}
