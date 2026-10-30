import React from 'react';
import InteractivePieChart from '../../ui/common/InteractivePieChart';
import { Car, Truck, Bike, Loader } from 'lucide-react';

export default function CountRightPanel({ theme, themeUtils, total, isConnected, connect, disconnect, pieData, isLoading, counts }) {
  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Top Telemetry: Distribution */}
      <div
        className="border rounded-xl p-5 shadow-2xl relative overflow-hidden group flex-1 flex flex-col"
        style={{
          backgroundColor: themeUtils.getBgColor?.('card') || (theme.mode === "Dark" ? "#0f1724" : "#ffffff"),
          borderColor: theme.headerBg || "#3b82f6"
        }}
      >
        <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors pointer-events-none"></div>
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <h3 className="text-[11px] font-medium mb-1 text-blue-500 flex items-center gap-2 uppercase">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Flow Telemetry
            </h3>
            <p className="text-4xl font-normal text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 mt-2">
              {total}
            </p>
            <p className="text-[10px] font-medium uppercase opacity-60 mt-1" style={{ color: themeUtils.getTextColor(true) }}>Total Live Count</p>
          </div>
          <button
            onClick={() => isConnected ? disconnect() : connect()}
            className={`px-4 py-1.5 text-xs font-medium uppercase rounded border transition-all shadow-sm ${isConnected ? 'bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-green-500/10 text-green-500 border-green-500/50 hover:bg-green-500/20 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]'}`}
          >
            {isConnected ? 'HALT' : 'INIT'}
          </button>
        </div>

        <div className="w-full flex-1 flex items-center justify-center py-2 relative z-10">
          {total > 0 ? (
            <InteractivePieChart data={pieData} themeUtils={themeUtils} loading={false} customSize={220} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium opacity-50 uppercase" style={{ color: themeUtils.getTextColor(false) }}>Awaiting Signal</span>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
