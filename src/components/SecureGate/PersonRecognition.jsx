import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Users,
  Video,
  Activity,
  Trash2,
  Play,
  Square,
  AlertCircle,
  RefreshCw,
  Camera,
  Eye,
  CameraOff
} from "lucide-react";
import { API_CONFIG } from "../../../config";
import { useTheme } from "../../ui/Settings/themeUtils";

import ModuleLayout from '../../ui/layout/ModuleLayout';
import PaginatedTable from '../../ui/common/PaginatedTable';
import RightSideDialog from '../../ui/common/RightSideDialog';
import SearchBar from '../../ui/common/SearchBar';

export default function PersonRecognition() {
  const { theme, themeUtils } = useTheme();

  // States
  const cameras = [
    { value: 'cam-secure-1', label: 'CAMERA 1 - SECURE GATE', url: API_CONFIG.SECURE_GATE_RTSP_URL || 'rtsp://admin:Admin%40123@192.168.1.21:554' }
  ];
  const [selectedCamera, setSelectedCamera] = useState('cam-secure-1');
  const currentCam = cameras.find(c => c.value === selectedCamera) || cameras[0];

  const [isConnected, setIsConnected] = useState(false);
  const [frame, setFrame] = useState(null);
  const [detections, setDetections] = useState([]);
  const [stats, setStats] = useState({
    total_persons: 0,
    active_collections: 0,
    active_streams: 0,
    persons: []
  });
  const [error, setError] = useState(null);

  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  const wsRef = useRef(null);
  const statsInterval = useRef(null);

  const cardBg = themeUtils.getBgColor("card");
  const borderColor = themeUtils.getBorderColor();
  const textPrimary = themeUtils.getTextColor(true);
  const textMuted = themeUtils.getTextColor(false);

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_CONFIG.SECURE_GATE_API_URL}/stats`);
      if (!res.ok) throw new Error("Failed to fetch statistics");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  useEffect(() => {
    fetchStats();
    statsInterval.current = setInterval(fetchStats, 3000);
    return () => clearInterval(statsInterval.current);
  }, []);

  // WebSocket Connection
  const connect = (rtsp) => {
    setError(null);
    if (wsRef.current) wsRef.current.close();

    const wsUrl = `${API_CONFIG.SECURE_GATE_WS_URL}/ws?rtsp_url=${encodeURIComponent(rtsp)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.frame) {
          if (data.frame.startsWith('data:image')) {
            setFrame(data.frame);
          } else {
            setFrame(`data:image/jpeg;base64,${data.frame}`);
          }
        }
        if (data.detections) {
          setDetections(data.detections);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error. Make sure the backend and RTSP stream are running.");
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    wsRef.current = ws;
  };

  const disconnect = async (rtsp) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsConnected(false);
    setFrame(null);
    setDetections([]);

    try {
      await fetch(`${API_CONFIG.SECURE_GATE_API_URL}/cleanup/${encodeURIComponent(rtsp)}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  };

  const toggleConnection = () => {
    if (isConnected) {
      disconnect(currentCam.url);
    } else {
      connect(currentCam.url);
    }
  };

  useEffect(() => {
    connect(currentCam.url);
    return () => {
      disconnect(currentCam.url);
    };
  }, [currentCam.url]);

  const handleResetDatabase = async () => {
    if (window.confirm("Are you sure you want to reset the database? All recognized persons will be deleted!")) {
      try {
        const res = await fetch(`${API_CONFIG.SECURE_GATE_API_URL}/reset`, { method: "POST" });
        if (res.ok) {
          fetchStats();
          alert("Database reset successfully.");
        } else {
          alert("Failed to reset database.");
        }
      } catch (err) {
        console.error("Error resetting DB:", err);
        alert("Error resetting database.");
      }
    }
  };



  // Merge live detections instantly so new users appear before the 5-second API poll
  const livePersons = useMemo(() => {
    let personsList = stats.persons.map(p => ({
      ...p,
      status: p.visits > 1 ? 'RECOGNIZED' : 'NEW_REGISTERED'
    }));

    detections.forEach(d => {
      const existing = personsList.find(p => p.id === d.id);
      if (!existing) {
        personsList.push({
          id: d.id,
          visits: d.status === 'RECOGNIZED' ? 2 : 1,
          images: d.progress || 0,
          first_seen: new Date().toLocaleString(),
          last_seen: new Date().toLocaleString(),
          status: d.status,
          image_url: null
        });
      } else {
        existing.status = d.status;
      }
    });

    return personsList;
  }, [stats.persons, detections]);

  // Prepare table data
  const filteredPersons = useMemo(() => {
    return livePersons.filter(p => {
      const matchesSearch = !searchQuery ||
        String(p.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(p.last_seen || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    }).map((p, index) => ({
      ...p,
      srNo: index + 1
    }));
  }, [livePersons, searchQuery]);

  // Derived top 4 for right panel to prevent overflow
  const topRecentPersons = useMemo(() => {
    return [...livePersons]
      .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
      .slice(0, 4);
  }, [livePersons]);

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const tableColumns = [
    { header: "SR.NO", accessor: "srNo", render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span> },
    { header: "PERSON ID", accessor: "id", render: (row) => <span className="font-bold">{row.id}</span> },
    {
      header: "STATUS", accessor: "status", render: (row) => {
        const status = row.status || 'UNKNOWN';
        const liveDetection = detections.find(d => d.id === row.id);

        if (status === 'RECOGNIZED') {
          return (
            <div className="flex items-center gap-2 w-max px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/50">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
              <div className="flex flex-col">
                <span className="text-white text-xs font-bold leading-tight">Recognized: {row.id}</span>
                <span className="text-green-500 text-[9px] font-bold uppercase tracking-wider leading-tight">Returning Person</span>
              </div>
            </div>
          );
        }
        if (status === 'NEW_REGISTERED') {
          return (
            <div className="flex items-center gap-2 w-max px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/50">
              <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
              <div className="flex flex-col">
                <span className="text-white text-xs font-bold leading-tight">New Person: {row.id}</span>
                <span className="text-blue-500 text-[9px] font-bold uppercase tracking-wider leading-tight">Registration Complete</span>
              </div>
            </div>
          );
        }
        if (status === 'COLLECTING') {
          return (
            <div className="flex items-center gap-2 w-max px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/50">
              <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin shrink-0" />
              <div className="flex flex-col">
                <span className="text-white text-xs font-bold leading-tight">Registering New Person</span>
                <span className="text-yellow-500 text-[9px] font-bold uppercase tracking-wider leading-tight">Progress: {liveDetection?.progress || row.progress || 0}/10</span>
              </div>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 w-max px-3 py-1.5 rounded-lg bg-gray-500/10 border border-gray-500/30">
            <div className="w-2 h-2 rounded-full bg-gray-500 shrink-0"></div>
            <div className="flex flex-col">
              <span className="text-gray-300 text-xs font-bold leading-tight">Status Unknown</span>
              <span className="text-gray-500 text-[9px] font-bold uppercase tracking-wider leading-tight">Waiting for Detection</span>
            </div>
          </div>
        );
      }
    },
    { header: "FIRST SEEN", accessor: "first_seen", render: (row) => <span className="text-xs text-gray-400">{row.first_seen}</span> },
    { header: "LAST SEEN", accessor: "last_seen", render: (row) => <span className="font-semibold">{row.last_seen}</span> },
    {
      header: "STORED IMAGES", accessor: "images", render: (row) => {
        const imgSrc = row.image_data ? (row.image_data.startsWith('data:') ? row.image_data : `data:image/jpeg;base64,${row.image_data}`) : row.image_url;
        return (
          <div className="flex items-center">
            <div className="w-8 h-8 rounded overflow-hidden bg-gray-800 border shrink-0 flex items-center justify-center">
              {imgSrc ? (
                <img src={imgSrc} alt={row.id} className="w-full h-full object-cover" />
              ) : (
                <Users className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </div>
        );
      }
    },
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

  const videoComponent = (
    <div className="flex flex-col h-full gap-4">


      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg flex items-center gap-3 shrink-0">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Video Feed */}
      <div className="flex-1 rounded-xl border relative overflow-hidden flex flex-col" style={{ backgroundColor: cardBg, borderColor }}>
        <div className="p-3 border-b flex justify-between items-center bg-black/20" style={{ borderColor }}>
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-sm" style={{ color: textPrimary }}>Live Camera Feed</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`}></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                {isConnected ? "Live" : "Offline"}
              </span>
            </div>
            <button
              onClick={toggleConnection}
              className={`px-2 py-1 rounded flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors ${isConnected
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30'
                : 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border border-blue-500/30'
                }`}
            >
              {isConnected ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              {isConnected ? "Stop Stream" : "Start Stream"}
            </button>
          </div>
        </div>

        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-[400px]">
          {frame ? (
            <img src={frame} alt="Live feed" className="w-full h-full object-fill" />
          ) : (
            <div className="text-gray-500 flex flex-col items-center gap-3">
              <CameraOff className="w-12 h-12 opacity-30" />
              <p className="text-sm">Stream disconnected. Connect to view feed.</p>
            </div>
          )}

          {/* Detections Overlay Panel */}
          {isConnected && detections.length > 0 && (
            <div className="absolute top-4 right-4 flex flex-col gap-2 max-w-xs z-10">
              {detections.map((d, i) => (
                <div key={i} className={`p-3 rounded-lg backdrop-blur-md border shadow-lg ${d.status === 'RECOGNIZED' ? 'bg-green-500/20 border-green-500/50' :
                  d.status === 'NEW_REGISTERED' ? 'bg-blue-500/20 border-blue-500/50' :
                    'bg-yellow-500/20 border-yellow-500/50'
                  }`}>
                  <div className="flex items-center gap-3">
                    {d.status === 'RECOGNIZED' ? (
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    ) : d.status === 'NEW_REGISTERED' ? (
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    ) : (
                      <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
                    )}
                    <div>
                      <p className="text-white text-sm font-bold">
                        {d.status === 'RECOGNIZED' ? `Recognized: ${d.id}` :
                          d.status === 'NEW_REGISTERED' ? `New Person: ${d.id}` :
                            'Registering New Person'}
                      </p>
                      <p className="text-gray-300 text-[10px] font-medium uppercase tracking-wider">
                        {d.status === 'RECOGNIZED'
                          ? 'Returning Person'
                          : d.status === 'COLLECTING'
                            ? `Progress: ${d.progress}/10` : 'Registration Complete'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const rightPanelComponent = (
    <div className="flex flex-col gap-2 h-full">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 shrink-0">
        <div className="rounded-xl border p-4 flex flex-col gap-1 relative overflow-hidden group" style={{ backgroundColor: cardBg, borderColor }}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-12 h-12 text-blue-500" />
          </div>
          <div className="flex items-center gap-2 text-blue-500 mb-2 relative z-10">
            <Users className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Persons</span>
          </div>
          <p className="text-3xl font-bold relative z-10" style={{ color: textPrimary }}>{stats.total_persons}</p>
        </div>

        <div className="rounded-xl border p-4 flex flex-col gap-1 relative overflow-hidden group" style={{ backgroundColor: cardBg, borderColor }}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-12 h-12 text-yellow-500" />
          </div>
          <div className="flex items-center gap-2 text-yellow-500 mb-2 relative z-10">
            <Activity className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Captures</span>
          </div>
          <p className="text-3xl font-bold relative z-10" style={{ color: textPrimary }}>{stats.active_collections}</p>
        </div>

        <div className="rounded-xl border p-4 flex flex-col gap-1 relative overflow-hidden group" style={{ backgroundColor: cardBg, borderColor }}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Video className="w-12 h-12 text-green-500" />
          </div>
          <div className="flex items-center gap-2 text-green-500 mb-2 relative z-10">
            <Video className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Streams</span>
          </div>
          <p className="text-3xl font-bold relative z-10" style={{ color: textPrimary }}>{stats.active_streams}</p>
        </div>
      </div>



      {/* Top 4 Recent Images */}
      <div className="flex-1 rounded-xl border flex flex-col overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
        <div className="px-4 py-3 border-b bg-black/20" style={{ borderColor }}>
          <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: textPrimary }}>
            <Activity className="w-4 h-4 text-blue-500" />
            Recent Registrations
          </h3>
        </div>
        <div className="flex-1 p-3 flex flex-col justify-center gap-2.5 overflow-hidden">
          {topRecentPersons.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
              <Users className="w-8 h-8 opacity-50" />
              <span className="text-xs">No recent registrations.</span>
            </div>
          ) : (
            topRecentPersons.map(person => (
              <div key={person.id} className="flex gap-4 items-center p-2.5 px-3 rounded-xl border bg-black/20 hover:bg-white/5 transition-all shadow-sm" style={{ borderColor }}>
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-900 border-2 shrink-0 flex items-center justify-center relative shadow-inner" style={{ borderColor: themeUtils.getBorderColor() }}>
                  {person.image_data || person.image_url ? (
                    <img src={person.image_data ? (person.image_data.startsWith('data:') ? person.image_data : `data:image/jpeg;base64,${person.image_data}`) : person.image_url} alt={person.id} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-sm font-bold truncate text-white tracking-wide">{person.id}</p>
                  <p className="text-[10px] text-gray-400 truncate mt-1 flex items-center gap-1.5 font-medium">
                    <Activity className="w-3 h-3 text-blue-400" />
                    {person.last_seen}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <ModuleLayout
      title="Person Recognition"
      subtitle="Real-time face detection, recognition, and automatic registration via WebSocket"
      hideLiveSystem={true}
      videoComponent={videoComponent}
      rightPanelComponent={rightPanelComponent}
      bottomTableComponent={
        <>
          <PaginatedTable
            title="ALL REGISTERED PERSONS"
            columns={tableColumns}
            data={filteredPersons}
            itemsPerPage={recordsPerPage}
            headerContent={
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rows per page:</span>
                  <select
                    value={recordsPerPage}
                    onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                    className="px-2 py-1 h-8 text-xs border rounded outline-none focus:border-blue-500 cursor-pointer"
                    style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('input'), color: themeUtils.getTextColor(true) }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="w-64">
                  <SearchBar
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Person ID or Date..."
                  />
                </div>
              </div>
            }
          />

          <RightSideDialog
            visible={isModalOpen}
            onHide={() => setIsModalOpen(false)}
            header="Person Details"
          >
            {selectedRecord && (
              <div className="flex flex-col gap-6 pt-4">
                <div className="flex justify-center mb-4">
                  <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-900 border-2 flex items-center justify-center relative shadow-lg" style={{ borderColor: themeUtils.getBorderColor() }}>
                    {selectedRecord.image_data || selectedRecord.image_url ? (
                      <img src={selectedRecord.image_data ? (selectedRecord.image_data.startsWith('data:') ? selectedRecord.image_data : `data:image/jpeg;base64,${selectedRecord.image_data}`) : selectedRecord.image_url} alt={selectedRecord.id} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-12 h-12 text-gray-600" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1 tracking-wider" style={{ color: themeUtils.getTextColor(false) }}>Person ID</p>
                    <p className="font-semibold text-lg text-white truncate" title={selectedRecord.id}>{selectedRecord.id}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-2 tracking-wider" style={{ color: themeUtils.getTextColor(false) }}>Status</p>
                    {selectedRecord.status === 'RECOGNIZED' ? (
                      <div className="flex items-center gap-2 w-max px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/50">
                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-bold leading-tight">Recognized</span>
                          <span className="text-green-500 text-[9px] font-bold uppercase tracking-wider leading-tight">Returning Person</span>
                        </div>
                      </div>
                    ) : selectedRecord.status === 'NEW_REGISTERED' ? (
                      <div className="flex items-center gap-2 w-max px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/50">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-bold leading-tight">New Person</span>
                          <span className="text-blue-500 text-[9px] font-bold uppercase tracking-wider leading-tight">Registration Complete</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-max px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/50">
                        <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-bold leading-tight">Registering</span>
                          <span className="text-yellow-500 text-[9px] font-bold uppercase tracking-wider leading-tight">Progress: {selectedRecord.images}/10</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1 tracking-wider" style={{ color: themeUtils.getTextColor(false) }}>First Seen</p>
                    <p className="font-semibold text-sm text-gray-300">{selectedRecord.first_seen}</p>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor('card') }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1 tracking-wider" style={{ color: themeUtils.getTextColor(false) }}>Last Seen</p>
                    <p className="font-semibold text-sm text-white">{selectedRecord.last_seen}</p>
                  </div>
                </div>
              </div>
            )}
          </RightSideDialog>
        </>
      }
      cameras={cameras}
      selectedCamera={selectedCamera}
      onCameraChange={setSelectedCamera}
    />
  );
}
