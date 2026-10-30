import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../Settings/themeUtils";
import { Select } from "../common/Select";
import PageHeader from "../common/PageHeader";
import { Maximize2, Minimize2 } from "lucide-react";
import GlobalCameraFilter from "../common/GlobalCameraFilter";

export default function ModuleLayout({
  title,
  subtitle,
  videoComponent,
  rightPanelComponent,
  bottomMetricsComponent,
  bottomTableComponent,
  cameras,
  selectedCamera,
  onCameraChange,
  cameraFilter,
  extraFilterData = [],
  hideCameraInHeader,
  headerActions,
  hideLiveSystem = false,
}) {
  const { theme, themeUtils } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);
  const isDark = theme.mode === "Dark";
  const borderColor = themeUtils.getBorderColor?.() || (isDark ? "#1e2a40" : "#e5e7eb");
  const videoBg = themeUtils.getBgColor?.('panel') || (isDark ? "#1c2430" : "#e5e7eb");
  const textPrimary = themeUtils.getTextColor(true);

  // Keep camera dropdown in header for single-video monitoring pages (Secure Gate, etc.)
  // and hide it for 12-camera grid pages
  const shouldHideCameraInHeader = hideCameraInHeader !== undefined
    ? hideCameraInHeader
    : !rightPanelComponent;

  // Use cameraFilter options directly from backend so filters remain strictly dynamic
  const enhancedCameraFilter = cameraFilter;

  return (
    <div
      className="flex h-full w-full flex-col font-sans overflow-y-auto overflow-x-hidden hide-scrollbar pb-6"
      style={{ color: textPrimary }}
    >
      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full">
        <PageHeader
          title={title}
          subtitle={subtitle}
          rightContent={
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 justify-end max-w-full">
              {enhancedCameraFilter ? (
                <GlobalCameraFilter cameraFilter={enhancedCameraFilter} hideCamera={shouldHideCameraInHeader} />
              ) : (
                cameras && cameras.length > 0 && !shouldHideCameraInHeader && (
                  <select
                    className="bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded text-xs font-bold outline-none border hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    style={{ borderColor: borderColor, color: textPrimary }}
                    value={selectedCamera}
                    onChange={(e) => onCameraChange && onCameraChange(e.target.value)}
                    title="Select Camera"
                  >
                    {cameras.map(cam => (
                      <option key={cam.value} value={cam.value} className="bg-white dark:bg-gray-900 text-black dark:text-white font-medium p-2">
                        {cam.label || cam.name}
                      </option>
                    ))}
                  </select>
                )
              )}
              {headerActions}
              {!hideLiveSystem && (
                <div className="px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border" style={{ backgroundColor: `${theme.headerBg || "#3b82f6"}10`, color: theme.headerBg || "#3b82f6", borderColor: `${theme.headerBg || "#3b82f6"}30` }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.headerBg || "#3b82f6" }}></div>
                  LIVE SYSTEM
                </div>
              )}
            </div>
          }

        />

        <div className="flex flex-col pt-2 gap-4">
          {/* Top Section (Video & Stats or Camera Grid) */}
          <div className={`flex flex-col ${rightPanelComponent ? "lg:flex-row lg:h-[58vh] xl:h-[62vh] 2xl:h-[68vh] lg:min-h-[420px] max-h-[85vh] w-full" : "w-full"} gap-3`}>
            {/* Left Column (Video feed & Bottom Stats) */}
            <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-[260px] sm:min-h-[340px] lg:min-h-0">
              {/* Video Feed Area */}
              {rightPanelComponent ? (
                <div
                  className="relative flex-1 rounded-lg border overflow-hidden flex flex-col min-h-0"
                  style={{ backgroundColor: videoBg, borderColor: borderColor }}
                >
                  {/* Video Content Container */}
                  {isMaximized ? createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-10">
                      <div className="w-full h-full shadow-2xl rounded-xl border border-gray-700 overflow-hidden bg-black flex flex-col relative">
                        <button
                          onClick={() => setIsMaximized(false)}
                          className="absolute bottom-4 right-4 z-[120] bg-black/60 hover:bg-black/90 text-white p-2 rounded-md transition-all shadow-md border border-white/20"
                          title="Minimize Video"
                        >
                          <Minimize2 size={18} />
                        </button>
                        <div className="flex-1 w-full relative">
                          {videoComponent}
                        </div>
                      </div>
                    </div>,
                    document.body
                  ) : (
                    <div className="w-full h-full relative z-0 flex flex-col">
                      <button
                        onClick={() => setIsMaximized(true)}
                        className="absolute bottom-4 right-4 z-[120] bg-black/60 hover:bg-black/90 text-white p-2 rounded-md transition-all shadow-md border border-white/20"
                        title="Maximize Video"
                      >
                        <Maximize2 size={18} />
                      </button>
                      <div className="flex-1 w-full relative">
                        {videoComponent}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full">
                  {videoComponent}
                </div>
              )}

              {/* Bottom Metrics Area */}
              {bottomMetricsComponent && (
                <div className="shrink-0">
                  {bottomMetricsComponent}
                </div>
              )}
            </div>

            {/* Right Column (Summary Cards) */}
            {rightPanelComponent && (
              <div className="w-full lg:w-[360px] xl:w-[400px] 2xl:w-[440px] flex flex-col gap-3 overflow-y-auto hide-scrollbar shrink-0">
                {rightPanelComponent}
              </div>
            )}
          </div>

          {/* Bottom Table Section */}
          {bottomTableComponent && (
            <div className="w-full shrink-0">
              {bottomTableComponent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
