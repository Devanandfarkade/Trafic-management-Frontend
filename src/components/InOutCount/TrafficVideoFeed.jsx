import React, { useState } from 'react';
import { Video, Wifi, WifiOff, Loader, Settings } from 'lucide-react';
import CameraSettingsDrawer from '../../ui/common/CameraSettingsDrawer';

export default function TrafficVideoFeed({ frame, isLoading, isConnected, error, themeUtils, totalIn, totalOut, camera }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <div className="w-full h-full relative group bg-black flex items-center justify-center overflow-hidden">
        {frame ? (
          <img
            src={frame}
            alt="Live Traffic Feed"
            className="w-full h-full object-fill opacity-90 transition-opacity duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 gap-4">
            {isLoading ? (
              <>
                <Loader className="w-12 h-12 animate-spin text-purple-500" />
                <p className="text-sm tracking-widest uppercase font-bold animate-pulse text-purple-500">Connecting to Stream...</p>
              </>
            ) : (
              <>
                <Video className="w-16 h-16 opacity-30" />
                <p className="text-sm tracking-widest uppercase font-bold opacity-50">Stream Offline</p>
              </>
            )}
          </div>
        )}

        {/* Dynamic Count Info overlay */}
        <div className="absolute top-4 left-4 bg-black/80 text-white text-xs font-bold px-4 py-2 rounded-lg border flex flex-col gap-2 shadow-lg backdrop-blur-sm transition-all" style={{ borderColor: themeUtils.getBorderColor() }}>
          <div className="flex items-center gap-2 border-b border-gray-700 pb-1 mb-1">
            {isConnected ? <Wifi className={`w-4 h-4 ${!frame ? 'text-orange-500' : 'text-green-500'}`} /> : <WifiOff className="w-4 h-4 text-red-500" />}
            <span className={isConnected ? (!frame ? "text-orange-500" : "text-green-500") : "text-red-500"}>
              {isConnected ? (!frame ? "BUFFERING..." : "LIVE STREAM") : "DISCONNECTED"}
            </span>
          </div>
          {error && <span className="text-red-500 text-[10px]">{error}</span>}
        </div>

        {/* In / Out Counts Badge */}
        <div className="absolute top-4 right-14 bg-white/90 text-black text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg border backdrop-blur-sm transition-all flex items-center gap-3">
          <div className="flex flex-col gap-0.5 items-center">
            <span className="text-gray-500 text-[9px] uppercase tracking-wider">Incoming</span>
            <span className="text-green-600 text-sm font-extrabold">{totalIn}</span>
          </div>
          <div className="w-[1px] h-6 bg-gray-300"></div>
          <div className="flex flex-col gap-0.5 items-center">
            <span className="text-gray-500 text-[9px] uppercase tracking-wider">Outgoing</span>
            <span className="text-orange-600 text-sm font-extrabold">{totalOut}</span>
          </div>
        </div>

        {/* Separate Standalone Settings Icon */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 rounded-lg bg-black/70 hover:bg-black/90 text-blue-400 border border-blue-500/40 backdrop-blur-sm transition-all cursor-pointer shadow-lg flex items-center justify-center"
            title="Camera AI Settings"
          >
            <Settings size={16} className="hover:rotate-45 transition-transform" />
          </button>
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
