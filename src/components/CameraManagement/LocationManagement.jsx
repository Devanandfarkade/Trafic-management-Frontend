import React, { useState, useEffect, useMemo } from "react";
import { Plus, Eye, Edit, Trash2, MapPin, Building2, RefreshCw } from 'lucide-react';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { useTheme } from "../../ui/Settings/themeUtils";
import { useToast } from "../../ui/common/CustomToast";
import Pagination from "../../ui/common/Pagination";
import RecordsPerPage from "../../ui/common/RecordsPerPage";
import SearchBar from "../../ui/common/SearchBar";
import RightSideDialog from "../../ui/common/RightSideDialog";
import CustomConfirmDialog from "../../ui/common/CustomConfirmDialog";
import SearchableSelect from "../../ui/common/SearchableSelect";
import { API_BASE_URL } from "../../../config.js";

const TABS = [
  { id: "zones", label: "Zone Management", icon: Building2 },
  { id: "locations", label: "Location Management", icon: MapPin },
];

// Validate that a text field contains letters and is not numeric-only
const hasLetters = (val) => /[a-zA-Z]/.test(String(val || "").trim());

/* ══════════════════════════════════════════════════════════════
   ZONE TAB (formerly Premise Tab)
══════════════════════════════════════════════════════════════ */
function ZoneTab({ themeUtils, theme, toast, refreshKey }) {
  const isDark = theme.mode === "Dark";
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();

  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ visible: false, item: null });
  const [formData, setFormData] = useState({ name: "", description: "", location: "", isactive: true });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateZoneForm = (data) => {
    const errs = {};
    if (!data.name || !data.name.trim()) {
      errs.name = "Zone name is required";
    } else if (!hasLetters(data.name)) {
      errs.name = "Zone name cannot be numeric-only. Please enter a valid name.";
    }

    if (data.location && data.location.trim()) {
      if (!hasLetters(data.location)) {
        errs.location = "City/Area cannot be numeric-only. Please enter a valid city name.";
      }
    }
    return errs;
  };

  const handleFieldChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    if (touched[field]) {
      const errs = validateZoneForm(updated);
      setErrors(errs);
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validateZoneForm(formData);
    setErrors(errs);
  };

  const fetchZones = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/locations/zones`);
      const data = await res.json();
      if (data.success) setZones(data.zones || []);
    } catch (err) {
      toast?.error?.("Error", "Failed to load zones");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchZones(); }, [refreshKey]);

  const handleOpen = (mode, item = null) => {
    setModalMode(mode);
    setSelectedItem(item);
    setFormData(item
      ? { name: item.name, description: item.description || "", location: item.location || "", isactive: item.isactive ?? true }
      : { name: "", description: "", location: "", isactive: true }
    );
    setErrors({});
    setTouched({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, location: true });
    const errs = validateZoneForm(formData);
    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      const firstError = Object.values(errs)[0];
      toast?.error?.("Validation Error", firstError);
      return;
    }

    try {
      const url = modalMode === "add" ? `${API_BASE_URL}/api/locations/zones` : `${API_BASE_URL}/api/locations/zones/${selectedItem.id}`;
      const method = modalMode === "add" ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (data.success) {
        toast?.success?.("Success", modalMode === "add" ? "Zone added" : "Zone updated");
        fetchZones(); setIsModalOpen(false);
      } else { toast?.error?.("Error", data.message); }
    } catch { toast?.error?.("Error", "Request failed"); }
  };

  const executeDelete = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/locations/zones/${deleteDialog.item.id}`, { method: "DELETE" });
      toast?.success?.("Deleted", `"${deleteDialog.item.name}" removed`);
      fetchZones();
    } catch { toast?.error?.("Error", "Delete failed"); }
    finally { setDeleteDialog({ visible: false, item: null }); }
  };

  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const filtered = useMemo(() => {
    let list = zones;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(z => z.name?.toLowerCase().includes(q) || z.location?.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const key = sortConfig.key;
      let valA = a[key] ?? "";
      let valB = b[key] ?? "";
      if (typeof valA === "boolean") { valA = valA ? 1 : 0; valB = valB ? 1 : 0; }
      if (!isNaN(valA) && !isNaN(valB) && valA !== "" && valB !== "") {
        return sortConfig.direction === "asc" ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }
      return sortConfig.direction === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [zones, searchQuery, sortConfig]);

  const paginated = useMemo(() => {
    if (itemsPerPage === null || itemsPerPage === Infinity || !itemsPerPage) return filtered;
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <CustomConfirmDialog
        visible={deleteDialog.visible} onHide={() => setDeleteDialog({ visible: false, item: null })}
        header="Confirm Delete" message={`Delete zone "${deleteDialog.item?.name}"?`}
        acceptLabel="Delete" rejectLabel="Cancel"
        accept={executeDelete} reject={() => setDeleteDialog({ visible: false, item: null })}
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <SearchBar placeholder="Search zones..." searchValue={searchQuery}
            onSearchChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
        </div>
        <div className="flex items-center gap-3">
          <RecordsPerPage value={itemsPerPage} onChange={v => { setItemsPerPage(v); setCurrentPage(1); }} options={[5, 10, 25]} label="Show" />
          <button onClick={() => handleOpen("add")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer">
            <Plus size={14} /> Add Zone
          </button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto" style={{ borderColor }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={theme.headerBg?.includes("gradient") ? { background: theme.headerBg } : { backgroundColor: theme.headerBg || "#3b82f6" }}>
              {[
                { title: "SR.NO", sortable: false },
                { title: "ZONE NAME", key: "name", sortable: true },
                { title: "ADDRESS", key: "location", sortable: true },
                { title: "DESCRIPTION", key: "description", sortable: true },
                { title: "ACTIVE", key: "isactive", sortable: true },
                { title: "ACTIONS", sortable: false }
              ].map(h => (
                <th
                  key={h.title}
                  onClick={() => h.sortable && handleSort(h.key)}
                  className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b select-none text-white ${h.sortable ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
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
              <tr><td colSpan={6} className="py-8 text-center text-xs" style={{ color: textSecondary }}>Loading...</td></tr>
            ) : paginated.length > 0 ? paginated.map((row, i) => (
              <tr key={row.id} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor }}>
                <td className="px-3 py-2.5 text-xs"><span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max inline-block">{(currentPage - 1) * (itemsPerPage || filtered.length) + i + 1}</span></td>
                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: textPrimary }}>{row.name}</td>
                <td className="px-3 py-2.5 text-xs" style={{ color: textSecondary }}>{row.location || "—"}</td>
                <td className="px-3 py-2.5 text-xs max-w-48 truncate" style={{ color: textSecondary }}>{row.description || "—"}</td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.isactive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {row.isactive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    <button onClick={() => handleOpen("view", row)} className="text-blue-400 hover:text-blue-300 cursor-pointer" title="View"><Eye size={14} /></button>
                    <button onClick={() => handleOpen("edit", row)} className="text-amber-400 hover:text-amber-300 cursor-pointer" title="Edit"><Edit size={14} /></button>
                    <button onClick={() => setDeleteDialog({ visible: true, item: row })} className="text-red-400 hover:text-red-300 cursor-pointer" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="py-6 text-center text-xs" style={{ color: textSecondary }}>No zones found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />

      <RightSideDialog visible={isModalOpen} onHide={() => setIsModalOpen(false)}
        header={modalMode === "add" ? "Add Zone" : modalMode === "edit" ? "Edit Zone" : "View Zone"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Zone Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => handleFieldChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              disabled={modalMode === "view"}
              placeholder="e.g. Headquarters, North Zone"
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-transparent focus:outline-none transition-colors ${touched.name && errors.name
                ? "border-red-500 focus:border-red-500"
                : "focus:border-blue-500"
                }`}
              style={{ borderColor: touched.name && errors.name ? "#ef4444" : borderColor, color: textPrimary }}
            />
            {touched.name && errors.name && (
              <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.name}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>City/Area</label>
            <input
              type="text"
              value={formData.location}
              onChange={e => handleFieldChange("location", e.target.value)}
              onBlur={() => handleBlur("location")}
              disabled={modalMode === "view"}
              placeholder="e.g. Baramati"
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-transparent focus:outline-none transition-colors ${touched.location && errors.location
                ? "border-red-500 focus:border-red-500"
                : "focus:border-blue-500"
                }`}
              style={{ borderColor: touched.location && errors.location ? "#ef4444" : borderColor, color: textPrimary }}
            />
            {touched.location && errors.location && (
              <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.location}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Description</label>
            <textarea rows={3} value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              disabled={modalMode === "view"} placeholder="Describe this zone..."
              className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent resize-none focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
          </div>
          {modalMode !== "view" && (
            <div className="pt-4 flex items-center justify-end gap-3 border-t mt-2" style={{ borderColor }}>
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border hover:bg-gray-500/10 cursor-pointer" style={{ borderColor, color: textSecondary }}>Cancel</button>
              <button type="submit"
                className="px-5 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer">
                {modalMode === "add" ? "Save Zone" : "Update Zone"}
              </button>
            </div>
          )}
        </form>
      </RightSideDialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LOCATION TAB
══════════════════════════════════════════════════════════════ */
function LocationTab({ themeUtils, theme, toast, refreshKey }) {
  const isDark = theme.mode === "Dark";
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();

  const [locations, setLocations] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ visible: false, item: null });
  const [formData, setFormData] = useState({ name: "", zone_id: "", city: "Baramati", state: "Maharashtra", latitude: "", longitude: "", description: "", isactive: true });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateLocationForm = (data) => {
    const errs = {};
    if (!data.name || !data.name.trim()) {
      errs.name = "Location name is required";
    } else if (!hasLetters(data.name)) {
      errs.name = "Location name cannot be numeric-only. Please enter a valid name.";
    }

    if (!data.zone_id) {
      errs.zone_id = "Zone selection is required";
    }

    if (!data.city || !data.city.trim()) {
      errs.city = "City is required";
    } else if (!hasLetters(data.city)) {
      errs.city = "City cannot be numeric-only. Please enter a valid city name.";
    }

    if (data.state && data.state.trim() && !hasLetters(data.state)) {
      errs.state = "State cannot be numeric-only.";
    }

    return errs;
  };

  const handleFieldChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    if (touched[field]) {
      const errs = validateLocationForm(updated);
      setErrors(errs);
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validateLocationForm(formData);
    setErrors(errs);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [lRes, pRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/locations`),
        fetch(`${API_BASE_URL}/api/locations/zones`),
      ]);
      const [lData, pData] = await Promise.all([lRes.json(), pRes.json()]);
      if (lData.success) setLocations(lData.locations || []);
      if (pData.success) setZones(pData.zones || []);
    } catch { toast?.error?.("Error", "Failed to load data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [refreshKey]);

  const handleOpen = (mode, item = null) => {
    setModalMode(mode);
    setSelectedItem(item);
    setFormData(item
      ? { name: item.name, zone_id: item.zone_id || "", city: item.city || "Baramati", state: item.state || "Maharashtra", latitude: item.latitude || "", longitude: item.longitude || "", description: item.description || "", isactive: true }
      : { name: "", zone_id: "", city: "Baramati", state: "Maharashtra", latitude: "", longitude: "", description: "", isactive: true }
    );
    setErrors({});
    setTouched({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, zone_id: true, city: true, state: true });
    const errs = validateLocationForm(formData);
    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      const firstError = Object.values(errs)[0];
      toast?.error?.("Validation Error", firstError);
      return;
    }

    try {
      const url = modalMode === "add" ? `${API_BASE_URL}/api/locations` : `${API_BASE_URL}/api/locations/${selectedItem.id}`;
      const method = modalMode === "add" ? "POST" : "PUT";
      const payload = { ...formData, zone_id: parseInt(formData.zone_id), isactive: true };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        toast?.success?.("Success", modalMode === "add" ? "Location added" : "Location updated");
        fetchAll(); setIsModalOpen(false);
      } else { toast?.error?.("Error", data.message); }
    } catch { toast?.error?.("Error", "Request failed"); }
  };

  const executeDelete = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/locations/${deleteDialog.item.id}`, { method: "DELETE" });
      toast?.success?.("Deleted", `"${deleteDialog.item.name}" removed`);
      fetchAll();
    } catch { toast?.error?.("Error", "Delete failed"); }
    finally { setDeleteDialog({ visible: false, item: null }); }
  };

  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedZones = useMemo(() => {
    return [...zones].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [zones]);

  const filtered = useMemo(() => {
    let result = locations;
    if (filterZone) result = result.filter(l => String(l.zone_id) === String(filterZone));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => l.name?.toLowerCase().includes(q) || l.zone_name?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      const key = sortConfig.key;
      let valA = a[key] ?? "";
      let valB = b[key] ?? "";
      if (typeof valA === "boolean") { valA = valA ? 1 : 0; valB = valB ? 1 : 0; }
      if (!isNaN(valA) && !isNaN(valB) && valA !== "" && valB !== "") {
        return sortConfig.direction === "asc" ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }
      return sortConfig.direction === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [locations, filterZone, searchQuery, sortConfig]);

  const paginated = useMemo(() => {
    if (itemsPerPage === null || itemsPerPage === Infinity || !itemsPerPage) return filtered;
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <CustomConfirmDialog
        visible={deleteDialog.visible} onHide={() => setDeleteDialog({ visible: false, item: null })}
        header="Confirm Delete" message={`Delete location "${deleteDialog.item?.name}"?`}
        acceptLabel="Delete" rejectLabel="Cancel"
        accept={executeDelete} reject={() => setDeleteDialog({ visible: false, item: null })}
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-56"><SearchBar placeholder="Search locations..." searchValue={searchQuery}
            onSearchChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} /></div>
          <SearchableSelect
            name="filterZone"
            value={filterZone}
            onChange={e => { setFilterZone(e.target.value); setCurrentPage(1); }}
            options={sortedZones.map(z => ({ id: z.id, name: z.name }))}
            placeholder="All Zones"
            className="w-[180px] h-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <RecordsPerPage value={itemsPerPage} onChange={v => { setItemsPerPage(v); setCurrentPage(1); }} options={[5, 10, 25]} label="Show" />
          <button onClick={() => handleOpen("add")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 cursor-pointer">
            <Plus size={14} /> Add Location
          </button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto" style={{ borderColor }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={theme.headerBg?.includes("gradient") ? { background: theme.headerBg } : { backgroundColor: theme.headerBg || "#3b82f6" }}>
              {[
                { title: "SR.NO", sortable: false },
                { title: "LOCATION NAME", key: "name", sortable: true },
                { title: "ZONE", key: "zone_name", sortable: true },
                { title: "CITY", key: "city", sortable: true },
                { title: "GPS COORDS", key: "latitude", sortable: true },
                { title: "CAMERAS", key: "cameras_count", sortable: true },
                { title: "ACTIVE", key: "isactive", sortable: true },
                { title: "ACTIONS", sortable: false }
              ].map(h => (
                <th
                  key={h.title}
                  onClick={() => h.sortable && handleSort(h.key)}
                  className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b select-none text-white ${h.sortable ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
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
              <tr><td colSpan={8} className="py-8 text-center text-xs" style={{ color: textSecondary }}>Loading...</td></tr>
            ) : paginated.length > 0 ? paginated.map((row, i) => (
              <tr key={row.id} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor }}>
                <td className="px-3 py-2.5 text-xs"><span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max inline-block">{(currentPage - 1) * (itemsPerPage || filtered.length) + i + 1}</span></td>
                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: textPrimary }}>{row.name}</td>
                <td className="px-3 py-2.5 text-xs">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400">{row.zone_name || "—"}</span>
                </td>
                <td className="px-3 py-2.5 text-xs" style={{ color: textSecondary }}>{row.city || "—"}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-[10px] text-gray-500">
                  {row.latitude && row.longitude ? `${row.latitude}, ${row.longitude}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-xs font-bold text-purple-400">{row.cameras_count || 0}</td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.isactive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {row.isactive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    <button onClick={() => handleOpen("view", row)} className="text-blue-400 hover:text-blue-300 cursor-pointer" title="View"><Eye size={14} /></button>
                    <button onClick={() => handleOpen("edit", row)} className="text-amber-400 hover:text-amber-300 cursor-pointer" title="Edit"><Edit size={14} /></button>
                    <button onClick={() => setDeleteDialog({ visible: true, item: row })} className="text-red-400 hover:text-red-300 cursor-pointer" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="py-6 text-center text-xs" style={{ color: textSecondary }}>No locations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />

      <RightSideDialog visible={isModalOpen} onHide={() => setIsModalOpen(false)}
        header={modalMode === "add" ? "Add Location" : modalMode === "edit" ? "Edit Location" : "View Location"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Location Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => handleFieldChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              disabled={modalMode === "view"}
              placeholder="e.g. Main Gate, Junction 1"
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-transparent focus:outline-none transition-colors ${touched.name && errors.name
                ? "border-red-500 focus:border-red-500"
                : "focus:border-blue-500"
                }`}
              style={{ borderColor: touched.name && errors.name ? "#ef4444" : borderColor, color: textPrimary }}
            />
            {touched.name && errors.name && (
              <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.name}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Zone *</label>
            <SearchableSelect
              name="zone_id"
              value={formData.zone_id}
              onChange={e => handleFieldChange("zone_id", e.target.value)}
              disabled={modalMode === "view"}
              options={sortedZones.map(z => ({ id: z.id, name: z.name }))}
              placeholder="Select zone..."
              className={`w-full h-9 ${touched.zone_id && errors.zone_id ? "border-red-500" : ""
                }`}
            />
            {touched.zone_id && errors.zone_id && (
              <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.zone_id}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => handleFieldChange("city", e.target.value)}
                onBlur={() => handleBlur("city")}
                disabled={modalMode === "view"}
                placeholder="e.g. Baramati"
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-transparent focus:outline-none transition-colors ${touched.city && errors.city
                  ? "border-red-500 focus:border-red-500"
                  : "focus:border-blue-500"
                  }`}
                style={{ borderColor: touched.city && errors.city ? "#ef4444" : borderColor, color: textPrimary }}
              />
              {touched.city && errors.city && (
                <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.city}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>State</label>
              <input
                type="text"
                value={formData.state}
                onChange={e => handleFieldChange("state", e.target.value)}
                onBlur={() => handleBlur("state")}
                disabled={modalMode === "view"}
                placeholder="e.g. Maharashtra"
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-transparent focus:outline-none transition-colors ${touched.state && errors.state
                  ? "border-red-500 focus:border-red-500"
                  : "focus:border-blue-500"
                  }`}
                style={{ borderColor: touched.state && errors.state ? "#ef4444" : borderColor, color: textPrimary }}
              />
              {touched.state && errors.state && (
                <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.state}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Latitude (GPS)</label>
              <input type="text" value={formData.latitude} onChange={e => setFormData(p => ({ ...p, latitude: e.target.value }))}
                disabled={modalMode === "view"} placeholder="e.g. 18.1500"
                className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent font-mono focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Longitude (GPS)</label>
              <input type="text" value={formData.longitude} onChange={e => setFormData(p => ({ ...p, longitude: e.target.value }))}
                disabled={modalMode === "view"} placeholder="e.g. 74.5833"
                className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent font-mono focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Description</label>
            <textarea rows={2} value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              disabled={modalMode === "view"} placeholder="Describe this location..."
              className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent resize-none focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
          </div>
          {modalMode !== "view" && (
            <div className="pt-4 flex items-center justify-end gap-3 border-t mt-2" style={{ borderColor }}>
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border hover:bg-gray-500/10 cursor-pointer" style={{ borderColor, color: textSecondary }}>Cancel</button>
              <button type="submit" className="px-5 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer">
                {modalMode === "add" ? "Save Location" : "Update Location"}
              </button>
            </div>
          )}
        </form>
      </RightSideDialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LocationManagement() {
  const { theme, themeUtils } = useTheme();

  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor("card");
  const headerBg = theme.headerBg || "#3b82f6";

  const [activeTab, setActiveTab] = useState("zones");

  return (
    <div className="flex flex-col gap-2 w-full h-full font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${headerBg}20`, color: headerBg }}>
            <MapPin size={18} />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold" style={{ color: textPrimary }}>Location Management</h1>
            <p className="text-[11px]" style={{ color: textSecondary }}>Manage zones and GPS coordinates for cameras</p>
          </div>
        </div>
        <button
          onClick={() => {
            setRefreshKey(prev => prev + 1);
            toast?.info?.("Refreshed", "Location management data updated");
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-2 p-2 rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${isActive ? "text-white shadow-lg" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
              style={{ backgroundColor: isActive ? headerBg : "transparent", color: isActive ? "#fff" : textSecondary }}>
              <Icon size={14} />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Card */}
      <div className="flex flex-col gap-4 p-4 rounded-xl border flex-1 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {activeTab === "zones" && <ZoneTab themeUtils={themeUtils} theme={theme} toast={toast} refreshKey={refreshKey} />}
          {activeTab === "locations" && <LocationTab themeUtils={themeUtils} theme={theme} toast={toast} refreshKey={refreshKey} />}
        </div>
      </div>
    </div>
  );
}
