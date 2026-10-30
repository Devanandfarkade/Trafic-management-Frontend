import React, { useState } from 'react';
import { Video, Wifi, WifiOff, Loader, Settings } from 'lucide-react';
import CameraSettingsDrawer from '../../ui/common/CameraSettingsDrawer';

export default function CountVideoFeed({ frame, isLoading, isConnected, error, themeUtils, counts, classColors, camera }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const activeClassEntries = Object.entries(counts || {}).filter(
    ([key, val]) => typeof val === "number" && val > 0 && !key.endsWith("_in") && !key.endsWith("_out") && key !== "total_count"
  );

  return (
    <>
      <div className="w-full h-full relative group bg-black flex items-center justify-center overflow-hidden">
        {frame ? (
          <img src={frame} alt="Live Feed" className="w-full h-full object-fill opacity-90 transition-opacity duration-300" />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 gap-4">
            {isLoading ? (
              <>
                <Loader className="w-12 h-12 animate-spin text-blue-500" />
                <p className="text-sm tracking-widest uppercase font-bold animate-pulse text-blue-500">Connecting to Stream...</p>
              </>
            ) : (
              <>
                <Video className="w-16 h-16 opacity-30" />
                <p className="text-sm tracking-widest uppercase font-bold opacity-50">Stream Offline</p>
              </>
            )}
          </div>
        )}

        {/* Top Right Action Overlay: Theme Styled Settings Icon */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 rounded bg-black/60 hover:bg-black/80 text-blue-400 border border-blue-500/30 backdrop-blur-sm transition-all cursor-pointer"
            title="Camera AI Settings"
          >
            <Settings size={16} className="hover:rotate-45 transition-transform" />
          </button>
        </div>

        {/* Count Info overlay */}
        <div className="absolute bottom-4 left-4 bg-black/80 text-white text-xs font-bold px-4 py-2 rounded-lg border flex flex-col gap-2 shadow-lg backdrop-blur-sm transition-all max-w-[90%]" style={{ borderColor: themeUtils.getBorderColor() }}>
          <div className="flex items-center gap-2 border-b border-gray-700 pb-1 mb-1">
            {isConnected ? <Wifi className={`w-4 h-4 ${!frame ? 'text-orange-500' : 'text-green-500'}`} /> : <WifiOff className="w-4 h-4 text-red-500" />}
            <span className={isConnected ? (!frame ? "text-orange-500" : "text-green-500") : "text-red-500"}>
              {isConnected ? (!frame ? "BUFFERING..." : "HEAVY VEHICLE SURVEILLANCE STREAM") : "DISCONNECTED"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="opacity-70">LIVE DETECTIONS:</span>
            {activeClassEntries.length > 0 ? (
              activeClassEntries.map(([cls, val]) => (
                <span
                  key={cls}
                  className="px-2 py-0.5 rounded font-mono font-bold text-[10px]"
                  style={{
                    backgroundColor: `${classColors[cls] || "#3b82f6"}22`,
                    color: classColors[cls] || "#3b82f6",
                    border: `1px solid ${classColors[cls] || "#3b82f6"}66`,
                  }}
                >
                  {cls.toUpperCase().replace("_", " ")}: {val}
                </span>
              ))
            ) : (
              <span className="text-gray-400 font-mono text-[10px]">Scanning lane...</span>
            )}
          </div>
          {error && <span className="text-red-500 text-[10px]">{error}</span>}
        </div>
      </div>

      <CameraSettingsDrawer
        visible={isDrawerOpen}
        onHide={() => setIsDrawerOpen(false)}
        camera={camera}
      />
    </>
  );
}
