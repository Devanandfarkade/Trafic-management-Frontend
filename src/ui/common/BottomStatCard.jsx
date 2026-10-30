import React from 'react';
import { useTheme } from '../Settings/themeUtils';

export default function BottomStatCard({ icon, title, value, subtitle, textValue, onClick }) {
  const { theme, themeUtils } = useTheme();

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#111827] border border-gray-200 dark:border-blue-900/40 rounded-xl p-3.5 flex flex-row items-center justify-between gap-3 shadow-lg transition-all hover:border-blue-500/50 hover:bg-gray-100 dark:hover:bg-white/5 h-full min-w-0 ${onClick ? "cursor-pointer active:scale-95 hover:scale-[1.02]" : ""
        }`}
    >
      {/* Left side: Icon + Title & Subtitle */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && (
          <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}

        <div className="flex flex-col min-w-0 text-left">
          <p className="text-[10px] font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase truncate mb-0.5">
            {title}
          </p>
          {(subtitle || textValue) && (
            <p className="text-[10px] text-gray-500 font-medium truncate">
              {subtitle || textValue}
            </p>
          )}
        </div>
      </div>

      {/* Right side: Numbers / Value */}
      {value !== undefined && (
        <div className="flex flex-col items-end justify-center shrink-0 text-right ml-auto">
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-none tracking-tight">
            {value}
          </p>
        </div>
      )}
    </div>
  );
}
