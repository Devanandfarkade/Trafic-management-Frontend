import React, { useState, useMemo, useEffect } from "react";
import { MonitorPlay, LayoutGrid, Loader, RotateCw, RefreshCw } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useTheme } from "../../ui/Settings/themeUtils";
import { useToast } from "../../ui/common/CustomToast";
import Pagination from "../../ui/common/Pagination";
import RecordsPerPage from "../../ui/common/RecordsPerPage";
import LiveCameraCard from "./LiveCameraCard";
import GlobalCameraFilter from "../../ui/common/GlobalCameraFilter";
import useCameraFilter from "../../hooks/useCameraFilter";
import { API_BASE_URL } from "../../../config.js";

// Fallback icon map for category page_keys
const PAGE_KEY_ICONS = {
  traffic: "Ban",
  heavy_vehicle: "Truck",
  secure_gate: "ShieldCheck",
  transport: "Car",
  criminal_detection: "UserX",
  wrong_side_driving: "AlertTriangle",
  triple_riding: "Users",
};

export default function LiveMonitoring() {
  const { themeUtils, theme } = useTheme();
  const toast = useToast();
  const headerBg = theme.headerBg || "#3b82f6";

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null); // null = All Cameras
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [itemsPerPage, setItemsPerPage] = useState(4);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination on tab change
  useEffect(() => { setCurrentPage(1); }, [selectedCategoryId]);

  const fetchCategories = () => {
    if (!API_BASE_URL) return Promise.resolve();
    return fetch(`${API_BASE_URL}/api/categories?isactive=true`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const activeCats = (data.categories || []).filter(c => c.isactive === true || c.is_active === true || c.isactive === 'true');
          setCategories(activeCats);
        }
      })
      .catch(console.error)
      .finally(() => setCategoriesLoading(false));
  };

  // Fetch categories dynamically from DB
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch cameras (by category_id or all)
  const cameraFilter = useCameraFilter(null, selectedCategoryId);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCategories();
    if (cameraFilter?.refetch) {
      await cameraFilter.refetch();
    }
    toast?.info?.("Refreshed", "Live Monitoring data updated");
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const filteredGridCameras = useMemo(() => {
    let list = cameraFilter.availableOptions.cameras || [];
    if (cameraFilter.filters.cameraId) {
      list = list.filter(c => String(c.value) === String(cameraFilter.filters.cameraId) || String(c.id) === String(cameraFilter.filters.cameraId));
    }
    return list;
  }, [cameraFilter.availableOptions.cameras, cameraFilter.filters.cameraId]);

  const paginatedCameras = useMemo(() => {
    if (itemsPerPage === null || itemsPerPage === Infinity) return filteredGridCameras;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredGridCameras.slice(start, start + itemsPerPage);
  }, [filteredGridCameras, currentPage, itemsPerPage]);

  // Resolve icon from Lucide by name
  const getIcon = (iconName) => {
    if (!iconName) return LayoutGrid;
    return LucideIcons[iconName] || LayoutGrid;
  };

  const activeCategory = selectedCategoryId
    ? categories.find(c => c.id === selectedCategoryId)
    : null;

  const activeName = activeCategory?.name || "All Cameras";
  const activeIconName = activeCategory?.page_key ? PAGE_KEY_ICONS[activeCategory.page_key] : null;
  const ActiveIcon = activeIconName ? getIcon(activeIconName) : LayoutGrid;

  // Stats
  const activeCamCount = filteredGridCameras.filter(c => c.has_active_feature !== false).length;
  const totalCamCount = filteredGridCameras.length;

  return (
    <div className="flex flex-col gap-2 h-full">

      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border gap-4"
        style={{ backgroundColor: themeUtils.getBgColor("card"), borderColor: themeUtils.getBorderColor() }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${headerBg}20`, color: headerBg }}>
            <MonitorPlay size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: themeUtils.getTextColor(true) }}>
              Live Monitoring
            </h1>
            <p className="text-xs" style={{ color: themeUtils.getTextColor(false) }}>
              {selectedCategoryId
                ? `${activeCamCount} active · ${totalCamCount} total mapped in ${activeName}`
                : `Real-time multi-camera overview — ${totalCamCount} camera${totalCamCount !== 1 ? "s" : ""}`
              }
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Module / Category Filter Tabs */}
      <div
        className="flex flex-wrap items-center gap-2 p-2 rounded-xl border"
        style={{ backgroundColor: themeUtils.getBgColor("card"), borderColor: themeUtils.getBorderColor() }}
      >
        {/* All Cameras tab */}
        <button
          onClick={() => setSelectedCategoryId(null)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedCategoryId === null
            ? "text-white shadow-lg"
            : "hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          style={{
            backgroundColor: selectedCategoryId === null ? headerBg : "transparent",
            color: selectedCategoryId === null ? "#fff" : themeUtils.getTextColor(false),
          }}
        >
          <LayoutGrid size={14} />
          All Cameras
        </button>

        {/* Dynamic category tabs */}
        {categoriesLoading ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <Loader size={12} className="animate-spin" style={{ color: themeUtils.getTextColor(false) }} />
            <span className="text-xs" style={{ color: themeUtils.getTextColor(false) }}>Loading modules...</span>
          </div>
        ) : categories
          .filter(cat => cat.isactive === true || cat.is_active === true || cat.isactive === 'true')
          .map(cat => {
            const iconName = PAGE_KEY_ICONS[cat.page_key] || "Circle";
            const Icon = getIcon(iconName);
            const isActive = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${isActive ? "text-white shadow-lg" : "hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                style={{
                  backgroundColor: isActive ? headerBg : "transparent",
                  color: isActive ? "#fff" : themeUtils.getTextColor(false),
                }}
              >
                <Icon size={14} />
                {cat.name}
              </button>
            );
          })}
      </div>

      {/* Toolbar + Grid */}
      <div
        className="flex flex-col gap-4 p-4 rounded-xl border flex-1 overflow-hidden"
        style={{ backgroundColor: themeUtils.getBgColor("card"), borderColor: themeUtils.getBorderColor() }}
      >
        <div className="flex flex-wrap items-center justify-between border-b pb-4 gap-4" style={{ borderColor: themeUtils.getBorderColor() }}>
          <div className="flex items-center gap-3">
            <ActiveIcon size={18} style={{ color: themeUtils.getTextColor(false) }} />
            <span className="text-sm font-bold uppercase tracking-wider" style={{ color: themeUtils.getTextColor(true) }}>
              {activeName} ({filteredGridCameras.length})
            </span>
          </div>
          <div className="flex items-center gap-4">
            <GlobalCameraFilter cameraFilter={cameraFilter} hideCamera={false} />
            <RecordsPerPage
              value={itemsPerPage}
              onChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
              options={[4, 6, 8, 12]}
              label="Cameras per page"
            />
          </div>
        </div>

        {/* Camera Grid */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pr-1">
          {filteredGridCameras.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-60">
              <MonitorPlay size={40} />
              <p className="text-sm font-medium" style={{ color: themeUtils.getTextColor(false) }}>
                {selectedCategoryId
                  ? "No cameras mapped to this module. Assign features in Camera Management."
                  : "No cameras found for this filter."
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {paginatedCameras.map(cam => (
                <LiveCameraCard
                  key={cam.id || cam.value}
                  camera={cam}
                  selectedCategoryId={selectedCategoryId}
                  onUpdate={cameraFilter.refetch}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="pt-2">
          <Pagination
            currentPage={currentPage}
            totalItems={filteredGridCameras.length}
            itemsPerPage={itemsPerPage === null || itemsPerPage === Infinity ? filteredGridCameras.length || 1 : itemsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      </div>
    </div>
  );
}
