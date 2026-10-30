import React from 'react';
import { useTheme } from '../Settings/themeUtils';

export default function PageHeader({ title, subtitle, icon: Icon, rightContent }) {
  const { theme, themeUtils } = useTheme();
  const isDark = theme.mode === "Dark";

  // Use theme color for accents, fallback to blue if none
  const accentColor = theme.headerBg || "#3b82f6";

  // Determine gradient based on mode
  const gradientStyle = isDark
    ? { backgroundImage: `linear-gradient(to right, ${accentColor}, ${accentColor}99)` }
    : { color: accentColor }; // Solid color in light mode for readability

  return (
    <div
      className="flex flex-col lg:flex-row justify-between items-center gap-3 py-2 px-3 md:py-2.5 md:px-3.5 rounded-xl shadow-sm border transition-all duration-300 w-full"
      style={{
        backgroundColor: themeUtils.getBgColor?.("card") || (isDark ? "#0f172a" : "#ffffff"),
        borderColor: themeUtils.getBorderColor?.() || (isDark ? "#1e2a40" : "#e5e7eb")
      }}
    >
      <div className="flex items-center gap-2.5 w-full lg:w-auto">
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0 transition-transform hover:scale-105"
            style={{
              backgroundColor: `${accentColor}15`,
              color: accentColor,
              border: `1px solid ${accentColor}30`
            }}
          >
            <Icon size={16} />
          </div>
        )}
        <div className="flex flex-col justify-center gap-0.5 w-full">
          <h1
            className="text-sm md:text-base font-bold tracking-tight leading-none drop-shadow-sm"
            style={isDark ? { ...gradientStyle, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : gradientStyle}
          >
            {title}
          </h1>
          {subtitle && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              <p
                className="text-[10px] md:text-[11px] font-medium opacity-80 leading-snug"
                style={{ color: themeUtils.getTextColor(true) }}
              >
                {subtitle}
              </p>
            </div>
          )}
        </div>
      </div>

      {rightContent && (
        <div className="flex items-center gap-3 shrink-0">
          {rightContent}
        </div>
      )}
    </div>
  );
}
