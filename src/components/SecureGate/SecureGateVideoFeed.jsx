import React, { useState } from 'react';
import { Camera, AlertCircle, Settings } from 'lucide-react';
import CameraSettingsDrawer from '../../ui/common/CameraSettingsDrawer';

export default function SecureGateVideoFeed({
  frame,
  isLoading,
  isConnected,
  error,
  themeUtils,
  camera
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <div className="w-full h-full relative bg-black rounded-xl overflow-hidden">
        {/* Stream Status / Placeholder / Video Frame */}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-red-500 z-10">
            <AlertCircle size={48} className="mb-4 opacity-80" />
            <p className="text-lg font-semibold">{error}</p>
            <p className="text-sm opacity-70 mt-2">Check console for details</p>
          </div>
        ) : (isLoading || (!frame && isConnected)) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-blue-400 font-medium tracking-wide">
              {isLoading ? 'Connecting to Stream...' : 'Waiting for Video Frame...'}
            </p>
          </div>
        ) : (!isConnected && !frame) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
            <Camera size={48} className="text-gray-500 mb-4 opacity-50" />
            <p className="text-gray-400 font-medium tracking-wide">Stream Disconnected</p>
          </div>
        ) : (
          frame && (
            <img
              src={frame}
              alt="Live Security Feed"
              className="w-full h-full object-fill"
            />
          )
        )}

        {/* Overlays */}
        <div className="absolute top-4 left-4 flex gap-2 z-20">
          <div className="px-3 py-1.5 rounded bg-black/60 backdrop-blur-sm border border-white/10 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${!isConnected ? 'bg-yellow-400' : !frame ? 'bg-orange-400 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
            <span className={`text-xs font-bold tracking-wider ${!isConnected ? 'text-white' : !frame ? 'text-orange-400' : 'text-white'}`}>
              {!isConnected ? 'DISCONNECTED' : !frame ? 'BUFFERING...' : 'LIVE REC'}
            </span>
          </div>
        </div>

        {/* Theme Styled Settings Icon - Always Visible */}
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 rounded bg-black/60 hover:bg-black/80 text-blue-400 border border-blue-500/30 backdrop-blur-sm transition-all cursor-pointer shadow-md flex items-center justify-center"
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
