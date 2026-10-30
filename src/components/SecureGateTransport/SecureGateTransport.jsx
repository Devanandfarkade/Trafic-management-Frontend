import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../ui/Settings/themeUtils';
import ModuleLayout from '../../ui/layout/ModuleLayout';
import useTransportStream from '../../hooks/useTransportStream';
import TransportVideoFeed from './TransportVideoFeed';
import TransportRightPanel from './TransportRightPanel';
import TransportTopMetrics from './TransportTopMetrics';
import PaginatedTable from '../../ui/common/PaginatedTable';
import RightSideDialog from '../../ui/common/RightSideDialog';
import { Eye, Clock, RefreshCw } from 'lucide-react';
import { plateDetectionService } from '../../services/plateDetectionService';
import useCameraFilter from '../../hooks/useCameraFilter';
import { API_BASE_URL } from '../../../config';
import { useToast } from '../../ui/common/CustomToast';
import DateRangePicker from '../../ui/common/DateRangePicker';
import { toLocalDateStr } from '../../utils/dateUtils';

export default function SecureGateTransport() {
  const { themeUtils } = useTheme();
  const toast = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const cameraFilter = useCameraFilter('anpr');
  const { allCameras: cameras, selectedCamera: currentCamObj } = cameraFilter;
  const currentCam = currentCamObj || (cameras.length > 0 ? cameras[0] : null) || { url: '' };

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
  const [notification, setNotification] = useState(null);

  const { isConnected, isLoading, error: streamError, streamId, detections, latestPlate, latestEntry, frame, connect, disconnect } = useTransportStream(
    currentCam.url,
    currentCam.ws_url
  );

  // Ref to track component mount time for detecting fresh vs cached detections
  const mountedAtRef = useRef(Date.now());
  // Ref to debounce: avoid sending duplicate log for same entry_id
  const lastSentEntryRef = useRef({});

  // Connect to camera on mount and when camera changes
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [currentCam.url, connect, disconnect]);

  // Fetch initial history logs from database with 3-second auto-refresh
  useEffect(() => {
    const fetchLogs = () => {
      let url = `${API_BASE_URL}/api/secure-gate-transport/logs?limit=50`;
      if (cameraFilter?.filters?.zone && cameraFilter.filters.zone !== 'all') url += `&zone_id=${cameraFilter.filters.zone}`;
      if (cameraFilter?.filters?.location && cameraFilter.filters.location !== 'all') url += `&location_id=${cameraFilter.filters.location}`;
      if (cameraFilter?.filters?.cameraId && cameraFilter.filters.cameraId !== 'all') url += `&camera_id=${cameraFilter.filters.cameraId}`;

      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.logs) {
            const logs = data.logs.map(log => {
              const imgPath = log.vehicle_image || log.vehicle_image_path || log.entry_image;
              let url = null;
              if (imgPath) {
                url = (imgPath.startsWith('http') || imgPath.startsWith('data:'))
                  ? imgPath
                  : `${API_BASE_URL}/${imgPath}`;
              }
              const rawTime = log.time || log.timestamp || log.created_at;
              return {
                id: log.log_id || log.entry_id || `DET-${log.id}`,
                filename: log.plate || 'UNKNOWN',
                url: url,
                time: rawTime ? new Date(rawTime).toLocaleString() : '',
                raw: log
              };
            });
            setHistoryLogs(logs);
          }
        })
        .catch(err => console.error("Error fetching secure gate transport logs:", err));
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [refreshKey, cameraFilter?.filters?.zone, cameraFilter?.filters?.location, cameraFilter?.filters?.cameraId]);

  // POST to Node backend when Python sends a new vehicle entry via WebSocket
  const handleEntry = useCallback((entry, camera) => {
    if (!entry || !entry.entry_id) return;

    // Debounce: only send once per entry_id
    const cacheKey = entry.entry_id;
    if (lastSentEntryRef.current[cacheKey]) return;
    lastSentEntryRef.current[cacheKey] = true;

    const payload = {
      entry_id: entry.entry_id,
      stream_id: entry.stream_id,
      vehicle_id: String(entry.vehicle_id ?? ''),
      plate: entry.plate,
      time: entry.time,
      timestamp: entry.timestamp,
      detector_confidence: entry.detector_confidence,
      best_confidence: entry.best_confidence,
      ocr_confidence: entry.ocr_confidence,
      entry_image_base64: entry.entry_image_base64,
      vehicle_image_base64: entry.vehicle_image_base64,
    };

    // Optimistically update the history table
    const newLog = {
      id: entry.entry_id || `DET-${Date.now().toString().slice(-6)}`,
      filename: entry.plate,
      url: entry.vehicle_image_base64 ? `data:image/jpeg;base64,${entry.vehicle_image_base64}` : null,
      time: new Date(entry.timestamp || Date.now()).toLocaleString(),
      raw: entry
    };
    setHistoryLogs(prev => [newLog, ...prev].slice(0, 50));

    console.log(`📤 [SecureGateTransport] Sending log to Node | plate=${entry.plate} | entry_id=${entry.entry_id}`);
    fetch(`${API_BASE_URL}/api/secure-gate-transport/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json())
      .then(data => console.log(`✅ [SecureGateTransport] Node saved log | log_id=${data?.log?.log_id}`))
      .catch(err => console.error('❌ [SecureGateTransport] Failed to POST log:', err));
  }, []);

  // Watch for new latestEntry from the WebSocket and fire handleEntry
  useEffect(() => {
    if (latestEntry) {
      handleEntry(latestEntry, currentCam);

      const cacheKey = latestEntry.entry_id;
      if (lastSentEntryRef.current[cacheKey] === 'notified') return;
      lastSentEntryRef.current[cacheKey] = 'notified';

      // Only show toast popup for FRESH live detections (occurring within 15 seconds of stream connection)
      const entryTime = new Date(latestEntry.timestamp || latestEntry.time || Date.now()).getTime();
      const isFresh = entryTime >= (mountedAtRef.current - 15000);

      if (isFresh) {
        setNotification({
          plate: latestEntry.plate,
          image: latestEntry.vehicle_image_base64,
          time: latestEntry.time
        });

        // Auto-hide after 8 seconds
        setTimeout(() => setNotification(null), 8000);
      }
    }
  }, [latestEntry, currentCam, handleEntry]);

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  // Combine live detections with database history logs if live stream detections array is empty
  const rightPanelDetections = React.useMemo(() => {
    if (detections && detections.length > 0) {
      return detections;
    }
    return historyLogs.map(log => ({
      detection_id: log.id,
      plate: log.filename,
      confidence: log.raw?.ocr_confidence || log.raw?.detector_confidence || 0.9,
      plate_image: log.url,
      timestamp: log.raw?.timestamp || log.raw?.time || log.raw?.created_at || new Date().toISOString()
    }));
  }, [detections, historyLogs]);

  const tableColumns = [
    { header: "SCAN ID", accessor: "id", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.id}</span> },
    { header: "PLATE NUMBER", accessor: "filename", render: (row) => <span className="font-mono text-sm tracking-wider font-bold text-blue-500">{row.filename}</span> },
    {
      header: "SCAN TIME", accessor: "time", render: (row) => (
        <span className="flex items-center gap-1 text-xs"><Clock size={12} /> {row.time}</span>
      )
    },
    {
      header: "ACTION", accessor: "action", render: (row) => (
        <button
          onClick={() => handleViewDetails(row)}
          className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors cursor-pointer"
          title="View Image"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  const uploaderComponent = (
    <TransportVideoFeed
      latestPlate={latestPlate}
      streamId={streamId}
      frame={frame}
      isLoading={isLoading}
      isConnected={isConnected}
      error={streamError}
      themeUtils={themeUtils}
      camera={currentCam}
    />
  );

  const rightPanelComponent = (
    <TransportRightPanel
      themeUtils={themeUtils}
      detections={rightPanelDetections}
      error={streamError}
    />
  );

  const bottomMetricsComponent = (
    <TransportTopMetrics
      themeUtils={themeUtils}
      streamId={streamId}
    />
  );

  const filteredLogs = React.useMemo(() => {
    return historyLogs.filter(log => {
      let dateMatch = true;
      const logDate = toLocalDateStr(log.raw?.timestamp || log.raw?.time || log.raw?.created_at || log.time);
      if (fromDate && logDate && logDate < fromDate) dateMatch = false;
      if (toDate && logDate && logDate > toDate) dateMatch = false;
      return dateMatch;
    });
  }, [historyLogs, fromDate, toDate]);

  const bottomTableComponent = (
    <>
      <PaginatedTable
        title="RECENT DETECTIONS"
        columns={tableColumns}
        data={filteredLogs}
        itemsPerPage={5}
        headerContent={
          <div className="flex items-center gap-2">
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
        header="Scan Details"
      >
        {selectedRecord && (
          <div className="flex flex-col gap-6 pt-4">
            <div className="w-full rounded-xl overflow-hidden border" style={{ borderColor: themeUtils.getBorderColor() }}>
              <img src={selectedRecord.url} alt="Scanned Plate" className="w-full object-contain" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Scan ID</p>
                <p className="font-semibold">{selectedRecord.id}</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: themeUtils.getTextColor(false) }}>Scan Time</p>
                <p className="font-semibold text-blue-500">{selectedRecord.time}</p>
              </div>
            </div>
          </div>
        )}
      </RightSideDialog>

      {/* Floating Notification Area */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
          <div className="bg-black/90 border rounded-xl shadow-2xl p-4 flex flex-col gap-3 min-w-[300px]" style={{ borderColor: themeUtils.getBorderColor() }}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xl font-bold font-mono text-blue-400 tracking-wider">🚗 {notification.plate}</div>
                <div className="text-xs opacity-70 mt-1">{notification.time}</div>
              </div>
              <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            {notification.image && (
              <div className="w-full h-32 rounded bg-black/50 border overflow-hidden flex items-center justify-center" style={{ borderColor: themeUtils.getBorderColor() }}>
                <img src={`data:image/jpeg;base64,${notification.image}`} alt="Car" className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <ModuleLayout
      title="Secure Gate Transport"
      subtitle="License Plate Detection System"
      hideLiveSystem={true}
      videoComponent={uploaderComponent}
      rightPanelComponent={rightPanelComponent}
      bottomMetricsComponent={bottomMetricsComponent}
      bottomTableComponent={bottomTableComponent}
      cameraFilter={cameraFilter}
      extraFilterData={filteredLogs}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshKey(prev => prev + 1);
              toast?.info?.("Refreshed", "Secure Gate Transport data updated");
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => {
              import('../../utils/exportUtils').then(({ exportToCSV }) => {
                exportToCSV(filteredLogs, 'secure_gate_transport_export');
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
