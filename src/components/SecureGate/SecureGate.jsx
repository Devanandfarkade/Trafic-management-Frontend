import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../ui/Settings/themeUtils';
import ModuleLayout from '../../ui/layout/ModuleLayout';
import useFaceRecognition from '../../hooks/useFaceRecognition';
import SecureGateVideoFeed from './SecureGateVideoFeed';
import SecureGateRightPanel from './SecureGateRightPanel';
import SecureGateTopMetrics from './SecureGateTopMetrics';
import PaginatedTable from '../../ui/common/PaginatedTable';
import SearchBar from '../../ui/common/SearchBar';
import RightSideDialog from '../../ui/common/RightSideDialog';
import { Eye, RefreshCw } from 'lucide-react';
import useCameraFilter from '../../hooks/useCameraFilter';
import { useToast } from '../../ui/common/CustomToast';
import DateRangePicker from '../../ui/common/DateRangePicker';
import { toLocalDateStr } from '../../utils/dateUtils';
import { API_BASE_URL } from '../../../config.js';

export default function SecureGate() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const cameraFilter = useCameraFilter('face_auth');
  const { allCameras: cameras, selectedCamera: currentCamObj } = cameraFilter;
  const currentCam = currentCamObj || (cameras.length > 0 ? cameras[0] : null) || { url: '' };

  const [searchQuery, setSearchQuery] = useState("");
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

  const [historyLogs, setHistoryLogs] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch history logs
  const fetchPersons = React.useCallback(() => {
    let url = `${API_BASE_URL}/api/secure-gate/persons?limit=50`;
    if (cameraFilter?.filters?.zone && cameraFilter.filters.zone !== 'all') url += `&zone_id=${cameraFilter.filters.zone}`;
    if (cameraFilter?.filters?.location && cameraFilter.filters.location !== 'all') url += `&location_id=${cameraFilter.filters.location}`;
    if (cameraFilter?.filters?.cameraId && cameraFilter.filters.cameraId !== 'all') url += `&camera_id=${cameraFilter.filters.cameraId}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.persons) {
          const logs = data.persons.map(p => ({
            id: p.id_label,
            status: p.status,
            time: p.detected_at ? new Date(p.detected_at).toLocaleString() : '',
            rawTime: p.detected_at,
            image: p.image_path ? `${API_BASE_URL}/${p.image_path}` : null
          }));
          setHistoryLogs(logs);
        }
      })
      .catch(err => console.error("Error fetching secure gate persons:", err));
  }, [cameraFilter?.filters?.zone, cameraFilter?.filters?.location, cameraFilter?.filters?.cameraId]);

  useEffect(() => {
    fetchPersons();
    const interval = setInterval(fetchPersons, 3000);
    return () => clearInterval(interval);
  }, [fetchPersons, refreshKey]);

  const {
    isConnected,
    isLoading,
    frame,
    detections,
    error,
    connect,
    disconnect
  } = useFaceRecognition(currentCam.url, currentCam.ws_url);

  // Auto connect when camera changes or component mounts
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [currentCam.url, connect, disconnect]);

  // Build a history log from detections for the table
  const prevDetectionsRef = React.useRef([]);

  useEffect(() => {
    const prev = prevDetectionsRef.current;
    const now = new Date();
    const timeStr = now.toLocaleString();

    // We can add logic to only log when status changes to RECOGNIZED or NEW_REGISTERED
    const newLogs = [];
    detections.forEach(det => {
      const prevDet = prev.find(p => p.id === det.id);

      // If newly recognized or newly registered
      if (!prevDet && (det.status === 'RECOGNIZED' || det.status === 'NEW_REGISTERED')) {
        const newLog = {
          id: det.id,
          status: det.status,
          time: timeStr,
          rawTime: now.toISOString(),
          image: frame // Snapshot of the current frame
        };
        newLogs.push(newLog);

        // Post to backend
        fetch(`${API_BASE_URL}/api/secure-gate/persons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            person_id: det.id,
            camera: currentCam.value, // Send the camera ID instead of location name
            status: det.status,
            image: frame
          })
        }).catch(err => console.error("Error saving secure gate person:", err));
      }
    });

    if (newLogs.length > 0) {
      setHistoryLogs(current => [...newLogs, ...current].slice(0, 50));
    }

    prevDetectionsRef.current = detections;
  }, [detections, frame, refreshKey]);

  const filteredHistory = historyLogs.filter(log => {
    const searchMatch = !searchQuery ||
      String(log.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(log.status).toLowerCase().includes(searchQuery.toLowerCase());

    let dateMatch = true;
    const logDate = toLocalDateStr(log.rawTime || log.time);
    if (fromDate && logDate && logDate < fromDate) dateMatch = false;
    if (toDate && logDate && logDate > toDate) dateMatch = false;

    return searchMatch && dateMatch;
  }).map((log, index) => ({
    ...log,
    srNo: index + 1
  }));

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const tableColumns = [
    { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
    { header: "PERSON ID", accessor: "id", render: (row) => <span className="font-bold">{row.id}</span> },
    {
      header: "STATUS", accessor: "status", render: (row) => (
        <span className={`px-2 py-1 rounded text-[10px] font-bold ${row.status === 'RECOGNIZED' ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}>
          {row.status}
        </span>
      )
    },
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

  return (
    <ModuleLayout
      title="Secure Gate"
      subtitle="Face recognition & automatic registration via WebSocket"
      hideLiveSystem={true}
      videoComponent={
        <SecureGateVideoFeed
          frame={frame}
          isLoading={isLoading}
          isConnected={isConnected}
          error={error}
          themeUtils={themeUtils}
          camera={currentCam}
        />
      }
      rightPanelComponent={
        <SecureGateRightPanel
          themeUtils={themeUtils}
          isConnected={isConnected}
          connect={connect}
          disconnect={disconnect}
          detections={detections}
          isLoading={isLoading}
        />
      }
      bottomMetricsComponent={
        <SecureGateTopMetrics
          themeUtils={themeUtils}
          detections={detections}
        />
      }
      bottomTableComponent={
        <>
          <PaginatedTable
            title="DETECTION HISTORY"
            columns={tableColumns}
            data={filteredHistory}
            itemsPerPage={5}
            headerContent={
              <div className="flex items-center gap-2">
                <div className="w-56">
                  <SearchBar
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID or Status..."
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
            header="Detection Details"
          >
            {selectedRecord && (
              <div className="flex flex-col gap-6 pt-4">
                {selectedRecord.image && (
                  <div className="w-full rounded-xl overflow-hidden border" style={{ borderColor: themeUtils.getBorderColor() }}>
                    <img src={selectedRecord.image} alt="Snapshot" className="w-full object-contain" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Person ID</p>
                    <p className="font-semibold text-lg">{selectedRecord.id}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Detection Time</p>
                    <p className="font-semibold text-lg text-blue-500">{selectedRecord.time}</p>
                  </div>
                  <div className="p-4 rounded-xl border col-span-2" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Status</p>
                    <p className={`font-semibold text-sm ${selectedRecord.status === 'RECOGNIZED' ? 'text-green-500' : 'text-blue-500'}`}>
                      {selectedRecord.status}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </RightSideDialog>
        </>
      }
      cameraFilter={cameraFilter}
      extraFilterData={filteredHistory}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshKey(prev => prev + 1);
              toast?.info?.("Refreshed", "Secure gate person data updated");
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => {
              import('../../utils/exportUtils').then(({ exportToCSV }) => {
                exportToCSV(filteredHistory, 'secure_gate_person_export');
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

