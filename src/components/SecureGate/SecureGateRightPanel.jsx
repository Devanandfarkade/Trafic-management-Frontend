import React from 'react';
import { UserCheck, UserPlus, RefreshCcw, Wifi, WifiOff } from 'lucide-react';

export default function SecureGateRightPanel({
  themeUtils,
  isConnected,
  connect,
  disconnect,
  detections = [],
  isLoading
}) {
  const isDark = themeUtils.getBgColor('default') !== '#ffffff';

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Connection Control */}
      <div
        className="rounded-xl border p-4 shadow-sm"
        style={{
          backgroundColor: themeUtils.getBgColor('card'),
          borderColor: themeUtils.getBorderColor()
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold opacity-80 uppercase tracking-wider">Stream Control</h3>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></span>
            <span className="text-xs font-bold">{isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={connect}
            disabled={isConnected || isLoading}
            className={`flex-1 py-2 px-3 rounded text-sm font-bold flex items-center justify-center gap-2 transition-all ${isConnected || isLoading
              ? 'opacity-50 cursor-not-allowed bg-gray-500/20 text-gray-500'
              : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20'
              }`}
          >
            <Wifi size={16} />
            Connect
          </button>
          <button
            onClick={disconnect}
            disabled={!isConnected}
            className={`flex-1 py-2 px-3 rounded text-sm font-bold flex items-center justify-center gap-2 transition-all ${!isConnected
              ? 'opacity-50 cursor-not-allowed bg-gray-500/20 text-gray-500'
              : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
              }`}
          >
            <WifiOff size={16} />
            Disconnect
          </button>
        </div>
      </div>

      {/* Detections List */}
      <div
        className="flex-1 rounded-xl border flex flex-col overflow-hidden shadow-sm"
        style={{
          backgroundColor: themeUtils.getBgColor('card'),
          borderColor: themeUtils.getBorderColor()
        }}
      >
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: themeUtils.getBorderColor() }}>
          <h3 className="font-bold">Live Detections</h3>
          <div className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-xs font-bold">
            {detections.length} In Frame
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
          {detections.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <RefreshCcw size={32} className="mb-2 animate-spin-slow" />
              <p className="text-sm font-medium">Scanning for faces...</p>
            </div>
          ) : (
            detections.map((det, idx) => {
              let icon, color, text;

              if (det.status === 'RECOGNIZED') {
                icon = <UserCheck size={18} />;
                color = 'text-green-500';
                text = `Recognized: ${det.id}`;
              } else if (det.status === 'NEW_REGISTERED') {
                icon = <UserPlus size={18} />;
                color = 'text-blue-500';
                text = `New Person: ${det.id}`;
              } else if (det.status === 'COLLECTING') {
                icon = <RefreshCcw size={18} className="animate-spin" />;
                color = 'text-yellow-500';
                text = `Collecting: ${det.progress}/10`;
              }

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-center gap-3 ${color.replace('text-', 'bg-').replace('-500', '-500/10')} ${color.replace('text-', 'border-').replace('-500', '-500/30')}`}
                >
                  <div className={`p-2 rounded bg-white/10 ${color}`}>
                    {icon}
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${color}`}>{text}</p>
                    <p className="text-xs opacity-70 mt-0.5">Status: {det.status}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
