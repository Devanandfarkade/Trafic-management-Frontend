import React, { useState, useEffect } from 'react';
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
  Download
} from 'lucide-react';
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

export default function Report() {
  const { theme, themeUtils } = useTheme();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('no_parking');
  const [fromDate, setFromDate] = useState(() => searchParams.get('fromDate') || "");
  const [toDate, setToDate] = useState(() => searchParams.get('toDate') || "");

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

  const fetchData = async () => {
    if (!API_BASE_URL) return;
    setLoading(true);
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
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
    if (!searchQuery) return data;
    const lowerQuery = searchQuery.toLowerCase();
    return data.filter((item) => {
      // Basic filtering across common fields
      const values = [
        item.plate, item.location, item.location_name, item.camera_name,
        item.vehicle_type, item.incident_type, item.status
      ].filter(Boolean).map(v => String(v).toLowerCase());

      return values.some(v => v.includes(lowerQuery));
    }).map((item, index) => ({ ...item, srNo: index + 1 }));
  };

  const filteredData = getFilteredData();

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

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2">
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
            </div>
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
