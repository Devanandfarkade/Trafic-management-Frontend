import React, { useState, useEffect, useMemo } from "react";
import { Plus, Eye, Edit, Trash2, Camera, MapPin, Cpu, RefreshCw } from 'lucide-react';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { useTheme } from "../../ui/Settings/themeUtils";
import { useToast } from "../../ui/common/CustomToast";
import Pagination from "../../ui/common/Pagination";
import RecordsPerPage from "../../ui/common/RecordsPerPage";
import GlobalCameraFilter from "../../ui/common/GlobalCameraFilter";
import useCameraFilter from "../../hooks/useCameraFilter";
import RightSideDialog from "../../ui/common/RightSideDialog";
import CustomConfirmDialog from "../../ui/common/CustomConfirmDialog";
import SearchableSelect from "../../ui/common/SearchableSelect";
import { API_BASE_URL } from "../../../config.js";

// Mapping for backward compatibility with older data
const reverseModuleMap = {
  no_parking: "No Parking Detection",
  in_out: "In and Out Detection",
  heavy_vehicle: "Heavy Vehicle Detection",
  ai_incident: "AI Incident Detection",
};

export default function CameraManagement() {
  const { theme, themeUtils } = useTheme();

  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();
  const isDark = theme.mode === "Dark";
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor("card");
  const inputBorderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  // Metadata from DB
  const [zones, setZones] = useState([]);
  const [locationsMap, setLocationsMap] = useState({}); // mapped by zone_id
  const [dbFeatures, setDbFeatures] = useState([]);

  // Controls State
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Global Camera Filter Hook for Zone, Location & Camera filtering
  const cameraFilter = useCameraFilter(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add", "edit", "view"
  const [activeStep, setActiveStep] = useState(1); // 1: Basic Info, 2: AI Features
  const [selectedCamera, setSelectedCamera] = useState(null);

  // Delete Dialog State
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [cameraToDelete, setCameraToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    rtsp_url: "",
    zone_id: "",
    location_id: "",
    latitude: "",
    longitude: "",
    feature_ids: [],
  });

  // Initial Data Fetch
  const fetchInitialData = async () => {
    if (!API_BASE_URL) return;
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/cameras`).then(res => res.json()),
        fetch(`${API_BASE_URL}/api/locations/zones`).then(res => res.json()),
        fetch(`${API_BASE_URL}/api/features`).then(res => res.json())
      ]);

      if (results[0].status === 'fulfilled' && results[0].value.cameras) {
        const camData = results[0].value;
        const mapped = camData.cameras.map((c) => ({
          id: c.camera_id || c.id,
          name: c.camera_name || c.name || "",
          rtsp_url: c.rtsp_url || c.rtsp || "",
          location: c.locationid?.location || c.location?.location || c.location || "",
          zone_id: c.zoneid?.zone_id || c.zone_id || "",
          zone_name: c.zoneid?.name || c.zoneid?.zone || c.zone?.name || c.zone?.zone || c.zone || "",
          location_id: c.locationid?.location_id || c.location_id || "",
          longitude: c.locationid?.longitude || c.longitude || "",
          latitude: c.locationid?.latitude || c.latitude || "",
          usedFor: reverseModuleMap[c.module_type] || c.module_type || "no_parking",
          camera_code: c.camera_code,
          features: c.features || [],
          is_active: c.is_active,
        }));
        setCameras(mapped);
      } else {
        console.error("Failed to fetch cameras:", results[0].reason);
      }

      if (results[1].status === 'fulfilled' && results[1].value.success) {
        const sortedZones = [...(results[1].value.zones || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setZones(sortedZones);
      } else {
        console.error("Failed to fetch zones:", results[1].reason);
      }

      if (results[2].status === 'fulfilled' && results[2].value.success) {
        setDbFeatures(results[2].value.features || []);
      } else {
        console.error("Failed to fetch features:", results[2].reason);
      }
    } catch (err) {
      console.error("Error fetching camera init data:", err);
      toast?.error?.("Error", "Failed to load camera data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInitialData(); }, [refreshKey]);

  // Fetch Locations when Premise changes
  const fetchLocationsForZone = async (zoneId) => {
    if (!zoneId) return;
    if (locationsMap[zoneId]) return; // already cached
    try {
      const res = await fetch(`${API_BASE_URL}/api/locations/by-zone/${zoneId}`);
      const data = await res.json();
      if (data.success) {
        const sortedLocs = [...(data.locations || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setLocationsMap(prev => ({ ...prev, [zoneId]: sortedLocs }));
      }
    } catch (err) { console.error("Error fetching locations", err); }
  };

  useEffect(() => {
    if (formData.zone_id) {
      fetchLocationsForZone(formData.zone_id);
    }
  }, [formData.zone_id, refreshKey]);

  const handleOpenModal = async (mode, camera = null) => {
    setModalMode(mode);
    setActiveStep(1);
    if (camera) {
      setSelectedCamera(camera);
      // Fetch specifically mapped features
      let mappedFeatureIds = [];
      try {
        const res = await fetch(`${API_BASE_URL}/api/features/camera/${camera.id}`);
        const data = await res.json();
        if (data.success) {
          mappedFeatureIds = data.features.map(f => f.id);
        }
      } catch (err) { }

      setFormData({
        ...camera,
        feature_ids: mappedFeatureIds,
      });
      if (camera.zone_id) {
        fetchLocationsForZone(camera.zone_id);
      }
    } else {
      setSelectedCamera(null);
      setFormData({
        name: "",
        rtsp_url: "",
        zone_id: "",
        location_id: "",
        latitude: "",
        longitude: "",
        usedFor: "",
        feature_ids: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCamera(null);
    setActiveStep(1);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Auto-fill Lat/Lng if Location changes
      if (name === "location_id" && value && updated.zone_id) {
        const locs = locationsMap[updated.zone_id] || [];
        const loc = locs.find(l => String(l.id) === String(value));
        if (loc) {
          updated.latitude = loc.latitude || "";
          updated.longitude = loc.longitude || "";
        }
      }

      // Clear Location if Zone changes
      if (name === "zone_id") {
        updated.location_id = "";
        updated.latitude = "";
        updated.longitude = "";
      }

      return updated;
    });
  };

  const handleFeatureToggle = (featureId) => {
    if (modalMode === "view") return;
    setFormData((prev) => {
      const current = prev.feature_ids || [];
      const updated = current.includes(featureId)
        ? current.filter((id) => id !== featureId)
        : [...current, featureId];
      return { ...prev, feature_ids: updated };
    });
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    const rtspRegex = /^rtsp:\/\/[^\s]+$/i;
    if (!formData.rtsp_url || !rtspRegex.test(formData.rtsp_url.trim())) {
      toast?.error?.("Validation Error", "Please enter a valid RTSP URL (e.g. rtsp://192.168.1.100:554/stream)");
      return;
    }
    if (!formData.zone_id || !formData.location_id) {
      toast?.error?.("Validation Error", "Please select a Zone and Location");
      return;
    }
    setActiveStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!API_BASE_URL) return;

    try {
      const payload = {
        name: formData.name,
        rtsp_url: formData.rtsp_url,
        zone_id: formData.zone_id,
        location_id: formData.location_id,
        module_type: formData.usedFor || "no_parking",
      };

      let cameraId = selectedCamera?.id;

      if (modalMode === "add") {
        const res = await fetch(`${API_BASE_URL}/api/cameras`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          cameraId = data.id || data.camera?.id;
          toast?.success?.("Success", "Camera added successfully");
        } else {
          toast?.error?.("Error", data.message || "Failed to add camera");
          return;
        }
      } else if (modalMode === "edit" && cameraId) {
        const res = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast?.success?.("Success", "Camera updated successfully");
        } else {
          toast?.error?.("Error", data.message || "Failed to update camera");
          return;
        }
      }

      // Map features
      if (cameraId) {
        await fetch(`${API_BASE_URL}/api/features/camera/${cameraId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feature_ids: formData.feature_ids }),
        });
      }

      fetchInitialData();
      if (cameraFilter?.refetch) cameraFilter.refetch();
      handleCloseModal();
    } catch (err) {
      console.error("Error saving camera:", err);
      toast?.error?.("Error", "Server error while saving camera");
    }
  };

  const confirmDelete = (camera) => {
    setCameraToDelete(camera);
    setDeleteDialogVisible(true);
  };

  const executeDelete = async () => {
    if (!cameraToDelete || !API_BASE_URL) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/cameras/${cameraToDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast?.error?.("Success", `Camera "${cameraToDelete.name}" deleted successfully`);
        setCameras((prev) => prev.filter((c) => c.id !== cameraToDelete.id));
        if (cameraFilter?.refetch) cameraFilter.refetch();
      } else { toast?.error?.("Error", data.message || "Failed to delete camera"); }
    } catch (err) { toast?.error?.("Error", "Server error while deleting camera"); }
    finally { setDeleteDialogVisible(false); setCameraToDelete(null); }
  };

  // Map zone IDs to Zone Names for quick lookup
  const zoneNameMap = useMemo(() => {
    const map = {};
    (zones || []).forEach(z => {
      map[String(z.id || z.zone_id)] = z.name || z.zone || '';
    });
    (cameraFilter?.availableOptions?.zones || []).forEach(z => {
      map[String(z.id || z.zone_id)] = z.name || z.zone || '';
    });
    return map;
  }, [zones, cameraFilter?.availableOptions?.zones]);

  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const filteredCameras = useMemo(() => {
    let list = cameraFilter.availableOptions.cameras || [];
    if (cameraFilter.filters.cameraId) {
      list = list.filter(c => String(c.value) === String(cameraFilter.filters.cameraId) || String(c.id) === String(cameraFilter.filters.cameraId));
    }
    return [...list].sort((a, b) => {
      let valA, valB;
      if (sortConfig.key === "name") {
        valA = a.name || a.label || "";
        valB = b.name || b.label || "";
      } else if (sortConfig.key === "zone") {
        valA = a.zone_name || zoneNameMap[String(a.zone_id)] || "";
        valB = b.zone_name || zoneNameMap[String(b.zone_id)] || "";
      } else if (sortConfig.key === "features") {
        valA = a.features?.length || 0;
        valB = b.features?.length || 0;
      } else {
        valA = a[sortConfig.key] || "";
        valB = b[sortConfig.key] || "";
      }

      if (!isNaN(valA) && !isNaN(valB) && valA !== "" && valB !== "") {
        return sortConfig.direction === "asc" ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }
      return sortConfig.direction === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [cameraFilter.availableOptions.cameras, cameraFilter.filters.cameraId, sortConfig, zoneNameMap]);

  const paginatedCameras = useMemo(() => {

    if (itemsPerPage === null || itemsPerPage === Infinity) return filteredCameras;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCameras.slice(start, start + itemsPerPage);
  }, [filteredCameras, currentPage, itemsPerPage]);

  // Reset to page 1 when filter parameters change
  useEffect(() => {
    setCurrentPage(1);
  }, [cameraFilter.filters.zone, cameraFilter.filters.location, cameraFilter.filters.cameraId, cameraFilter.filters.searchQuery]);

  // Group DB features by category for Step 2 UI (only show features where isactive = true)
  const groupedFeatures = useMemo(() => {
    const groups = {};
    dbFeatures
      .filter(f => f.isactive === true || f.isactive === 'true' || f.is_active === true)
      .forEach(f => {
        const cat = f.category_name || "Uncategorized";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(f);
      });
    return groups;
  }, [dbFeatures]);

  return (
    <div className="flex flex-col gap-2 w-full h-full font-sans">
      <CustomConfirmDialog
        visible={deleteDialogVisible} onHide={() => setDeleteDialogVisible(false)}
        header="Confirm Delete" message={`Are you sure you want to delete "${cameraToDelete?.name || "this camera"}"?`}
        acceptLabel="Delete" rejectLabel="Cancel" accept={executeDelete} reject={() => setDeleteDialogVisible(false)}
      />

      {/* Page Header */}
      <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg"><Camera size={18} /></div>
          <div>
            <h1 className="text-sm md:text-base font-bold" style={{ color: textPrimary }}>Camera Management</h1>
            <p className="text-[11px]" style={{ color: textSecondary }}>Manage all connected cameras, locations and mapped AI features</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRefreshKey(prev => prev + 1);
              if (cameraFilter?.refetch) cameraFilter.refetch();
              toast?.info?.("Refreshed", "Camera management data updated");
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => handleOpenModal("add")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium cursor-pointer">
            <Plus size={16} /> Add Camera
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="flex flex-col gap-4 p-4 rounded-xl border flex-1 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 w-full">
          <GlobalCameraFilter cameraFilter={cameraFilter} hideCamera={false} />
          <RecordsPerPage value={itemsPerPage} onChange={v => { setItemsPerPage(v); setCurrentPage(1); }} options={[10, 25, 50]} label="Show" />
        </div>

        <div className="border rounded-lg shadow-sm overflow-x-auto flex-1" style={{ backgroundColor: cardBg, borderColor }}>
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr style={theme.headerBg?.includes("gradient") ? { background: theme.headerBg } : { backgroundColor: theme.headerBg || "#3b82f6" }}>
                {[
                  { title: "SR.NO", sortable: false },
                  { title: "CAMERA NAME", key: "name", sortable: true },
                  { title: "ZONE", key: "zone", sortable: true },
                  { title: "LOCATION", key: "location", sortable: true },
                  { title: "RTSP URL", key: "rtsp_url", sortable: true },
                  { title: "FEATURES MAPPED", key: "features", sortable: true },
                  { title: "ACTIONS", sortable: false }
                ].map(h => (
                  <th
                    key={h.title}
                    onClick={() => h.sortable && handleSort(h.key)}
                    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b select-none text-white ${h.sortable ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
                    style={{ borderColor: `${borderColor}40` }}
                  >
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span>{h.title}</span>
                      {h.sortable && (
                        <span className="inline-flex items-center text-[10px] text-white">
                          {sortConfig.key !== h.key && <FaSort className="opacity-60" />}
                          {sortConfig.key === h.key && sortConfig.direction === "asc" && <FaSortUp className="text-white" />}
                          {sortConfig.key === h.key && sortConfig.direction === "desc" && <FaSortDown className="text-white" />}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-xs" style={{ color: textSecondary }}>Loading...</td></tr>
              ) : paginatedCameras.length > 0 ? paginatedCameras.map((row, index) => (
                <tr key={row.id} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor }}>
                  <td className="px-4 py-3 text-xs"><span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max inline-block">{(currentPage - 1) * (itemsPerPage || filteredCameras.length) + index + 1}</span></td>
                  <td className="px-4 py-3 text-xs font-bold whitespace-normal break-words" style={{ color: textPrimary }}>{row.name || row.label}</td>
                  <td className="px-4 py-3 text-xs whitespace-normal break-words" style={{ color: textPrimary }}>
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 text-[11px] font-semibold inline-block">
                      {row.zone_name || zoneNameMap[String(row.zone_id)] || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-normal break-words" style={{ color: textPrimary }}>{row.location || "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono break-all select-all leading-relaxed" style={{ color: textSecondary }}>{row.rtsp_url || row.url}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.features?.length > 0 ? (
                      <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 inline-block">
                        {row.features.length} Features
                      </span>
                    ) : (
                      <span className="text-[10px]" style={{ color: textSecondary }}>None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex items-center justify-center gap-2.5">
                      <button onClick={() => handleOpenModal("view", row)} className="text-blue-500 hover:text-blue-400 cursor-pointer p-1 transition-colors" title="View"><Eye size={16} /></button>
                      <button onClick={() => handleOpenModal("edit", row)} className="text-amber-500 hover:text-amber-400 cursor-pointer p-1 transition-colors" title="Edit"><Edit size={16} /></button>
                      <button onClick={() => confirmDelete(row)} className="text-red-500 hover:text-red-400 cursor-pointer p-1 transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="py-6 text-center text-xs" style={{ color: textSecondary }}>No cameras found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filteredCameras.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {/* Add/Edit/View Modal */}
      <RightSideDialog
        visible={isModalOpen} onHide={handleCloseModal}
        header={modalMode === "add" ? `Add Camera ${activeStep === 1 ? "(1: Info)" : "(2: Features)"}` : modalMode === "edit" ? `Edit Camera ${activeStep === 1 ? "(1: Info)" : "(2: Features)"}` : "View Camera Details"}
      >
        <div className="flex flex-col gap-4 pt-2">
          {/* Tabs */}
          {modalMode !== "view" && (
            <div className="flex border-b mb-2" style={{ borderColor }}>
              <button type="button" onClick={() => setActiveStep(1)} className={`flex-1 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${activeStep === 1 ? "border-blue-500 text-blue-500" : "border-transparent text-gray-400 hover:text-gray-200"}`}>1. Basic Info</button>
              <button type="button" onClick={() => setActiveStep(2)} className={`flex-1 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${activeStep === 2 ? "border-blue-500 text-blue-500" : "border-transparent text-gray-400 hover:text-gray-200"}`}>2. AI Features</button>
            </div>
          )}

          {/* STEP 1 */}
          {(modalMode === "view" || activeStep === 1) && (
            <form onSubmit={modalMode === "view" ? e => e.preventDefault() : handleNextStep} className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-medium text-gray-400">Camera Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} disabled={modalMode === "view"} required
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 bg-transparent text-sm" style={{ borderColor: inputBorderColor, color: textPrimary }} placeholder="e.g. CAMERA 01" />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-medium text-gray-400">RTSP URL *</label>
                <input type="text" name="rtsp_url" value={formData.rtsp_url} onChange={handleChange} disabled={modalMode === "view"} required
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 bg-transparent text-sm font-mono" style={{ borderColor: inputBorderColor, color: textPrimary }} placeholder="rtsp://..." />
              </div>

              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                <label className="text-xs font-medium text-gray-400 flex items-center gap-1"><MapPin size={10} /> Zone *</label>
                <SearchableSelect
                  name="zone_id"
                  value={formData.zone_id}
                  onChange={handleChange}
                  disabled={modalMode === "view"}
                  options={zones.map(z => ({ id: z.id, name: z.name }))}
                  placeholder="Select zone..."
                  className="w-full h-[38px]"
                />
              </div>

              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                <label className="text-xs font-medium text-gray-400 flex items-center gap-1"><MapPin size={10} /> Location *</label>
                <SearchableSelect
                  name="location_id"
                  value={formData.location_id}
                  onChange={handleChange}
                  disabled={modalMode === "view" || !formData.zone_id}
                  options={(locationsMap[formData.zone_id] || []).map(l => ({ id: l.id, name: l.name }))}
                  placeholder="Select location..."
                  className="w-full h-[38px]"
                />
              </div>

              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                <label className="text-xs font-medium text-gray-400">Latitude (Auto-filled)</label>
                <input type="text" value={formData.latitude} disabled className="px-3 py-2 border rounded-lg bg-black/5 dark:bg-white/5 text-sm text-gray-500 font-mono" style={{ borderColor: inputBorderColor }} placeholder="—" />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                <label className="text-xs font-medium text-gray-400">Longitude (Auto-filled)</label>
                <input type="text" value={formData.longitude} disabled className="px-3 py-2 border rounded-lg bg-black/5 dark:bg-white/5 text-sm text-gray-500 font-mono" style={{ borderColor: inputBorderColor }} placeholder="—" />
              </div>



              {modalMode !== "view" && (
                <div className="flex gap-3 mt-4 pt-4 border-t col-span-2" style={{ borderColor }}>
                  <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" style={{ borderColor, color: textPrimary }}>Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer font-bold">Next (Features) ➔</button>
                </div>
              )}
            </form>
          )}

          {/* STEP 2 */}
          {(modalMode === "view" || activeStep === 2) && (
            <form onSubmit={modalMode === "view" ? e => e.preventDefault() : handleSubmit} className="flex flex-col gap-4">
              {modalMode === "view" && activeStep === 1 && <div className="border-t my-2" style={{ borderColor }} />}

              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase flex items-center gap-2 text-blue-500">
                  <Cpu size={14} /> Mapped AI Features
                </label>

                {Object.keys(groupedFeatures).length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">No features available in database.</p>
                ) : (
                  Object.entries(groupedFeatures).map(([catName, features]) => (
                    <div key={catName} className="flex flex-col gap-2 mb-2">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 border-b pb-1" style={{ borderColor: inputBorderColor }}>{catName}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {features.map(feat => {
                          const isChecked = formData.feature_ids.includes(feat.id);
                          return (
                            <label key={feat.id} onClick={() => handleFeatureToggle(feat.id)}
                              className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all ${modalMode !== "view" ? "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" : ""} ${isChecked ? "bg-blue-500/10 border-blue-500/50" : "opacity-80"}`}
                              style={{ borderColor: isChecked ? "#3b82f6" : inputBorderColor }}>
                              <input type="checkbox" checked={isChecked} onChange={() => { }} disabled={modalMode === "view"} className="mt-0.5 w-4 h-4 rounded text-blue-500" />
                              <div className="flex flex-col gap-0.5">
                                <span className={`text-xs font-bold ${isChecked ? "text-blue-500" : textPrimary}`}>{feat.name.replace(/_/g, " ")}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {modalMode !== "view" && (
                <div className="flex gap-3 mt-4 pt-4 border-t" style={{ borderColor }}>
                  <button type="button" onClick={() => setActiveStep(1)} className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" style={{ borderColor, color: textPrimary }}>Back</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer font-bold">
                    {modalMode === "add" ? "Save Camera" : "Update Camera"}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </RightSideDialog>
    </div>
  );
}
