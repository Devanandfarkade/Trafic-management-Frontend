import React, { useState, useEffect, useMemo } from "react";
import { Plus, Eye, Edit, Trash2, Layers, Cpu, RefreshCw, Tag, Link } from "lucide-react";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import { useTheme } from "../../ui/Settings/themeUtils";
import { useToast } from "../../ui/common/CustomToast";
import Pagination from "../../ui/common/Pagination";
import RecordsPerPage from "../../ui/common/RecordsPerPage";
import SearchBar from "../../ui/common/SearchBar";
import RightSideDialog from "../../ui/common/RightSideDialog";
import CustomConfirmDialog from "../../ui/common/CustomConfirmDialog";
import { API_BASE_URL } from "../../../config.js";

const TABS = [
  { id: "categories", label: "Category Management", icon: Layers },
  { id: "features", label: "Feature Management", icon: Cpu },
];

/* ══════════════════════════════════════════════════════════════
   CATEGORY TAB
══════════════════════════════════════════════════════════════ */
function CategoryTab({ themeUtils, theme, toast }) {
  const isDark = theme.mode === "Dark";
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor("card");

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ visible: false, item: null });
  const [formData, setFormData] = useState({ name: "", description: "", page_key: "", isactive: true });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/categories`);
      const data = await res.json();
      if (data.success) setCategories(data.categories || []);
    } catch (err) {
      toast?.error?.("Error", "Failed to load categories");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleOpen = (mode, item = null) => {
    setModalMode(mode);
    setSelectedItem(item);
    setFormData(item
      ? { name: item.name, description: item.description || "", page_key: item.page_key || "", isactive: item.isactive ?? true }
      : { name: "", description: "", page_key: "", isactive: true }
    );
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast?.error?.("Validation", "Category name is required"); return; }
    try {
      const url = modalMode === "add" ? `${API_BASE_URL}/api/categories` : `${API_BASE_URL}/api/categories/${selectedItem.id}`;
      const method = modalMode === "add" ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (data.success) {
        toast?.success?.("Success", modalMode === "add" ? "Category added" : "Category updated");
        fetchCategories(); setIsModalOpen(false);
      } else { toast?.error?.("Error", data.message); }
    } catch { toast?.error?.("Error", "Request failed"); }
  };

  const executeDelete = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/categories/${deleteDialog.item.id}`, { method: "DELETE" });
      toast?.success?.("Deleted", `"${deleteDialog.item.name}" removed`);
      fetchCategories();
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
    let list = categories;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = categories.filter(c => c.name?.toLowerCase().includes(q) || c.page_key?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
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
  }, [categories, searchQuery, sortConfig]);

  const paginated = useMemo(() => {
    if (itemsPerPage === null || itemsPerPage === Infinity || !itemsPerPage) return filtered;
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <CustomConfirmDialog
        visible={deleteDialog.visible} onHide={() => setDeleteDialog({ visible: false, item: null })}
        header="Confirm Delete" message={`Delete "${deleteDialog.item?.name}"?`}
        acceptLabel="Delete" rejectLabel="Cancel"
        accept={executeDelete} reject={() => setDeleteDialog({ visible: false, item: null })}
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <SearchBar placeholder="Search categories..." searchValue={searchQuery}
            onSearchChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
        </div>
        <div className="flex items-center gap-3">
          <RecordsPerPage value={itemsPerPage} onChange={v => { setItemsPerPage(v); setCurrentPage(1); }} options={[5, 10, 25]} label="Show" />
          <button onClick={() => handleOpen("add")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer">
            <Plus size={14} /> Add Category
          </button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto" style={{ borderColor }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={theme.headerBg?.includes("gradient") ? { background: theme.headerBg } : { backgroundColor: theme.headerBg || "#3b82f6" }}>
              {[
                { title: "SR.NO", sortable: false },
                { title: "NAME", key: "name", sortable: true },
                { title: "PAGE KEY", key: "page_key", sortable: true },
                { title: "DESCRIPTION", key: "description", sortable: true },
                { title: "FEATURES", key: "features_count", sortable: true },
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
              <tr><td colSpan={7} className="py-8 text-center text-xs" style={{ color: textSecondary }}>Loading...</td></tr>
            ) : paginated.length > 0 ? paginated.map((row, i) => (
              <tr key={row.id} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor }}>
                <td className="px-3 py-2.5 text-xs"><span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max inline-block">{(currentPage - 1) * (itemsPerPage || filtered.length) + i + 1}</span></td>
                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: textPrimary }}>{row.name}</td>
                <td className="px-3 py-2.5 text-xs font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[10px]">{row.page_key || "—"}</span>
                </td>
                <td className="px-3 py-2.5 text-xs max-w-48 truncate" style={{ color: textSecondary }}>{row.description || "—"}</td>
                <td className="px-3 py-2.5 text-xs font-bold text-purple-400">{row.features_count || 0}</td>
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
              <tr><td colSpan={7} className="py-6 text-center text-xs" style={{ color: textSecondary }}>No categories found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />

      <RightSideDialog visible={isModalOpen} onHide={() => setIsModalOpen(false)}
        header={modalMode === "add" ? "Add Category" : modalMode === "edit" ? "Edit Category" : "View Category"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Category Name *</label>
            <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              disabled={modalMode === "view"} placeholder="e.g. Heavy Vehicle"
              className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Page Key</label>
            <input type="text" value={formData.page_key} onChange={e => setFormData(p => ({ ...p, page_key: e.target.value }))}
              disabled={modalMode === "view"} placeholder="e.g. heavy_vehicle"
              className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent font-mono focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
            <p className="text-[10px] mt-1" style={{ color: textSecondary }}>Unique identifier used in Live Monitoring tabs</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Description</label>
            <textarea rows={3} value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              disabled={modalMode === "view"} placeholder="Describe this module category..."
              className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent resize-none focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
          </div>
          {modalMode !== "view" && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cat-isactive" checked={formData.isactive}
                onChange={e => setFormData(p => ({ ...p, isactive: e.target.checked }))}
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
              <label htmlFor="cat-isactive" className="text-xs cursor-pointer" style={{ color: textPrimary }}>Mark as Active</label>
            </div>
          )}
          {modalMode !== "view" && (
            <div className="pt-4 flex items-center justify-end gap-3 border-t mt-2" style={{ borderColor }}>
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border hover:bg-gray-500/10 cursor-pointer" style={{ borderColor, color: textSecondary }}>Cancel</button>
              <button type="submit"
                className="px-5 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer">
                {modalMode === "add" ? "Save Category" : "Update Category"}
              </button>
            </div>
          )}
        </form>
      </RightSideDialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FEATURE TAB
══════════════════════════════════════════════════════════════ */
function FeatureTab({ themeUtils, theme, toast }) {
  const isDark = theme.mode === "Dark";
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor("card");

  const [features, setFeatures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ visible: false, item: null });
  const [formData, setFormData] = useState({ name: "", description: "", model_path: "", category_id: "", isactive: true });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [fRes, cRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/features`),
        fetch(`${API_BASE_URL}/api/categories`),
      ]);
      const [fData, cData] = await Promise.all([fRes.json(), cRes.json()]);
      if (fData.success) setFeatures(fData.features || []);
      if (cData.success) setCategories(cData.categories || []);
    } catch { toast?.error?.("Error", "Failed to load data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleOpen = (mode, item = null) => {
    setModalMode(mode);
    setSelectedItem(item);
    setFormData(item
      ? { name: item.name, description: item.description || "", model_path: item.model_path || "", category_id: item.category_id || "", isactive: item.isactive ?? true }
      : { name: "", description: "", model_path: "", category_id: "", isactive: true }
    );
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast?.error?.("Validation", "Feature name is required"); return; }
    if (!formData.model_path.trim()) { toast?.error?.("Validation", "WebSocket URL is required"); return; }
    try {
      const url = modalMode === "add" ? `${API_BASE_URL}/api/features` : `${API_BASE_URL}/api/features/${selectedItem.id}`;
      const method = modalMode === "add" ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (data.success) {
        toast?.success?.("Success", modalMode === "add" ? "Feature added" : "Feature updated");
        fetchAll(); setIsModalOpen(false);
      } else { toast?.error?.("Error", data.message); }
    } catch { toast?.error?.("Error", "Request failed"); }
  };

  const executeDelete = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/features/${deleteDialog.item.id}`, { method: "DELETE" });
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

  const filtered = useMemo(() => {
    let result = features;
    if (filterCategory) result = result.filter(f => String(f.category_id) === String(filterCategory));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name?.toLowerCase().includes(q) || f.category_name?.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q));
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
  }, [features, filterCategory, searchQuery, sortConfig]);

  const paginated = useMemo(() => {
    if (itemsPerPage === null || itemsPerPage === Infinity || !itemsPerPage) return filtered;
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <CustomConfirmDialog
        visible={deleteDialog.visible} onHide={() => setDeleteDialog({ visible: false, item: null })}
        header="Confirm Delete" message={`Delete feature "${deleteDialog.item?.name}"?`}
        acceptLabel="Delete" rejectLabel="Cancel"
        accept={executeDelete} reject={() => setDeleteDialog({ visible: false, item: null })}
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-56"><SearchBar placeholder="Search features..." searchValue={searchQuery}
            onSearchChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} /></div>
          <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1); }}
            className="h-9 px-3 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer box-border shadow-sm transition-colors"
            style={{ borderColor, color: textPrimary, backgroundColor: cardBg, colorScheme: isDark ? "dark" : "light" }}>
            <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <RecordsPerPage value={itemsPerPage} onChange={v => { setItemsPerPage(v); setCurrentPage(1); }} options={[5, 10, 25]} label="Show" />
          <button onClick={() => handleOpen("add")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 cursor-pointer">
            <Plus size={14} /> Add Feature
          </button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto" style={{ borderColor }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={theme.headerBg?.includes("gradient") ? { background: theme.headerBg } : { backgroundColor: theme.headerBg || "#3b82f6" }}>
              {[
                { title: "SR.NO", sortable: false },
                { title: "FEATURE NAME", key: "name", sortable: true },
                { title: "CATEGORY", key: "category_name", sortable: true },
                { title: "WEBSOCKET URL", key: "model_path", sortable: true },
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
              <tr><td colSpan={7} className="py-8 text-center text-xs" style={{ color: textSecondary }}>Loading...</td></tr>
            ) : paginated.length > 0 ? paginated.map((row, i) => (
              <tr key={row.id} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor }}>
                <td className="px-3 py-2.5 text-xs"><span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max inline-block">{(currentPage - 1) * (itemsPerPage || filtered.length) + i + 1}</span></td>
                <td className="px-3 py-2.5 text-xs font-bold font-mono" style={{ color: textPrimary }}>{row.name}</td>
                <td className="px-3 py-2.5 text-xs">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400">{row.category_name || "—"}</span>
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-[10px] max-w-40 truncate text-blue-400" title={row.model_path}>
                  {row.model_path ? (
                    <span className="flex items-center gap-1"><Link size={10} />{row.model_path}</span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2.5 text-xs max-w-40 truncate" style={{ color: textSecondary }}>{row.description || "—"}</td>
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
              <tr><td colSpan={7} className="py-6 text-center text-xs" style={{ color: textSecondary }}>No features found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />

      <RightSideDialog visible={isModalOpen} onHide={() => setIsModalOpen(false)}
        header={modalMode === "add" ? "Add Feature" : modalMode === "edit" ? "Edit Feature" : "View Feature"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Feature Name *</label>
            <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              disabled={modalMode === "view"} placeholder="e.g. cement_mixer"
              className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent font-mono focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
            <p className="text-[10px] mt-1" style={{ color: textSecondary }}>Use snake_case (e.g. cement_mixer, no_parking)</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Category *</label>
            <select value={formData.category_id} onChange={e => setFormData(p => ({ ...p, category_id: e.target.value }))}
              disabled={modalMode === "view"}
              className="w-full h-9 px-3 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer box-border shadow-sm disabled:opacity-50 transition-colors"
              style={{ borderColor, color: textPrimary, backgroundColor: cardBg, colorScheme: isDark ? "dark" : "light" }}>
              <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">Select category...</option>
              {categories.map(c => <option key={c.id} value={c.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>WebSocket URL (model_path) *</label>
            <input type="text" value={formData.model_path} onChange={e => setFormData(p => ({ ...p, model_path: e.target.value }))}
              disabled={modalMode === "view"} placeholder="ws://110.227.253.23:9010/cementmixer/ws"
              className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent font-mono focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
            <p className="text-[10px] mt-1" style={{ color: textSecondary }}>Python AI WebSocket endpoint (rtsp_url will be appended as query param)</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>Description</label>
            <textarea rows={3} value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              disabled={modalMode === "view"} placeholder="Describe this AI feature..."
              className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent resize-none focus:outline-none focus:border-blue-500" style={{ borderColor, color: textPrimary }} />
          </div>
          {modalMode !== "view" && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="feat-isactive" checked={formData.isactive}
                onChange={e => setFormData(p => ({ ...p, isactive: e.target.checked }))}
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
              <label htmlFor="feat-isactive" className="text-xs cursor-pointer" style={{ color: textPrimary }}>Mark as Active</label>
            </div>
          )}
          {modalMode !== "view" && (
            <div className="pt-4 flex items-center justify-end gap-3 border-t mt-2" style={{ borderColor }}>
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border hover:bg-gray-500/10 cursor-pointer" style={{ borderColor, color: textSecondary }}>Cancel</button>
              <button type="submit" className="px-5 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer">
                {modalMode === "add" ? "Save Feature" : "Update Feature"}
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
export default function CategoryFeatureManagement() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor("card");
  const headerBg = theme.headerBg || "#3b82f6";

  const [activeTab, setActiveTab] = useState("categories");

  return (
    <div className="flex flex-col gap-2 w-full h-full font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${headerBg}20`, color: headerBg }}>
            <Layers size={18} />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold" style={{ color: textPrimary }}>Category & Feature Management</h1>
            <p className="text-[11px]" style={{ color: textSecondary }}>Manage AI modules, categories and their feature WebSocket configurations</p>
          </div>
        </div>
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
          {activeTab === "categories" && <CategoryTab themeUtils={themeUtils} theme={theme} toast={toast} />}
          {activeTab === "features" && <FeatureTab themeUtils={themeUtils} theme={theme} toast={toast} />}
        </div>
      </div>
    </div>
  );
}
