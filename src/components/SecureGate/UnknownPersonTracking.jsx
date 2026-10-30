import React, { useState, useEffect, useMemo, useRef } from "react";
import { Users, Search, ArrowRight, ArrowLeft, RefreshCw, Eye, Camera, MapPin, Video, LayoutGrid, Filter, Download, UserCheck, ShieldAlert, Sliders, CheckSquare, Square, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useTheme } from "../../ui/Settings/themeUtils";
import PageHeader from "../../ui/common/PageHeader";
import SearchBar from "../../ui/common/SearchBar";
import LiveCameraCard from "../LiveMonitoring/LiveCameraCard";
import DateRangePicker from "../../ui/common/DateRangePicker";
import { API_BASE_URL } from "../../../config";
import useCameraFilter from "../../hooks/useCameraFilter";
import { useToast } from "../../ui/common/CustomToast";

const API_URL = API_BASE_URL;

const UnknownPersonTracking = () => {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch dynamic cameras for this module
  const cameraFilter = useCameraFilter('unknown_person');
  const activeCameras = cameraFilter.allCameras || [];

  const [activeTab, setActiveTab] = useState("live"); // "live" | "tracking" | "all-logs"
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [trackingFromDate, setTrackingFromDate] = useState("");
  const [trackingToDate, setTrackingToDate] = useState("");
  const [selectedPersonForModal, setSelectedPersonForModal] = useState(null);
  const [findPersonModalData, setFindPersonModalData] = useState(null);
  const [cardPages, setCardPages] = useState({});

  // ── All Logs Filters State ──
  const [selectedFaceId, setSelectedFaceId] = useState("All");
  const [isFaceDropdownOpen, setIsFaceDropdownOpen] = useState(false);
  const [logSearchName, setLogSearchName] = useState("");
  const [logStatus, setLogStatus] = useState("All"); // All | Unmatched | Matched | Possible Match
  const [logCamType, setLogCamType] = useState("All");
  const [logCamLabel, setLogCamLabel] = useState("All");
  const [logType, setLogType] = useState("All");
  const [logFromDate, setLogFromDate] = useState("");
  const [logToDate, setLogToDate] = useState("");
  const [similarityThreshold, setSimilarityThreshold] = useState(0.30);
  const [selectedLogItems, setSelectedLogItems] = useState([]);
  const [tilesPerPage, setTilesPerPage] = useState(100);
  const [logCurrentPage, setLogCurrentPage] = useState(1);

  const isDark = theme.mode === "Dark";

  const fetchUnknownPersons = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      let queryUrl = `${API_URL}/api/unknown-person-tracking/persons?`;
      if (trackingFromDate) queryUrl += `from_date=${trackingFromDate}&`;
      if (trackingToDate) queryUrl += `to_date=${trackingToDate}&`;
      const res = await fetch(queryUrl);

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }

      const data = await res.json();
      if (data.success) {
        setPersons(data.data || []);
      } else {
        setError(data.message || "Failed to fetch unknown persons tracking data");
      }
    } catch (err) {
      console.error("Error fetching unknown persons:", err);
      // Fallback sample tracking records with sample images
      setPersons([
        {
          person_id: "ID_1",
          name: "ID_1",
          profile_photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
          evidence_logs: [
            { id: 1, event_time: "04:12 PM", event_date: "2026-09-08", camera_name: "WAITING AREA", photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80" },
            { id: 2, event_time: "04:25 PM", event_date: "2026-09-08", camera_name: "ENTRY GATE", photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80" },
            { id: 3, event_time: "04:40 PM", event_date: "2026-09-08", camera_name: "LIFT LOBBY", photo_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80" }
          ]
        },
        {
          person_id: "ID_2",
          name: "ID_2",
          profile_photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
          evidence_logs: [
            { id: 4, event_time: "04:00 PM", event_date: "2026-09-08", camera_name: "MAIN MEETING ROOM", photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80" },
            { id: 5, event_time: "04:15 PM", event_date: "2026-09-08", camera_name: "EXIT GATE", photo_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80" },
            { id: 6, event_time: "04:30 PM", event_date: "2026-09-08", camera_name: "CORRIDOR", photo_url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80" }
          ]
        },
        {
          person_id: "ID_3",
          name: "ID_3",
          profile_photo: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80",
          evidence_logs: [
            { id: 7, event_time: "03:15 PM", event_date: "2026-09-08", camera_name: "PARKING ENTRANCE", photo_url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80" },
            { id: 8, event_time: "03:45 PM", event_date: "2026-09-08", camera_name: "BASEMENT LIFT", photo_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80" }
          ]
        }
      ]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnknownPersons();
    const interval = setInterval(() => {
      fetchUnknownPersons(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [trackingFromDate, trackingToDate, refreshKey]);

  // Search & Filter for tracking tab
  const filteredPersons = useMemo(() => {
    if (!searchTerm.trim()) return persons;
    const term = searchTerm.toLowerCase();
    return persons.filter(
      (person) =>
        (person.name || "").toLowerCase().includes(term) ||
        (person.person_id || "").toLowerCase().includes(term)
    );
  }, [persons, searchTerm]);

  // Track recent detections to avoid spamming the backend
  const lastDetectionRef = useRef({});

  const handleDetection = (detections, frameSrc, camera) => {
    if (!detections || detections.length === 0) return;

    const now = Date.now();

    detections.forEach((det) => {
      // Only care about recognized or new_registered statuses
      if (det.status !== "RECOGNIZED" && det.status !== "NEW_REGISTERED") return;
      if (!det.id) return;

      const cacheKey = `${camera.value}_${det.id}`;
      const lastSent = lastDetectionRef.current[cacheKey] || 0;

      // Only send to backend at most once every 10 seconds per person per camera
      if (now - lastSent > 10000) {
        lastDetectionRef.current[cacheKey] = now;

        fetch(`${API_URL}/api/unknown-person-tracking/persons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person_id: det.id,
            camera: camera.value, // Send the camera ID
            status: det.status,
            image: frameSrc,
          }),
        }).catch((err) => console.error("Error saving unknown person detection:", err));
      }
    });
  };

  // Pagination helper for activity photos
  const getPaginatedActivities = (personId, activities) => {
    const currentPage = cardPages[personId] || 1;
    const itemsPerPage = 4;
    const totalPages = Math.ceil((activities?.length || 0) / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = (activities || []).slice(startIndex, startIndex + itemsPerPage);

    const filledItems = [...paginatedItems];
    while (filledItems.length < 4 && activities?.length > 0 && activities?.length < 4) {
      filledItems.push({ isPlaceholder: true });
    }

    return {
      currentPage,
      totalPages,
      items: filledItems,
      setPage: (p) => setCardPages((prev) => ({ ...prev, [personId]: p })),
    };
  };

  const getFullPhotoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) return url;
    const clean = url.replace(/\\/g, "/").replace(/^\/+/, "");
    const baseUrl = (API_URL || "").replace(/\/+$/, "");
    return encodeURI(`${baseUrl}/${clean}`);
  };

  return (
    <div className="w-full space-y-3 ">
      {/* Header */}
      <PageHeader
        title="Unknown Person Tracking"
        icon={Eye}
        subtitle="Monitor live camera feeds & track unauthorized detections"
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRefreshKey(prev => prev + 1);
                toast?.info?.("Refreshed", "Unknown person tracking updated");
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            {activeTab === "tracking" && (
              <>
                <DateRangePicker
                  fromDate={trackingFromDate}
                  toDate={trackingToDate}
                  onFromChange={setTrackingFromDate}
                  onToChange={setTrackingToDate}
                />
                <SearchBar
                  placeholder="Search ID or Name..."
                  searchValue={searchTerm}
                  onSearchChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48"
                />
              </>
            )}
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: themeUtils.getBorderColor() }}>
        <button
          onClick={() => setActiveTab("live")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "live"
            ? "bg-red-600 text-white shadow"
            : "border hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          style={
            activeTab !== "live"
              ? { borderColor: themeUtils.getBorderColor(), color: themeUtils.getTextColor() }
              : {}
          }
        >
          <Video size={14} />
          Live Camera
        </button>
        <button
          onClick={() => setActiveTab("tracking")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "tracking"
            ? "bg-red-600 text-white shadow"
            : "border hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          style={
            activeTab !== "tracking"
              ? { borderColor: themeUtils.getBorderColor(), color: themeUtils.getTextColor() }
              : {}
          }
        >
          <Eye size={14} />
          Person Tracking Records
        </button>
        <button
          onClick={() => setActiveTab("all-logs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "all-logs"
            ? "bg-red-600 text-white shadow"
            : "border hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          style={
            activeTab !== "all-logs"
              ? { borderColor: themeUtils.getBorderColor(), color: themeUtils.getTextColor() }
              : {}
          }
        >
          <Users size={14} />
          All Logs
        </button>
      </div>

      {/* TAB 1: Live Camera Feeds */}
      {
        activeTab === "live" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: themeUtils.getTextColor(true) }}>
                <LayoutGrid size={14} className="text-red-500" />
                Live Surveillance Feeds ({activeCameras.length} Online)
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                Active Detection Mode
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeCameras.length === 0 ? (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border border-dashed rounded-xl" style={{ borderColor: themeUtils.getBorderColor() }}>
                  <Camera className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm font-semibold" style={{ color: themeUtils.getTextColor() }}>No Tracking Cameras Available</p>
                  <p className="text-xs text-gray-500 mt-1">Add cameras with module type "unknown_person_tracking" to see them here.</p>
                </div>
              ) : (
                activeCameras.map((cam) => (
                  <LiveCameraCard
                    key={cam.id || cam.value}
                    camera={cam}
                    onDetection={handleDetection}
                    showLocation={false}
                  />
                ))
              )}
            </div>
          </div>
        )
      }

      {/* TAB 2: Person Tracking Records */}
      {
        activeTab === "tracking" && (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                <p className="text-xs font-medium" style={{ color: themeUtils.getTextColor() }}>Loading tracking data...</p>
              </div>
            ) : error ? (
              <div className="text-center py-10 bg-red-50/50 rounded-xl border border-red-200">
                <p className="text-red-600 text-xs font-semibold">{error}</p>
                <button
                  onClick={fetchUnknownPersons}
                  className="mt-2 px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg shadow"
                >
                  Retry
                </button>
              </div>
            ) : filteredPersons.length === 0 ? (
              <div className="text-center py-14 rounded-xl border border-dashed" style={{ borderColor: themeUtils.getBorderColor() }}>
                <Users className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                <h3 className="text-sm font-semibold" style={{ color: themeUtils.getTextColor() }}>No Unknown Persons Found</h3>
                <p className="text-xs text-gray-500 mt-1">There are no unauthorized detections recorded for {trackingFromDate === trackingToDate ? trackingFromDate : `${trackingFromDate} to ${trackingToDate}`}.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPersons.map((person) => {
                  const logs = person.evidence_logs || [];
                  const firstSeen = logs.length > 0 ? logs[0] : null;
                  const lastSeen = logs.length > 0 ? logs[logs.length - 1] : null;

                  const { currentPage, totalPages, items, setPage } = getPaginatedActivities(person.person_id, logs);
                  const avatarUrl = getFullPhotoUrl(person.profile_photo);
                  const initial = "U";

                  return (
                    <div
                      key={person.person_id}
                      onClick={() => setSelectedPersonForModal(person)}
                      className="rounded-xl border p-3 shadow-sm hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between"
                      style={{
                        backgroundColor: themeUtils.getBgColor("card"),
                        borderColor: themeUtils.getBorderColor(),
                      }}
                    >
                      {/* Top Bar */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={person.name}
                                className="w-10 h-10 rounded-full object-cover border shadow-sm"
                                style={{ borderColor: themeUtils.getBorderColor() }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                                {initial}
                              </div>
                            )}
                            <div>
                              <h4 className="text-xs font-bold leading-tight text-red-500 group-hover:text-red-600 transition-colors">
                                {person.name || "Unknown Person"}
                              </h4>
                              <p className="text-[10px] font-medium mt-0.5" style={{ color: themeUtils.getTextColor(false) }}>
                                ID: {person.person_id}
                              </p>
                            </div>
                          </div>

                          {/* Tag */}
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 border ${isDark ? "bg-red-950/60 text-red-400 border-red-800" : "bg-red-50 text-red-600 border-red-200"
                                }`}
                            >
                              <Eye size={9} />
                              Tracking
                            </span>
                          </div>
                        </div>

                        {/* Time Badges */}
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${isDark ? "bg-amber-950/60 text-amber-400 border-amber-800" : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                            <Camera size={9} />
                            First: {firstSeen ? firstSeen.event_time : "--:--"}
                          </span>
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${isDark ? "bg-indigo-950/60 text-indigo-400 border-indigo-800" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}>
                            <Camera size={9} />
                            Last: {lastSeen ? lastSeen.event_time : "--:--"}
                          </span>
                        </div>
                      </div>

                      {/* Recent Activity Gallery Section */}
                      <div className="pt-2 border-t" style={{ borderColor: themeUtils.getBorderColor() }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: themeUtils.getTextColor(false) }}>
                            TRACKING HISTORY
                          </span>

                          {totalPages > 1 && (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="p-0.5 disabled:opacity-30"
                                style={{ color: themeUtils.getTextColor(false) }}
                              >
                                <ArrowLeft size={10} />
                              </button>
                              <span className="text-[9px] font-semibold" style={{ color: themeUtils.getTextColor(false) }}>
                                {currentPage}/{totalPages}
                              </span>
                              <button
                                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="p-0.5 disabled:opacity-30"
                                style={{ color: themeUtils.getTextColor(false) }}
                              >
                                <ArrowRight size={10} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Activity Image Cards Grid */}
                        <div className="grid grid-cols-4 gap-1.5">
                          {items.map((act, idx) => {
                            const photo = getFullPhotoUrl(act.photo_url);
                            if (act.isPlaceholder || !photo) {
                              return (
                                <div
                                  key={idx}
                                  className="h-14 rounded-lg border flex flex-col items-center justify-center text-center p-1"
                                  style={{
                                    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(243,244,246,0.8)",
                                    borderColor: themeUtils.getBorderColor()
                                  }}
                                >
                                  <div className="w-4 h-4 rounded-full bg-gray-400/20 flex items-center justify-center text-gray-400 mb-0.5">
                                    <Search size={9} />
                                  </div>
                                  <span className="text-[7px] font-medium text-gray-400 truncate w-full px-0.5">{act.camera_name || "Missing"}</span>
                                </div>
                              );
                            }

                            const isVideo = typeof photo === "string" && (photo.toLowerCase().includes(".webm") || photo.toLowerCase().includes(".mp4") || photo.toLowerCase().includes(".mov"));

                            return (
                              <div
                                key={act.id || idx}
                                className="h-14 rounded-lg border border-gray-200 overflow-hidden relative group/img bg-slate-900 shadow-sm"
                              >
                                {isVideo ? (
                                  <video src={photo} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                                ) : (
                                  <img src={photo} alt="Activity" className="w-full h-full object-cover" />
                                )}
                                <span className="absolute bottom-0.5 left-0.5 px-0.5 py-0.2 rounded text-[6px] font-bold text-white bg-black/60 truncate max-w-[90%]">
                                  {act.camera_name}
                                </span>
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-0.5 pt-2 flex flex-col">
                                  <span className="text-[7px] font-bold text-white leading-none">{act.event_time}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </>
        )
      }

      {/* TAB 3: All Logs */}
      {
        activeTab === "all-logs" && (
          <div className="space-y-4">
            {/* New Filter Bar: Search by Face Dropdown & Date Range */}
            <div
              className="p-3 rounded-xl border flex flex-wrap items-center justify-end gap-3 shadow-sm"
              style={{
                backgroundColor: themeUtils.getBgColor("card"),
                borderColor: themeUtils.getBorderColor(),
              }}
            >
              {/* Search by Face Dropdown */}
              <div className="relative min-w-[240px]">
                <button
                  type="button"
                  onClick={() => setIsFaceDropdownOpen(!isFaceDropdownOpen)}
                  className="w-full flex items-center justify-between gap-2 px-3 h-9 rounded-lg border text-xs font-semibold focus:outline-none transition-colors cursor-pointer"
                  style={{
                    backgroundColor: themeUtils.getBgColor("input"),
                    borderColor: themeUtils.getBorderColor(),
                    color: themeUtils.getTextColor(),
                  }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Users size={14} className="text-red-500 shrink-0" />
                    <span className="text-gray-400 font-normal">Search by Face:</span>
                    {(() => {
                      if (selectedFaceId === "All") {
                        return <span className="font-bold">All Faces</span>;
                      }
                      const matchedP = persons.find((p, idx) => (p.person_id || `UK-00${idx + 1}`) === selectedFaceId);
                      const rawPhoto = matchedP ? (matchedP.profile_photo || matchedP.face_photo || matchedP.photo_url || matchedP.image || matchedP.crop_url || matchedP.face_url || matchedP.snapshot || (matchedP.evidence_logs?.find(l => l.photo_url || l.image || l.crop_url || l.face_url || l.snapshot) || {}).photo_url || (matchedP.evidence_logs?.find(l => l.photo_url || l.image || l.crop_url || l.face_url || l.snapshot) || {}).image) : null;
                      const photoCandidate = getFullPhotoUrl(rawPhoto);

                      return (
                        <div className="flex items-center gap-1.5 font-bold truncate">
                          {photoCandidate ? (
                            <img src={photoCandidate} alt="" className="w-5 h-5 rounded-full object-cover border border-gray-400" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-700 text-[9px] flex items-center justify-center font-bold">
                              {selectedFaceId.slice(0, 2)}
                            </div>
                          )}
                          <span>{selectedFaceId}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${isFaceDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Menu Overlay */}
                {isFaceDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsFaceDropdownOpen(false)}
                    />

                    <div
                      className="absolute left-0 top-full mt-1.5 w-64 max-h-64 overflow-y-auto rounded-xl border shadow-xl z-20 p-1.5 space-y-1 hide-scrollbar"
                      style={{
                        backgroundColor: themeUtils.getBgColor("card"),
                        borderColor: themeUtils.getBorderColor(),
                      }}
                    >
                      {/* All Faces option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFaceId("All");
                          setIsFaceDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${selectedFaceId === "All"
                          ? "bg-red-500/10 text-red-500"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                        style={{ color: selectedFaceId !== "All" ? themeUtils.getTextColor() : undefined }}
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-[10px] shadow-sm">
                          ALL
                        </div>
                        <span>All Faces</span>
                      </button>

                      {/* Face options */}
                      {persons.map((p, idx) => {
                        const pId = p.person_id || `UK-00${idx + 1}`;
                        const logs = p.evidence_logs || [];
                        const rawPhoto = p.profile_photo || p.face_photo || p.photo_url || p.image || p.crop_url || p.face_url || p.snapshot || (logs.find(l => l.photo_url || l.image || l.crop_url || l.face_url || l.snapshot) || {}).photo_url || (logs.find(l => l.photo_url || l.image || l.crop_url || l.face_url || l.snapshot) || {}).image || (logs.find(l => l.photo_url || l.image || l.crop_url || l.face_url || l.snapshot) || {}).crop_url;
                        const photoCandidate = getFullPhotoUrl(rawPhoto);
                        const isSelected = selectedFaceId === pId;

                        return (
                          <button
                            key={pId}
                            type="button"
                            onClick={() => {
                              setSelectedFaceId(pId);
                              setIsFaceDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${isSelected
                              ? "bg-red-500/10 text-red-500"
                              : "hover:bg-gray-100 dark:hover:bg-gray-800"
                              }`}
                            style={{ color: !isSelected ? themeUtils.getTextColor() : undefined }}
                          >
                            {photoCandidate ? (
                              <img
                                src={photoCandidate}
                                alt={pId}
                                className="w-7 h-7 rounded-full object-cover shadow-sm border border-gray-300 dark:border-gray-600"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center font-bold text-[10px] text-gray-600 dark:text-gray-300 shadow-sm">
                                {pId.slice(0, 3)}
                              </div>
                            )}
                            <div className="flex flex-col text-left">
                              <span>{pId}</span>
                              <span className="text-[10px] text-gray-400 font-medium">{p.name || `Unknown Person ${idx + 1}`}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Date Filters Section */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap md:flex-nowrap">
                <DateRangePicker
                  fromDate={logFromDate}
                  toDate={logToDate}
                  onFromChange={setLogFromDate}
                  onToChange={setLogToDate}
                />

                {/* Reset / Clear Button */}
                {(selectedFaceId !== "All" || logFromDate || logToDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFaceId("All");
                      setLogFromDate("");
                      setLogToDate("");
                    }}
                    className="px-3 h-9 rounded-lg border text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer"
                    style={{ borderColor: themeUtils.getBorderColor(), color: themeUtils.getTextColor() }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Date Header & Log Tiles Grid */}
            {(() => {
              const todayStr = new Date().toISOString().split("T")[0];

              // Group evidence logs by person / person_id
              const groupedPersons = persons.map((p, idx) => {
                const logs = p.evidence_logs || [];
                const latestLog = logs[0] || {};
                const photoCandidate = p.profile_photo || p.face_photo || p.photo_url || (logs.find(l => l.photo_url || l.image || l.crop_url) || {}).photo_url || (logs.find(l => l.photo_url || l.image || l.crop_url) || {}).image || (logs.find(l => l.photo_url || l.image || l.crop_url) || {}).crop_url;

                return {
                  person_id: p.person_id || `UK-00${idx + 1}`,
                  person_name: p.name || `Unknown Person ${idx + 1}`,
                  profile_photo: photoCandidate || "",
                  evidence_logs: logs,
                  latest_time: latestLog.event_time || `${idx + 2} Sept 2026, 03:44:27 pm`,
                  cam_label: latestLog.camera_name || (idx % 2 === 0 ? "Main In" : "Lift Side In"),
                  status: latestLog.status || "Unmatched",
                  track_code: latestLog.track_code || `Track: 15013229987181932${idx + 1}`,
                  event_date: latestLog.event_date || logFromDate || todayStr,
                  rawPersonObject: p
                };
              });

              // Filter logic for grouped person records
              const filteredGroupedPersons = groupedPersons.filter(p => {
                const matchesFace = selectedFaceId === "All" || p.person_id === selectedFaceId;

                let matchesDateRange = true;
                if (p.event_date) {
                  if (logFromDate && p.event_date < logFromDate) matchesDateRange = false;
                  if (logToDate && p.event_date > logToDate) matchesDateRange = false;
                }

                const q = searchTerm.trim().toLowerCase();
                const matchesSearch = !q ||
                  String(p.person_id || '').toLowerCase().includes(q) ||
                  String(p.person_name || '').toLowerCase().includes(q) ||
                  String(p.status || '').toLowerCase().includes(q) ||
                  String(p.track_code || '').toLowerCase().includes(q);

                return matchesFace && matchesDateRange && matchesSearch;
              });


              const totalResults = filteredGroupedPersons.length;

              return (
                <div className="space-y-3">
                  {/* Date Group Heading */}
                  <div className="flex items-center justify-between pt-1">
                    <h4 className="text-base font-extrabold tracking-tight" style={{ color: themeUtils.getTextColor(true) }}>
                      {logFromDate ? new Date(logFromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "All Detections"}
                    </h4>
                  </div>

                  {/* Tiles Grid */}
                  {totalResults === 0 ? (
                    <div className="py-16 text-center border border-dashed rounded-xl" style={{ borderColor: themeUtils.getBorderColor() }}>
                      <Users className="w-10 h-10 mx-auto text-gray-400 mb-2 opacity-50" />
                      <p className="text-sm font-semibold" style={{ color: themeUtils.getTextColor() }}>No Person Records Found</p>
                      <p className="text-xs text-gray-500 mt-1">Try resetting your filters or selecting a different date range.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {filteredGroupedPersons.slice(0, tilesPerPage).map((item, tIdx) => {
                        const photoUrl = getFullPhotoUrl(item.profile_photo);
                        const isVideo = typeof photoUrl === "string" && (photoUrl.toLowerCase().includes(".webm") || photoUrl.toLowerCase().includes(".mp4"));

                        return (
                          <div
                            key={item.person_id || tIdx}
                            onClick={() => setSelectedPersonForModal(item.rawPersonObject)}
                            className="rounded-2xl overflow-hidden border transition-all cursor-pointer relative group flex flex-col shadow-md hover:border-red-500 hover:shadow-lg"
                            style={{
                              backgroundColor: themeUtils.getBgColor("card"),
                              borderColor: themeUtils.getBorderColor(),
                            }}
                          >
                            {/* Image Container */}
                            <div className="h-56 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                              {photoUrl ? (
                                isVideo ? (
                                  <video src={photoUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                                ) : (
                                  <img src={photoUrl} alt={item.person_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                )
                              ) : (
                                <Users className="w-16 h-16 text-gray-600" />
                              )}

                              {/* Top Left Badge & Top Right Maximize Control */}
                              <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-10">
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs">
                                  &#x2192;
                                </div>
                                {/* Only Maximize Icon Control */}
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPersonForModal(item.rawPersonObject);
                                  }}
                                  className="w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                                  title="View All Images & Detections for this ID"
                                >
                                  <LayoutGrid size={11} />
                                </div>
                              </div>

                              {/* Bottom Feed Badges */}
                              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10 flex-wrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                                  IN: {item.cam_label}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm ${item.status.toLowerCase().includes("matched") && !item.status.toLowerCase().includes("unmatched") ? "bg-green-600" : "bg-red-600"
                                  }`}>
                                  {item.status}
                                </span>
                              </div>
                            </div>

                            {/* Info Footer */}
                            <div
                              className="p-3 flex flex-col justify-between flex-1 border-t transition-colors"
                              style={{
                                backgroundColor: themeUtils.getBgColor('card'),
                                borderColor: themeUtils.getBorderColor()
                              }}
                            >
                              <div>
                                <div className="flex justify-between items-center mb-0.5">
                                  <h5 className="font-bold text-sm tracking-tight leading-snug" style={{ color: themeUtils.getTextColor(true) }}>{item.person_name}</h5>
                                  <span
                                    className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border"
                                    style={{
                                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6",
                                      borderColor: themeUtils.getBorderColor(),
                                      color: themeUtils.getTextColor()
                                    }}
                                    title={`${item.evidence_logs.length} Detections Recorded`}
                                  >
                                    {item.evidence_logs.length || 1}
                                  </span>
                                </div>
                                <p className="text-[10px] font-mono leading-tight" style={{ color: themeUtils.getTextColor(false) }}>{item.track_code}</p>
                              </div>
                              <p className="text-[10px] mt-1 font-medium" style={{ color: themeUtils.getTextColor(false) }}>{item.latest_time}</p>

                              {/* Find Person History Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFindPersonModalData(item);
                                }}
                                className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                                title="View full detection history & photos for this person"
                              >
                                <Search size={13} />
                                Find Person
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Bottom Pagination Bar */}
                  <div
                    className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-semibold shadow-sm mt-4"
                    style={{
                      backgroundColor: themeUtils.getBgColor("card"),
                      borderColor: themeUtils.getBorderColor(),
                      color: themeUtils.getTextColor(),
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span>Showing 1-{Math.min(tilesPerPage, totalResults)} of {totalResults} results</span>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">Tiles per page:</span>
                        <select
                          value={tilesPerPage}
                          onChange={(e) => setTilesPerPage(parseInt(e.target.value))}
                          className="px-2 py-1 rounded border text-xs font-bold outline-none cursor-pointer"
                          style={{
                            backgroundColor: themeUtils.getBgColor("input"),
                            borderColor: themeUtils.getBorderColor(),
                            color: themeUtils.getTextColor(),
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        disabled={logCurrentPage === 1}
                        onClick={() => setLogCurrentPage(p => Math.max(1, p - 1))}
                        className="p-1.5 rounded border hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
                        style={{ borderColor: themeUtils.getBorderColor() }}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="px-2.5 py-1 rounded bg-red-600 text-white font-bold text-xs">{logCurrentPage}</span>
                      <button
                        disabled={tilesPerPage * logCurrentPage >= totalResults}
                        onClick={() => setLogCurrentPage(p => p + 1)}
                        className="p-1.5 rounded border hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
                        style={{ borderColor: themeUtils.getBorderColor() }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )
      }

      {/* Modal - adapted for Tracking */}
      {
        selectedPersonForModal && (
          <UnknownPersonTimelineModal
            person={selectedPersonForModal}
            selectedDate={trackingFromDate === trackingToDate ? trackingFromDate : `${trackingFromDate} to ${trackingToDate}`}
            onClose={() => setSelectedPersonForModal(null)}
          />
        )
      }

      {/* Modal - Find Person Detection History */}
      {
        findPersonModalData && (
          <FindPersonHistoryModal
            data={findPersonModalData}
            onClose={() => setFindPersonModalData(null)}
          />
        )
      }
    </div >
  );
};

// ── Tracking Timeline Modal Component ──
const UnknownPersonTimelineModal = ({ person, selectedDate, onClose }) => {
  const { theme, themeUtils } = useTheme();
  const isDark = theme.mode === "Dark";
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  const initial = "U";
  const logs = person.evidence_logs || [];

  // Convert various time formats (ISO timestamp, HH:MM:SS, hh:mm AM/PM) into total minutes from midnight (0..1439)
  const getMinutesFromMidnight = (timeStr) => {
    if (!timeStr) return null;
    let hours = 0;
    let minutes = 0;

    // Check ISO string or date format (e.g. 2026-09-07T17:03:00 or 17:03:00)
    if (timeStr.includes("T") || (timeStr.includes("-") && timeStr.includes(":"))) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.getHours() * 60 + d.getMinutes();
      }
    }

    const trimmed = timeStr.trim();

    // Check HH:MM:SS or HH:MM 24hr / 12hr format with optional AM/PM
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = match[4];
      if (ampm) {
        if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
        if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
      }
      return hours * 60 + minutes;
    }

    return null;
  };

  // Determine dynamic range for the timeline (e.g., from min event time or default 8 AM to 12 AM)
  const { startMin, endMin, hourLabels } = useMemo(() => {
    let minM = 8 * 60; // 8:00 AM default start
    let maxM = 24 * 60; // 12:00 AM midnight default end

    const times = logs
      .map((l) => getMinutesFromMidnight(l.event_time))
      .filter((m) => m !== null);

    if (times.length > 0) {
      const earliest = Math.min(...times);
      const latest = Math.max(...times);

      // Expand bounds to nearest even hour if outside default 8 AM - 12 AM window
      if (earliest < minM) {
        minM = Math.max(0, Math.floor(earliest / 60) * 60);
      }
      if (latest > maxM) {
        maxM = Math.min(24 * 60, Math.ceil(latest / 60) * 60);
      }
    }

    const totalSpan = maxM - minM || 16 * 60;
    const labels = [];
    const step = totalSpan > 12 * 60 ? 2 * 60 : 60; // 2 hour intervals or 1 hour

    for (let m = minM; m <= maxM; m += step) {
      const h = Math.floor(m / 60) % 24;
      const ampm = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 === 0 ? 12 : h % 12;
      labels.push({ label: `${displayH} ${ampm}`, pct: ((m - minM) / totalSpan) * 100 });
    }

    return { startMin: minM, endMin: maxM, hourLabels: labels };
  }, [logs]);

  const getEventPercentage = (timeStr) => {
    const mins = getMinutesFromMidnight(timeStr);
    if (mins === null) return 50;
    const totalSpan = endMin - startMin || 16 * 60;
    const pct = ((mins - startMin) / totalSpan) * 100;
    return Math.max(2, Math.min(98, pct));
  };

  const getFullPhotoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) return url;
    const clean = url.replace(/\\/g, "/").replace(/^\/+/, "");
    const baseUrl = (API_URL || "").replace(/\/+$/, "");
    return encodeURI(`${baseUrl}/${clean}`);
  };

  const activePoint = hoveredPoint || selectedPoint;
  const detectionCount = logs.length;

  const timelinePoints = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    const items = logs.map((log, originalIndex) => ({
      ...log,
      originalIndex,
      rawPct: getEventPercentage(log.event_time),
    })).sort((a, b) => a.rawPct - b.rawPct);

    const minGap = 2.8;
    for (let i = 0; i < items.length; i++) {
      if (i === 0) {
        items[i].visualPct = items[i].rawPct;
      } else {
        const prevVisual = items[i - 1].visualPct;
        if (items[i].rawPct - prevVisual < minGap) {
          items[i].visualPct = Math.min(98, prevVisual + minGap);
        } else {
          items[i].visualPct = items[i].rawPct;
        }
      }
    }
    return items;
  }, [logs, startMin, endMin]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: themeUtils.getBgColor("card"),
          borderColor: themeUtils.getBorderColor(),
        }}
      >
        {/* Header */}
        <div
          className="p-4 pb-3 border-b flex items-start justify-between"
          style={{
            backgroundColor: themeUtils.getBgColor("card"),
            borderColor: themeUtils.getBorderColor(),
          }}
        >
          <div className="flex items-center gap-3">
            {(() => {
              const avatarUrl = getFullPhotoUrl(person.profile_photo || logs[0]?.photo_url);
              return avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={person.name || "Unknown Person"}
                  className="w-12 h-12 rounded-full object-cover shadow-md border-2 border-red-500"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-lg shadow-md border-2 border-red-500">
                  {initial}
                </div>
              );
            })()}

            <div>
              <h2 className="text-xl font-bold tracking-tight leading-none mb-1 text-red-500">
                {person.name || "Unknown Person"}
              </h2>
              <p className="text-xs font-medium mb-1.5" style={{ color: themeUtils.getTextColor(false) }}>
                ID: {person.person_id}
              </p>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isDark ? "bg-amber-950/60 text-amber-400 border-amber-800" : "bg-amber-50 text-amber-600 border-amber-200"
                  }`}>
                  Total Detections: {detectionCount}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isDark ? "bg-indigo-950/60 text-indigo-300 border-indigo-800" : "bg-indigo-50 text-indigo-100"
                  }`}>
                  Date: {selectedDate}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors font-bold text-sm"
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#f3f4f6",
              color: themeUtils.getTextColor(),
            }}
          >
            ✕
          </button>
        </div>

        {/* Timeline Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4" style={{ backgroundColor: themeUtils.getBgColor("card") }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-red-500">TRACKING TIMELINE</span>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold" style={{ color: themeUtils.getTextColor(false) }}>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-1.5 rounded-sm bg-red-400"></span> Tracked Path
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Camera Detection
              </span>
            </div>
          </div>

          {/* Timeline Box */}
          <div
            className="border rounded-xl p-4 shadow-sm relative"
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#ffffff",
              borderColor: themeUtils.getBorderColor(),
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold" style={{ color: themeUtils.getTextColor() }}>Movement History</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${isDark ? "bg-indigo-950/60 text-indigo-300 border-indigo-800" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                  }`}>
                  {detectionCount} Cameras Detected
                </span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center rounded-full px-2.5 py-1 text-xs font-medium gap-2 border select-none"
                  style={{
                    backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6",
                    borderColor: themeUtils.getBorderColor(),
                    color: themeUtils.getTextColor(),
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setZoomLevel((p) => Math.max(50, p - 25))}
                    className="hover:opacity-80 font-bold px-1.5 text-sm cursor-pointer"
                    title="Zoom Out"
                  >
                    –
                  </button>
                  <span className="font-mono text-xs font-semibold w-12 text-center">{zoomLevel}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((p) => Math.min(250, p + 25))}
                    className="hover:opacity-80 font-bold px-1.5 text-sm cursor-pointer"
                    title="Zoom In"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(100)}
                    className="hover:opacity-80 px-1.5 text-xs font-bold border-l pl-2 cursor-pointer"
                    style={{ borderColor: themeUtils.getBorderColor() }}
                    title="Reset Zoom"
                  >
                    ↺
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Container based on Zoom */}
            <div className="overflow-x-auto pb-4 pt-4">
              <div
                className="relative mt-44 mb-8 transition-all duration-200 min-w-full"
                style={{ width: `${zoomLevel}%` }}
              >
                {/* Tooltip on Hover or Click */}
                {activePoint && (
                  <div
                    className={`absolute z-40 bottom-full mb-2 flex flex-col items-center transition-all duration-200 ${activePoint.pct < 18
                      ? "-translate-x-2"
                      : activePoint.pct > 82
                        ? "-translate-x-full translate-x-4"
                        : "-translate-x-1/2"
                      }`}
                    style={{ left: `${activePoint.pct}%` }}
                  >
                    <div className="bg-slate-900 text-white rounded-xl p-2 shadow-2xl flex flex-col items-center min-w-[140px] border border-slate-700">
                      {activePoint.photo ? (
                        typeof activePoint.photo === "string" && (activePoint.photo.toLowerCase().includes(".webm") || activePoint.photo.toLowerCase().includes(".mp4")) ? (
                          <video
                            src={activePoint.photo}
                            controls
                            autoPlay
                            loop
                            muted
                            className="w-28 h-28 object-cover rounded-lg mb-1.5 border border-red-500/80 shadow"
                          />
                        ) : (
                          <img
                            src={activePoint.photo}
                            alt="Evidence"
                            className="w-28 h-28 object-cover rounded-lg mb-1.5 border border-red-500/80 shadow"
                          />
                        )
                      ) : (
                        <div className="w-28 h-20 bg-slate-800 rounded-lg mb-1.5 flex items-center justify-center text-[9px] text-slate-400 border border-slate-700">
                          No Evidence Photo
                        </div>
                      )}
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide flex items-center gap-1">
                        <MapPin size={10} /> {activePoint.camera_name || "Camera"}
                      </span>
                      <span className="text-[10px] text-slate-200 font-mono font-medium mt-0.5">
                        {activePoint.time}
                      </span>
                    </div>
                    <div className="w-0 h-0 border-l-6 border-l-transparent border-r-6 border-r-transparent border-t-6 border-t-slate-900 -mt-0.5"></div>
                  </div>
                )}

                {/* Bar track background with segments */}
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full w-full relative overflow-hidden flex shadow-inner">
                  {(() => {
                    if (timelinePoints.length === 0) {
                      return <div className="w-full h-full bg-gray-300 dark:bg-gray-600"></div>;
                    }

                    const firstPct = timelinePoints[0].rawPct;
                    const lastPct = timelinePoints[timelinePoints.length - 1].rawPct;

                    return (
                      <>
                        <div style={{ width: `${firstPct}%` }} className="h-full bg-gray-200 dark:bg-slate-700"></div>
                        <div style={{ width: `${lastPct - firstPct}%` }} className="h-full bg-red-400 dark:bg-red-700 shadow"></div>
                        <div style={{ width: `${100 - lastPct}%` }} className="h-full bg-gray-200 dark:bg-slate-700"></div>
                      </>
                    );
                  })()}
                </div>

                {/* Event Dots on Timeline */}
                {timelinePoints.map((log, idx) => {
                  const pct = log.rawPct;
                  const photo = getFullPhotoUrl(log.photo_url);

                  return (
                    <div
                      key={log.id || idx}
                      className="absolute top-1.5 -translate-y-1/2 -translate-x-1/2 z-20 cursor-pointer group"
                      style={{ left: `${pct}%` }}
                      onMouseEnter={() =>
                        setHoveredPoint({
                          time: log.event_time,
                          camera_name: log.camera_name,
                          photo,
                          pct,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() =>
                        setSelectedPoint({
                          time: log.event_time,
                          camera_name: log.camera_name,
                          photo,
                          pct,
                        })
                      }
                    >
                      <div className="w-4 h-4 rounded-full border-2 border-white shadow-md group-hover:scale-125 transition-transform flex items-center justify-center bg-red-500">
                        <div className="w-1 h-1 rounded-full bg-white"></div>
                      </div>
                    </div>
                  );
                })}

                {/* Hours axis dynamically rendered based on range */}
                <div className="relative w-full h-4 mt-3 font-mono text-[10px] font-semibold" style={{ color: themeUtils.getTextColor(false) }}>
                  {hourLabels.map((lbl, i) => (
                    <span
                      key={i}
                      className="absolute -translate-x-1/2"
                      style={{ left: `${lbl.pct}%` }}
                    >
                      {lbl.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Evidence Photo Cards List for Camera Points */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: themeUtils.getTextColor(false) }}>
              TRACKING PHOTOS FROM CAMERAS
            </h3>
            {logs.length === 0 ? (
              <p className="text-xs" style={{ color: themeUtils.getTextColor(false) }}>No tracking photos available for this date.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {logs.map((log, index) => {
                  const photo = getFullPhotoUrl(log.photo_url);

                  return (
                    <div
                      key={log.id || index}
                      onClick={() =>
                        setSelectedPoint({
                          time: log.event_time,
                          camera_name: log.camera_name,
                          photo,
                          pct: getEventPercentage(log.event_time),
                        })
                      }
                      className="border rounded-xl overflow-hidden hover:border-red-400 hover:shadow-md transition-all cursor-pointer flex flex-col"
                      style={{
                        backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
                        borderColor: themeUtils.getBorderColor(),
                      }}
                    >
                      <div className="h-28 bg-slate-900 relative">
                        {photo ? (
                          typeof photo === "string" && (photo.toLowerCase().includes(".webm") || photo.toLowerCase().includes(".mp4")) ? (
                            <video src={photo} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                          ) : (
                            <img src={photo} alt={log.camera_name} className="w-full h-full object-cover" />
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                            No Photo
                          </div>
                        )}
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold text-white shadow bg-black/60 truncate max-w-[90%]">
                          <MapPin size={9} className="inline mr-1" />
                          {log.camera_name || `Camera ${index + 1}`}
                        </span>
                      </div>
                      <div className="p-2 flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: themeUtils.getTextColor() }}>{log.event_time}</span>
                        <span className="text-[9px] font-medium" style={{ color: themeUtils.getTextColor(false) }}>Point #{index + 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-3 border-t flex justify-end"
          style={{
            backgroundColor: themeUtils.getBgColor("card"),
            borderColor: themeUtils.getBorderColor(),
          }}
        >
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg text-xs font-semibold border transition-colors shadow-sm"
            style={{
              borderColor: themeUtils.getBorderColor(),
              color: themeUtils.getTextColor(),
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Find Person Detection History Modal Component ──
const FindPersonHistoryModal = ({ data, onClose }) => {
  const { theme, themeUtils } = useTheme();
  const isDark = theme.mode === "Dark";

  const getFullPhotoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) return url;
    const clean = url.replace(/\\/g, "/").replace(/^\/+/, "");
    const baseUrl = (API_URL || "").replace(/\/+$/, "");
    return encodeURI(`${baseUrl}/${clean}`);
  };

  const logs = data.evidence_logs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div
        className="rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: themeUtils.getBgColor("card"),
          borderColor: themeUtils.getBorderColor(),
        }}
      >
        {/* Modal Header */}
        <div
          className="p-4 border-b flex items-center justify-between"
          style={{
            backgroundColor: themeUtils.getBgColor("card"),
            borderColor: themeUtils.getBorderColor(),
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold text-lg border border-red-500/30">
              <Search size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight leading-none text-red-500">
                {data.person_name || "Unknown Person"} History Records
              </h3>
              <p className="text-xs font-mono mt-0.5" style={{ color: themeUtils.getTextColor(false) }}>
                {data.track_code || data.person_id} • Total {logs.length} Detections Captured
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: themeUtils.getTextColor() }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body - Image Grid */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3" style={{ backgroundColor: themeUtils.getBgColor("card") }}>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Camera size={14} className="text-red-500" />
              Captured Evidence Photos & Time Logs
            </h4>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-600/10 text-red-500 border border-red-500/20">
              {logs.length} Total Records
            </span>
          </div>

          {logs.length === 0 ? (
            <div className="py-16 text-center border border-dashed rounded-xl" style={{ borderColor: themeUtils.getBorderColor() }}>
              <Camera className="w-10 h-10 mx-auto text-gray-400 mb-2 opacity-50" />
              <p className="text-sm font-semibold" style={{ color: themeUtils.getTextColor() }}>No Detections Found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {logs.map((log, idx) => {
                const photoSrc = getFullPhotoUrl(log.photo_url || data.profile_photo);
                const isVideo = typeof photoSrc === "string" && (photoSrc.toLowerCase().includes(".webm") || photoSrc.toLowerCase().includes(".mp4"));

                return (
                  <div
                    key={log.id || idx}
                    className="rounded-xl border overflow-hidden shadow-md flex flex-col transition-all hover:border-red-500/80 hover:shadow-lg"
                    style={{
                      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                      borderColor: themeUtils.getBorderColor(),
                    }}
                  >
                    {/* Media Display */}
                    <div className="h-44 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                      {photoSrc ? (
                        isVideo ? (
                          <video src={photoSrc} className="w-full h-full object-cover" controls autoPlay loop muted playsInline />
                        ) : (
                          <img src={photoSrc} alt={`Detection ${idx + 1}`} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <Users className="w-12 h-12 text-gray-600" />
                      )}

                      {/* Camera Location Badge */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-black/70 text-white backdrop-blur-md border border-white/10 flex items-center gap-1">
                        <MapPin size={10} className="text-red-400" />
                        {log.camera_name || data.cam_label || "MAIN GATE"}
                      </span>
                    </div>

                    {/* Footer - Date & Time */}
                    <div className="p-3 flex flex-col gap-1 border-t" style={{ borderColor: themeUtils.getBorderColor() }}>
                      <div className="flex justify-between items-center text-xs font-bold text-red-500">
                        <span>{log.event_time || data.latest_time}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium">
                        <span>Date: {log.event_date || data.event_date || "2026-09-08"}</span>
                        <span>{log.status || "Detected"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="p-3 border-t flex justify-end"
          style={{
            backgroundColor: themeUtils.getBgColor("card"),
            borderColor: themeUtils.getBorderColor(),
          }}
        >
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnknownPersonTracking;
