import React from 'react';
import InteractivePieChart from '../../ui/common/InteractivePieChart';
import { ArrowRight, ArrowLeft, Loader } from 'lucide-react';

export default function TrafficRightPanel({
  theme,
  themeUtils,
  isConnected,
  connect,
  disconnect,
  totalIn,
  totalOut,
  incomingData,
  outgoingData,
  isLoading,
  liveLogs
}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-2 rounded-lg border" style={{ borderColor: themeUtils.getBorderColor?.() || (theme.mode === "Dark" ? "#1e2a40" : "#e5e7eb") }}>
        <h3 className="text-[11px] font-medium uppercase ml-2" style={{ color: theme.headerBg || "#3b82f6" }}>Directional Analysis</h3>
        <button
          onClick={() => isConnected ? disconnect() : connect()}
          className={`px-4 py-1.5 text-xs font-medium uppercase rounded border transition-all shadow-sm ${isConnected ? 'bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/50 hover:bg-green-500/20'}`}
        >
          {isConnected ? 'HALT' : 'INIT'}
        </button>
      </div>

      {/* Incoming Flow Card */}
      <div
        className="border-2 rounded-xl p-4 shadow-lg relative overflow-hidden flex-1 flex flex-col min-h-[280px]"
        style={{
          backgroundColor: theme.mode === "Dark" ? "#001100" : "#f0fdf4",
          borderColor: theme.mode === "Dark" ? "#003300" : "#bbf7d0"
        }}
      >
        <div className="flex items-center justify-between mb-2 z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <ArrowRight size={14} className="text-green-500" />
            </div>
            <h3 className="text-[11px] font-medium uppercase text-green-500">Incoming Flow</h3>
          </div>
          <span className="text-2xl font-normal text-green-500 drop-shadow-sm">{totalIn}</span>
        </div>

        <div className="flex-1 w-full flex justify-center py-2 relative z-10">
          {totalIn > 0 ? (
            <InteractivePieChart data={incomingData} themeUtils={themeUtils} loading={false} customSize={150} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
              <span className="text-xs font-medium uppercase text-green-600">No Incoming Data</span>
            </div>
          )}
        </div>
      </div>

      {/* Outgoing Flow Card */}
      <div
        className="border-2 rounded-xl p-4 shadow-lg relative overflow-hidden flex-1 flex flex-col min-h-[280px]"
        style={{
          backgroundColor: theme.mode === "Dark" ? "#110500" : "#fff7ed",
          borderColor: theme.mode === "Dark" ? "#331100" : "#fed7aa"
        }}
      >
        <div className="flex items-center justify-between mb-2 z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
              <ArrowLeft size={14} className="text-orange-500" />
            </div>
            <h3 className="text-[11px] font-medium uppercase text-orange-500">Outgoing Flow</h3>
          </div>
          <span className="text-2xl font-normal text-orange-500 drop-shadow-sm">{totalOut}</span>
        </div>

        <div className="flex-1 w-full flex justify-center py-2 relative z-10">
          {totalOut > 0 ? (
            <InteractivePieChart data={outgoingData} themeUtils={themeUtils} loading={false} customSize={150} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
              <span className="text-xs font-medium uppercase text-orange-600">No Outgoing Data</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
