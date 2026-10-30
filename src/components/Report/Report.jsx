import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  Ban,
  ArrowRightLeft,
  AlertTriangle,
  Truck,
  Eye,
  Camera as CameraIcon,
  RefreshCw,
  Download,
  Clock,
  MapPin,
  CalendarDays,
  Gauge,
  LogIn,
  LogOut,
  Layers,
  Siren,
  Boxes
} from 'lucide-react';
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
import { useTheme } from '../../ui/Settings/themeUtils';
import PageHeader from '../../ui/common/PageHeader';
import PaginatedTable from '../../ui/common/PaginatedTable';
import DateRangePicker from '../../ui/common/DateRangePicker';
import SearchBar from '../../ui/common/SearchBar';
import RightSideDialog from '../../ui/common/RightSideDialog';
import { useToast } from '../../ui/common/CustomToast';
import { getTodayStr, toLocalDateStr } from '../../utils/dateUtils';
import { API_BASE_URL } from '../../../config';

function getImageUrl(relativePath) {
  if (!relativePath) return null;
  const urlPath = relativePath.replace(/\\/g, '/').replace(/^\//, '');
  return `${API_BASE_URL}/${urlPath}`;
}

function getViolationImageSrc(row) {
  if (row.violation_image_path) return getImageUrl(row.violation_image_path);
  if (row.image_path) return getImageUrl(row.image_path);
  if (row.image_base64) return row.image_base64.startsWith('data:') ? row.image_base64 : `data:image/jpeg;base64,${row.image_base64}`;
  if (row.violation_image_base64) return row.violation_image_base64.startsWith('data:') ? row.violation_image_base64 : `data:image/jpeg;base64,${row.violation_image_base64}`;
  if (row.image) return row.image.startsWith('data:') ? row.image : `data:image/jpeg;base64,${row.image}`;
  if (row.frame) return row.frame.startsWith('data:') ? row.frame : `data:image/jpeg;base64,${row.frame}`;
  return null;
}

// Resolve a usable JS Date from the many possible timestamp shapes in the data
function getRowDate(row) {
  if (row.detected_at) return new Date(row.detected_at);
  if (row.timestamp) return new Date(row.timestamp);
  if (row.event_timestamp) return new Date(row.event_timestamp);
  if (row.time) {
    // "YYYY-MM-DD HH:mm:ss" style string
    const normalized = row.time.includes('T') ? row.time : row.time.replace(' ', 'T');
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;
  }
  if (row.time_str) {
    const normalized = row.time_str.includes('T') ? row.time_str : row.time_str.replace(' ', 'T');
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function getRowLocation(row) {
  return row.location || row.location_name || row.camera_name || 'Unknown';
}

// Format YYYY-MM-DD to DD-MM for chart labels
function formatDDMM(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}`;
  }
  return dateStr;
}

// Build a list of consecutive YYYY-MM-DD date strings for the chart X-axis
function getChartDateRange(rows, fromDate, toDate) {
  if (fromDate && toDate) {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const dates = [];
      const curr = new Date(start);
      let count = 0;
      while (curr <= end && count < 90) {
        dates.push(toLocalDateStr(curr));
        curr.setDate(curr.getDate() + 1);
        count++;
      }
      if (dates.length > 0) return dates;
    }
  }

  let endDateObj = new Date(); // Defaults to current date (e.g. 16-09)
  if (toDate) {
    const d = new Date(toDate);
    if (!isNaN(d.getTime())) endDateObj = d;
  }

  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDateObj);
    d.setDate(d.getDate() - i);
    last7Days.push(toLocalDateStr(d));
  }
  return last7Days;
}

const CHART_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Small reusable stat card
function StatCard({ icon: Icon, label, value, sub, color, cardBg, borderColor, textSecondary }) {
  return (
    <div
      className="flex items-center gap-3 p-3.5 rounded-xl border shadow-sm min-w-0"
      style={{ backgroundColor: cardBg, borderColor }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
        style={{ backgroundColor: `${color}1A`, color }}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70 truncate" style={{ color: textSecondary }}>
          {label}
        </p>
        <p className="text-xl font-bold leading-tight truncate">{value}</p>
        {sub ? <p className="text-[11px] opacity-60 truncate" style={{ color: textSecondary }}>{sub}</p> : null}
      </div>
    </div>
  );
}

// Custom tooltip so charts follow the app's card styling instead of the recharts default
function ChartTooltip({ active, payload, label, cardBg, borderColor, textPrimary }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg border shadow-lg text-xs"
      style={{ backgroundColor: cardBg, borderColor, color: textPrimary }}
    >
      {label ? <p className="font-semibold mb-1">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function Report() {
  const { theme, themeUtils } = useTheme();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('no_parking');

  // Tab-isolated date filters: each tab maintains its own independent date range filter
  const [tabDateFilters, setTabDateFilters] = useState(() => ({
    no_parking: { fromDate: searchParams.get('fromDate') || "", toDate: searchParams.get('toDate') || "" },
    in_out: { fromDate: "", toDate: "" },
    incident: { fromDate: "", toDate: "" },
    heavy_vehicle: { fromDate: "", toDate: "" },
  }));

  const fromDate = tabDateFilters[activeTab]?.fromDate || "";
  const toDate = tabDateFilters[activeTab]?.toDate || "";

  const setFromDate = (val) => {
    setTabDateFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        fromDate: typeof val === 'function' ? val(prev[activeTab]?.fromDate || "") : val
      }
    }));
  };

  const setToDate = (val) => {
    setTabDateFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        toDate: typeof val === 'function' ? val(prev[activeTab]?.toDate || "") : val
      }
    }));
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const tabs = [
    { id: 'no_parking', label: 'No Parking', icon: Ban },
    { id: 'in_out', label: 'In/Out Count', icon: ArrowRightLeft },
    { id: 'incident', label: 'AI Incident', icon: AlertTriangle },
    { id: 'heavy_vehicle', label: 'Heavy Vehicle', icon: Truck },
  ];

  const fetchData = async (isSilent = false) => {
    if (!API_BASE_URL) return;
    if (!isSilent) setLoading(true);
    try {
      const endpoint = `/api/reports?module=${activeTab}&startDate=${fromDate}&endDate=${toDate}&limit=1000`;
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      const result = await response.json();

      let records = result.data || result.violations || result.events || result.incidents || result.rows || [];
      if (!Array.isArray(records)) {
        records = [];
      }

      setData(records.map((item, index) => ({ ...item, srNo: index + 1 })));
    } catch (error) {
      console.error(`Error fetching data for ${activeTab}:`, error);
      if (!isSilent) setData([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => fetchData(true), 3000);
    return () => clearInterval(interval);
  }, [activeTab, fromDate, toDate]);

  const handleViewDetails = async (record) => {
    const recordId = record.id || record.violation_id || record.event_id || record.incident_id;
    if (recordId && API_BASE_URL) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/reports/${activeTab}/${recordId}`);
        if (res.ok) {
          const detailRes = await res.json();
          if (detailRes.success && detailRes.data) {
            setSelectedRecord({ ...record, ...detailRes.data });
            setIsModalOpen(true);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed fetching detail record, using row data:", err);
      }
    }
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleRefresh = () => {
    fetchData();
    toast.success("Data Refreshed", "Latest records loaded successfully.");
  };

  const handleExportExcel = () => {
    if (!filteredData || filteredData.length === 0) return;

    // Get headers based on active tab (exclude action/image columns)
    const cols = getColumns().filter(c => c.accessor !== 'action' && c.accessor !== 'image');

    // Create CSV string
    const headers = cols.map(c => `"${c.header}"`).join(',');
    const rows = filteredData.map(row => {
      return cols.map(c => {
        let val = '';
        if (c.accessor === 'date') val = row.time ? row.time.split(" ")[0] : (row.detected_at ? row.detected_at.split("T")[0] : '');
        else if (c.accessor === 'time') val = row.time ? row.time.split(" ")[1] : (row.detected_at ? new Date(row.detected_at).toLocaleTimeString() : '');
        else if (c.accessor === 'timestamp') val = row.timestamp ? new Date(row.timestamp).toLocaleString() : (row.event_timestamp ? new Date(row.event_timestamp).toLocaleString() : '');
        else val = row[c.accessor] || '';

        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tabs.find(t => t.id === activeTab)?.label}_Report_${fromDate}_to_${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Export Successful", "Report exported to Excel (CSV).");
  };

  const getFilteredData = () => {
    let result = data;

    // Filter by date range (fromDate / toDate) if present
    if (fromDate || toDate) {
      result = result.filter((item) => {
        const d = getRowDate(item);
        if (!d || isNaN(d.getTime())) return true;
        const dStr = toLocalDateStr(d);
        if (fromDate && dStr < fromDate) return false;
        if (toDate && dStr > toDate) return false;
        return true;
      });
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const values = [
          item.plate, item.location, item.location_name, item.camera_name,
          item.vehicle_type, item.incident_type, item.status
        ].filter(Boolean).map(v => String(v).toLowerCase());

        return values.some(v => v.includes(lowerQuery));
      });
    }

    return result.map((item, index) => ({ ...item, srNo: index + 1 }));
  };

  const filteredData = getFilteredData();

  // Helper for dynamic bar chart title based on active date range
  const getDynamicBarTitle = (baseLabel) => {
    if (fromDate && toDate) return `${baseLabel} (${fromDate} to ${toDate})`;
    if (fromDate) return `${baseLabel} (From ${fromDate})`;
    if (toDate) return `${baseLabel} (Up to ${toDate})`;
    return `${baseLabel} — Last 7 Days`;
  };

  // ---- Stats & chart data, derived per active tab ----
  const insights = useMemo(() => {
    const rows = filteredData;
    const todayStr = getTodayStr ? getTodayStr() : toLocalDateStr(new Date());
    const isToday = (row) => {
      const d = getRowDate(row);
      return d ? toLocalDateStr(d) === todayStr : false;
    };
    const topN = (counts, n = 5) => {
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const top = entries.slice(0, n);
      const restTotal = entries.slice(n).reduce((sum, [, v]) => sum + v, 0);
      const result = top.map(([name, value]) => ({ name, value }));
      if (restTotal > 0) result.push({ name: 'Others', value: restTotal });
      return result;
    };

    const hasDateFilter = Boolean(fromDate || toDate);

    if (activeTab === 'no_parking') {
      const total = rows.length;
      const stationaryVals = rows.map(r => Number(r.stationary)).filter(v => !isNaN(v) && v > 0);
      const avgStationary = stationaryVals.length
        ? Math.round(stationaryVals.reduce((a, b) => a + b, 0) / stationaryVals.length)
        : 0;
      const locationCounts = {};
      rows.forEach(r => {
        const loc = getRowLocation(r);
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      });
      const todayCount = rows.filter(isToday).length;

      const dayCounts = {};
      rows.forEach(r => {
        const d = getRowDate(r);
        const key = d ? toLocalDateStr(d) : null;
        if (key) dayCounts[key] = (dayCounts[key] || 0) + 1;
      });

      const dateList = getChartDateRange(rows, fromDate, toDate);
      const barData = dateList.map(dateStr => ({
        name: formatDDMM(dateStr),
        Violations: dayCounts[dateStr] || 0
      }));

      return {
        stats: [
          { icon: Ban, label: 'Total Violations', value: total, color: '#3b82f6' },
          { icon: Clock, label: 'Avg Stationary Time', value: `${avgStationary}s`, color: '#f59e0b' },
          { icon: MapPin, label: 'Locations Monitored', value: Object.keys(locationCounts).length, color: '#8b5cf6' },
          { icon: CalendarDays, label: hasDateFilter ? 'Filtered Violations' : "Today's Violations", value: hasDateFilter ? total : todayCount, color: '#ef4444' },
        ],
        barTitle: getDynamicBarTitle('Violations'),
        barData,
        barKey: 'Violations',
        pieTitle: 'Violations by Location',
        pieData: topN(locationCounts),
      };
    }

    if (activeTab === 'in_out') {
      const inCount = rows.filter(r => String(r.direction || r.event_type || '').toLowerCase().includes('in')).length;
      const outCount = rows.filter(r => String(r.direction || r.event_type || '').toLowerCase().includes('out')).length;
      const net = inCount - outCount;
      const vehicleCounts = {};
      rows.forEach(r => {
        const vt = r.vehicle_type || 'Unknown';
        vehicleCounts[vt] = (vehicleCounts[vt] || 0) + 1;
      });

      const dayCounts = {};
      rows.forEach(r => {
        const d = getRowDate(r);
        const key = d ? toLocalDateStr(d) : null;
        if (key) dayCounts[key] = (dayCounts[key] || 0) + 1;
      });

      const dateList = getChartDateRange(rows, fromDate, toDate);
      const barData = dateList.map(dateStr => ({
        name: formatDDMM(dateStr),
        Movements: dayCounts[dateStr] || 0
      }));

      return {
        stats: [
          { icon: LogIn, label: 'Total In', value: inCount, color: '#10b981' },
          { icon: LogOut, label: 'Total Out', value: outCount, color: '#ef4444' },
          { icon: Gauge, label: 'Net Count', value: net >= 0 ? `+${net}` : net, color: '#3b82f6' },
          { icon: Layers, label: 'Vehicle Types', value: Object.keys(vehicleCounts).length, color: '#f59e0b' },
        ],
        barTitle: getDynamicBarTitle('Movements'),
        barData,
        barKey: 'Movements',
        pieTitle: 'In vs Out',
        pieData: [
          { name: 'In', value: inCount },
          { name: 'Out', value: outCount },
        ],
      };
    }

    if (activeTab === 'incident') {
      const total = rows.length;
      const severityCounts = {};
      rows.forEach(r => {
        const sev = (r.severity || 'Unknown').toString();
        const key = sev.charAt(0).toUpperCase() + sev.slice(1).toLowerCase();
        severityCounts[key] = (severityCounts[key] || 0) + 1;
      });
      const critical = rows.filter(r => ['critical', 'high'].includes(String(r.severity || '').toLowerCase())).length;
      const locationCounts = {};
      rows.forEach(r => {
        const loc = getRowLocation(r);
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      });
      const todayCount = rows.filter(isToday).length;

      const dayCounts = {};
      rows.forEach(r => {
        const d = getRowDate(r);
        const key = d ? toLocalDateStr(d) : null;
        if (key) dayCounts[key] = (dayCounts[key] || 0) + 1;
      });

      const dateList = getChartDateRange(rows, fromDate, toDate);
      const barData = dateList.map(dateStr => ({
        name: formatDDMM(dateStr),
        Incidents: dayCounts[dateStr] || 0
      }));

      return {
        stats: [
          { icon: AlertTriangle, label: 'Total Incidents', value: total, color: '#ef4444' },
          { icon: Siren, label: 'High / Critical', value: critical, color: '#f97316' },
          { icon: MapPin, label: 'Locations Affected', value: Object.keys(locationCounts).length, color: '#8b5cf6' },
          { icon: CalendarDays, label: hasDateFilter ? 'Filtered Incidents' : "Today's Incidents", value: hasDateFilter ? total : todayCount, color: '#3b82f6' },
        ],
        barTitle: getDynamicBarTitle('Incidents'),
        barData,
        barKey: 'Incidents',
        pieTitle: 'Severity Breakdown',
        pieData: Object.entries(severityCounts).map(([name, value]) => ({ name, value })),
      };
    }

    if (activeTab === 'heavy_vehicle') {
      const total = rows.length;
      const vehicleCounts = {};
      rows.forEach(r => {
        const vt = r.vehicle_type || 'Unknown';
        vehicleCounts[vt] = (vehicleCounts[vt] || 0) + 1;
      });
      const locationCounts = {};
      rows.forEach(r => {
        const loc = getRowLocation(r);
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      });
      const todayCount = rows.filter(isToday).length;

      const dayCounts = {};
      rows.forEach(r => {
        const d = getRowDate(r);
        const key = d ? toLocalDateStr(d) : null;
        if (key) dayCounts[key] = (dayCounts[key] || 0) + 1;
      });

      const dateList = getChartDateRange(rows, fromDate, toDate);
      const barData = dateList.map(dateStr => ({
        name: formatDDMM(dateStr),
        Detections: dayCounts[dateStr] || 0
      }));

      return {
        stats: [
          { icon: Truck, label: 'Total Detections', value: total, color: '#3b82f6' },
          { icon: Boxes, label: 'Vehicle Types', value: Object.keys(vehicleCounts).length, color: '#f59e0b' },
          { icon: MapPin, label: 'Locations', value: Object.keys(locationCounts).length, color: '#8b5cf6' },
          { icon: CalendarDays, label: hasDateFilter ? 'Filtered Detections' : "Today's Detections", value: hasDateFilter ? total : todayCount, color: '#10b981' },
        ],
        barTitle: getDynamicBarTitle('Detections'),
        barData,
        barKey: 'Detections',
        pieTitle: 'Detections by Location',
        pieData: topN(locationCounts),
      };
    }

    return { stats: [], barTitle: '', barData: [], barKey: 'Count', pieTitle: '', pieData: [] };
  }, [activeTab, filteredData]);

  // Dynamic columns based on active tab
  const getColumns = () => {
    const actionCol = {
      header: "ACTION", accessor: "action", render: (row) => (
        <button
          onClick={() => handleViewDetails(row)}
          className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors cursor-pointer"
          title="View Details"
        >
          <Eye size={14} />
        </button>
      )
    };

    if (activeTab === 'no_parking') {
      return [
        { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
        { header: "LICENSE PLATE", accessor: "plate", render: (row) => <span className="font-bold text-[#3b82f6]">{row.plate || 'N/A'}</span> },
        { header: "STATIONARY TIME", accessor: "stationary", render: (row) => row.stationary ? `${row.stationary}s` : 'N/A' },
        { header: "LOCATION", accessor: "location", render: (row) => row.location || row.location_name || row.camera_name || 'Unknown' },
        { header: "DATE", accessor: "date", render: (row) => row.time ? row.time.split(" ")[0] : (row.detected_at ? row.detected_at.split("T")[0] : '—') },
        { header: "TIME", accessor: "time", render: (row) => row.time ? row.time.split(" ")[1] : (row.detected_at ? new Date(row.detected_at).toLocaleTimeString() : '—') },
        {
          header: "SNAPSHOT", accessor: "image", render: (row) => {
            const imgSrc = getViolationImageSrc(row);
            return (
              <div className="w-12 h-8 rounded border overflow-hidden bg-black/20 flex items-center justify-center">
                {imgSrc ? (
                  <img src={imgSrc} alt="Snapshot" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[8px] text-gray-500">N/A</span>
                )}
              </div>
            );
          }
        },
        actionCol
      ];
    }

    if (activeTab === 'in_out') {
      return [
        { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
        { header: "DIR", accessor: "direction", render: (row) => <span className="font-bold text-yellow-500 uppercase">{row.direction || row.event_type || 'N/A'}</span> },
        { header: "VEHICLE TYPE", accessor: "vehicle_type", render: (row) => <span className="font-bold capitalize">{row.vehicle_type || 'N/A'}</span> },
        { header: "LOCATION", accessor: "location", render: (row) => row.location || row.location_name || row.camera_name || 'Unknown' },
        { header: "TIMESTAMP", accessor: "timestamp", render: (row) => <span className="text-xs opacity-80">{row.timestamp ? new Date(row.timestamp).toLocaleString() : (row.event_timestamp ? new Date(row.event_timestamp).toLocaleString() : '—')}</span> },
        actionCol
      ];
    }

    if (activeTab === 'incident') {
      return [
        { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
        { header: "SEVERITY", accessor: "severity", render: (row) => <span className="font-bold text-red-500 uppercase">{row.severity || 'N/A'}</span> },
        { header: "DATE", accessor: "date", render: (row) => <span className="opacity-80">{row.detected_at ? new Date(row.detected_at).toLocaleDateString() : (row.time_str ? row.time_str.split(' ')[0] : '—')}</span> },
        { header: "TIME", accessor: "time", render: (row) => <span className="opacity-80">{row.detected_at ? new Date(row.detected_at).toLocaleTimeString() : (row.time_str ? row.time_str.split(' ')[1] : '—')}</span> },
        { header: "LOCATION", accessor: "location", render: (row) => row.location || row.location_name || row.camera_name || 'Unknown' },
        {
          header: "IMAGE", accessor: "image", render: (row) => {
            const imgSrc = getViolationImageSrc(row);
            return (
              <div className="w-12 h-8 rounded border overflow-hidden bg-black/20 flex items-center justify-center">
                {imgSrc ? (
                  <img src={imgSrc} alt="Incident" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[8px] text-gray-500">N/A</span>
                )}
              </div>
            );
          }
        },
        actionCol
      ];
    }

    if (activeTab === 'heavy_vehicle') {
      return [
        { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
        {
          header: "DETECTION IMAGE", accessor: "image", render: (row) => {
            const imgSrc = getViolationImageSrc(row);
            return (
              <div className="w-12 h-8 rounded border overflow-hidden bg-black/20 flex items-center justify-center">
                {imgSrc ? (
                  <img src={imgSrc} alt="Vehicle" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[8px] text-gray-500">N/A</span>
                )}
              </div>
            );
          }
        },
        { header: "VEHICLE TYPE", accessor: "vehicle_type", render: (row) => <span className="capitalize font-semibold">{row.vehicle_type || 'N/A'}</span> },
        { header: "STATUS / DIRECTION", accessor: "status", render: (row) => <span className="font-bold">{row.status || 'N/A'}</span> },
        { header: "LOCATION", accessor: "location", render: (row) => row.location || row.location_name || row.camera_name || 'Unknown' },
        { header: "DATE", accessor: "date", render: (row) => <span className="font-medium text-xs opacity-90">{row.detected_at ? new Date(row.detected_at).toLocaleDateString() : '—'}</span> },
        { header: "TIME", accessor: "time", render: (row) => <span className="font-medium text-xs opacity-90">{row.detected_at ? new Date(row.detected_at).toLocaleTimeString() : '—'}</span> },
        actionCol
      ];
    }

    return [];
  };

  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor?.() || "#e5e7eb";
  const cardBg = themeUtils.getBgColor?.('card') || "#ffffff";
  const bgDefault = themeUtils.getBgColor?.('default') || "#f3f4f6";

  const hasChartData = filteredData.length > 0;

  return (
    <div className="flex flex-col gap-4 w-full h-full text-gray-900 dark:text-white font-sans overflow-y-auto pb-6">
      <PageHeader
        title="Reports"
        subtitle="View and export historical data across modules"
        icon={FileText}
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || filteredData.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        }
      />

      <div
        className="flex flex-col gap-4 p-4 rounded-xl border flex-1 overflow-hidden shadow-sm"
        style={{ backgroundColor: cardBg, borderColor }}
      >
        <div className="flex gap-2 border-b pb-2 overflow-x-auto hide-scrollbar" style={{ borderColor }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent hover:text-blue-400'
                  }`}
                style={{ color: isActive ? '#3b82f6' : textSecondary }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
          {/* Stat cards — recalculated per tab from the currently filtered records */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {insights.stats.map((s, i) => (
              <StatCard
                key={i}
                icon={s.icon}
                label={s.label}
                value={s.value}
                color={s.color}
                cardBg={bgDefault}
                borderColor={borderColor}
                textSecondary={textSecondary}
              />
            ))}
          </div>

          {/* Charts — bar + pie, tailored to the active module */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border" style={{ backgroundColor: bgDefault, borderColor }}>
                <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-3" style={{ color: textSecondary }}>
                  {insights.barTitle}
                </p>
                {insights.barData && insights.barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={insights.barData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={borderColor} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: textSecondary }} axisLine={{ stroke: borderColor }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: textSecondary }} axisLine={{ stroke: borderColor }} tickLine={false} />
                      <Tooltip content={<ChartTooltip cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary} />} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                      <Bar dataKey={insights.barKey} radius={[6, 6, 0, 0]}>
                        {insights.barData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[230px] flex items-center justify-center text-sm opacity-50">No data for this range</div>
                )}
              </div>

              <div className="p-4 rounded-xl border" style={{ backgroundColor: bgDefault, borderColor }}>
                <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-3" style={{ color: textSecondary }}>
                  {insights.pieTitle}
                </p>
                {hasChartData && insights.pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie
                        data={insights.pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {insights.pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke={bgDefault} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary} />} />
                      <Legend
                        verticalAlign="bottom"
                        height={30}
                        wrapperStyle={{ fontSize: 11, color: textSecondary }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[230px] flex items-center justify-center text-sm opacity-50">No data for this range</div>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <PaginatedTable
              title={`${tabs.find(t => t.id === activeTab)?.label} Records`}
              columns={getColumns()}
              data={filteredData}
              itemsPerPage={10}
              headerContent={
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-52">
                    <SearchBar
                      searchValue={searchQuery}
                      onSearchChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
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
          )}
        </div>
      </div>

      <RightSideDialog
        visible={isModalOpen}
        onHide={() => setIsModalOpen(false)}
        header="Record Details"
      >
        {selectedRecord && (
          <div className="flex flex-col gap-6 pt-4 pb-12">
            <div className="w-full h-64 rounded-xl border overflow-hidden bg-black/10 flex items-center justify-center">
              {getViolationImageSrc(selectedRecord) ? (
                <img src={getViolationImageSrc(selectedRecord)} alt="Snapshot" className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center opacity-50">
                  <CameraIcon size={32} className="mb-2" />
                  <span>No Image Available</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Module</p>
                <p className="font-semibold text-sm">{tabs.find(t => t.id === activeTab)?.label}</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Location</p>
                <p className="font-semibold text-sm">{selectedRecord.location || selectedRecord.location_name || selectedRecord.camera_name || 'Unknown'}</p>
              </div>
              {selectedRecord.plate && (
                <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                  <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>License Plate</p>
                  <p className="font-semibold text-lg text-blue-500">{selectedRecord.plate}</p>
                </div>
              )}
              {selectedRecord.vehicle_type && (
                <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                  <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Vehicle Type</p>
                  <p className="font-semibold text-sm capitalize">{selectedRecord.vehicle_type}</p>
                </div>
              )}
              {selectedRecord.incident_type && (
                <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                  <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Incident Type</p>
                  <p className="font-semibold text-sm text-red-500">{selectedRecord.incident_type}</p>
                </div>
              )}
              {(selectedRecord.time || selectedRecord.detected_at || selectedRecord.timestamp || selectedRecord.event_timestamp) && (
                <div className="p-4 rounded-xl border col-span-2" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                  <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Timestamp</p>
                  <p className="font-semibold text-sm">
                    {selectedRecord.time ? `${selectedRecord.date || ''} ${selectedRecord.time}` :
                      (selectedRecord.detected_at ? new Date(selectedRecord.detected_at).toLocaleString() :
                        (selectedRecord.timestamp ? new Date(selectedRecord.timestamp).toLocaleString() :
                          (selectedRecord.event_timestamp ? new Date(selectedRecord.event_timestamp).toLocaleString() : '')))}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </RightSideDialog>
    </div>
  );
}

