import React, { useState, useEffect } from 'react';
import { Settings, Camera, Cpu, Loader, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import RightSideDialog from './RightSideDialog';
import { useTheme } from '../Settings/themeUtils';
import { useToast } from './CustomToast';
import { API_BASE_URL } from '../../../config.js';

export default function CameraSettingsDrawer({ visible, onHide, camera, onSave }) {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();

  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor('card');
  const headerBg = theme.headerBg || "#3b82f6";

  const [mappedFeatures, setMappedFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(null); // mapping_id being toggled

  const cameraId = camera?.camera_id || camera?.id;
  const isIdValid = cameraId !== undefined && cameraId !== null && cameraId !== 'undefined' && cameraId !== 'null';

  // Fetch features mapped to this camera on open
  useEffect(() => {
    if (!visible || !isIdValid) return;
    fetchCameraFeatures();
  }, [visible, cameraId, isIdValid]);

  const fetchCameraFeatures = async () => {
    if (!isIdValid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/features/camera/${cameraId}`);
      const data = await res.json();
      if (data.success) {
        setMappedFeatures(data.features || []);
      }
    } catch (err) {
      console.error("Error fetching camera features:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (mappingId, currentStatus) => {
    setToggling(mappingId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/features/mapping/${mappingId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on_off_status: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setMappedFeatures(prev =>
          prev.map(f => f.mapping_id === mappingId ? { ...f, on_off_status: !currentStatus } : f)
        );
        toast?.success?.("Updated", `Feature ${!currentStatus ? "enabled" : "disabled"} successfully`);
        if (onSave) onSave();
        window.dispatchEvent(new CustomEvent('camera_settings_updated', { detail: { camera_id: cameraId } }));
      } else {
        toast?.error?.("Error", data.message || "Failed to toggle feature");
      }
    } catch (err) {
      toast?.error?.("Error", "Network error toggling feature");
    } finally {
      setToggling(null);
    }
  };

  // Group features by category (show only active features)
  const groupedFeatures = mappedFeatures
    .filter(feat => feat.isactive === true || feat.isactive === 'true' || feat.is_active === true || feat.isactive === undefined)
    .reduce((acc, feat) => {
      const catName = feat.category_name || "Uncategorized";
      if (!acc[catName]) acc[catName] = [];
      acc[catName].push(feat);
      return acc;
    }, {});

  if (!camera) return null;

  const cameraName = camera.label || camera.name || camera.camera_name || camera.camera_code || "Camera Feed";
  const locationName = camera.location || camera.location_name || "Unknown Location";
  const lat = camera.latitude ?? camera.lat;
  const lng = camera.longitude ?? camera.lng ?? camera.long;
  const hasCoords = lat !== undefined && lat !== null && lng !== undefined && lng !== null;

  return (
    <RightSideDialog visible={visible} onHide={onHide} header="Camera AI Settings & Config">
      <div className="flex flex-col gap-5 pt-3">

        {/* Camera Info Banner */}
        <div className="p-4 rounded-xl border flex items-center gap-3 relative overflow-hidden"
          style={{ backgroundColor: cardBg, borderColor }}>
          <div className="p-3 rounded-xl" style={{ backgroundColor: `${headerBg}15`, color: headerBg }}>
            <Camera size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm truncate" style={{ color: textPrimary }}>
              {cameraName}
            </h3>
            <p className="text-xs truncate opacity-75 mt-0.5" style={{ color: textSecondary }}>
              {locationName}
              {hasCoords && (
                <span className="ml-1.5 opacity-85 font-mono text-[11px] text-blue-400">
                  ({lat}, {lng})
                </span>
              )}
            </p>
            <span className="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded"
              style={{ backgroundColor: `${headerBg}20`, color: headerBg }}>
              {camera.module_type || "Active Stream"}
            </span>
          </div>
        </div>

        {/* Mapped AI Features Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: headerBg }}>
              <Cpu size={14} /> Assigned AI Features
            </h4>
            <button onClick={fetchCameraFeatures}
              className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer transition-colors"
              title="Refresh">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} style={{ color: textSecondary }} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2" style={{ color: textSecondary }}>
              <Loader size={16} className="animate-spin" />
              <span className="text-xs">Loading features...</span>
            </div>
          ) : Object.keys(groupedFeatures).length === 0 ? (
            <div className="py-6 text-center rounded-xl border" style={{ borderColor, color: textSecondary }}>
              <Cpu size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">No features assigned to this camera.</p>
              <p className="text-[10px] mt-1 opacity-70">Go to Camera Management to assign AI features.</p>
            </div>
          ) : (
            Object.entries(groupedFeatures).map(([categoryName, features]) => (
              <div key={categoryName} className="flex flex-col gap-2">
                {/* Category label */}
                <p className="text-[10px] font-bold uppercase tracking-widest px-1"
                  style={{ color: textSecondary }}>
                  {categoryName}
                </p>
                {features.map(feat => {
                  const isOn = feat.on_off_status;
                  const isToggling = toggling === feat.mapping_id;
                  return (
                    <div key={feat.mapping_id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isOn
                          ? "border-green-500/40 bg-green-500/10"
                          : "border-gray-600/30 bg-black/5 dark:bg-white/5 opacity-70"
                      }`}>
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className={`text-xs font-bold truncate ${isOn ? "text-green-400" : ""}`}
                          style={!isOn ? { color: textSecondary } : {}}>
                          {feat.name?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggle(feat.mapping_id, isOn)}
                        disabled={isToggling}
                        className="ml-3 flex-shrink-0 cursor-pointer transition-all disabled:opacity-50"
                        title={isOn ? "Disable feature" : "Enable feature"}
                      >
                        {isToggling ? (
                          <Loader size={20} className="animate-spin" style={{ color: headerBg }} />
                        ) : isOn ? (
                          <ToggleRight size={28} className="text-green-500" />
                        ) : (
                          <ToggleLeft size={28} style={{ color: textSecondary }} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* RTSP Stream URL */}
        <div className="p-4 rounded-xl border flex flex-col gap-2" style={{ backgroundColor: cardBg, borderColor }}>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>Stream Connection URL</span>
          <p className="text-xs font-mono break-all p-2 rounded border text-gray-400" style={{ backgroundColor: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.05)" }}>
            {camera.url || camera.rtsp || camera.rtsp_url || "rtsp://..."}
          </p>
        </div>

        {/* Close button */}
        <div className="flex gap-3 pt-3 border-t" style={{ borderColor }}>
          <button type="button" onClick={onHide}
            className="flex-1 px-4 py-2 border rounded-xl font-bold text-xs uppercase transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            style={{ borderColor, color: textPrimary }}>
            Close
          </button>
        </div>

      </div>
    </RightSideDialog>
  );
}
