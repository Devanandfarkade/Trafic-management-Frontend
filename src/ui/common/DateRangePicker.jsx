import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useTheme } from '../Settings/themeUtils';

/**
 * Helper to get local date in YYYY-MM-DD format
 */
const getTodayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Reusable From - To Date Range Picker Component
 * Provides clean, theme-aware dual date inputs with calendar icon and one-click clear.
 */
export default function DateRangePicker({
  fromDate = '',
  toDate = '',
  onFromChange,
  onToChange,
  onClear,
  themeUtils: propThemeUtils,
  className = '',
  maxDate,
  allowFuture = false,
}) {
  const { themeUtils: contextThemeUtils, theme } = useTheme();
  const themeUtils = propThemeUtils || contextThemeUtils;
  const isDark = theme?.mode === 'Dark';

  const borderColor = themeUtils?.getBorderColor?.() || (isDark ? '#1e293b' : '#cbd5e1');
  const inputBg = themeUtils?.getBgColor?.('input') || (isDark ? '#0f172a' : '#ffffff');
  const textColor = themeUtils?.getTextColor?.(true) || (isDark ? '#f8fafc' : '#0f172a');
  const labelColor = themeUtils?.getTextColor?.(false) || (isDark ? '#94a3b8' : '#64748b');

  const today = getTodayString();
  const effectiveMaxDate = maxDate || (allowFuture ? undefined : today);

  const hasValue = Boolean(fromDate || toDate);

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      if (onFromChange) onFromChange('');
      if (onToChange) onToChange('');
    }
  };

  const handleFromChange = (e) => {
    let val = e.target.value;
    if (!val) {
      if (onFromChange) onFromChange('');
      return;
    }

    // Do not allow selecting future date
    if (effectiveMaxDate && val > effectiveMaxDate) {
      val = effectiveMaxDate;
    }

    if (onFromChange) onFromChange(val);

    // If toDate is already selected and is earlier than the new fromDate,
    // automatically sync toDate to match fromDate
    if (toDate && toDate < val) {
      if (onToChange) onToChange(val);
    }
  };

  const handleToChange = (e) => {
    let val = e.target.value;
    if (!val) {
      if (onToChange) onToChange('');
      return;
    }

    // Do not allow future dates (only up to current date)
    if (effectiveMaxDate && val > effectiveMaxDate) {
      val = effectiveMaxDate;
    }

    // Do not allow selecting previous date earlier than fromDate
    if (fromDate && val < fromDate) {
      val = fromDate;
    }

    if (onToChange) onToChange(val);
  };

  // From date cannot be later than toDate, and neither can be in the future
  const maxFromDate = toDate
    ? (effectiveMaxDate && toDate > effectiveMaxDate ? effectiveMaxDate : toDate)
    : effectiveMaxDate;

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 border rounded-lg h-[34px] shadow-sm transition-all focus-within:ring-1 focus-within:ring-blue-500 shrink-0 ${className}`}
      style={{
        borderColor: hasValue ? '#3b82f6' : borderColor,
        backgroundColor: inputBg,
      }}
    >
      <Calendar size={13} className={hasValue ? 'text-blue-500 shrink-0' : 'text-gray-400 shrink-0'} />

      {/* From Date */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wider select-none opacity-80" style={{ color: labelColor }}>
          From:
        </span>
        <input
          type="date"
          value={fromDate || ''}
          max={maxFromDate || undefined}
          onChange={handleFromChange}
          className="w-[84px] bg-transparent border-0 outline-none text-[10.5px] font-medium cursor-pointer p-0"
          style={{ color: textColor, colorScheme: isDark ? 'dark' : 'light' }}
          title="Start date"
        />
      </div>

      <span className="text-gray-400 text-xs select-none">|</span>

      {/* To Date */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wider select-none opacity-80" style={{ color: labelColor }}>
          To:
        </span>
        <input
          type="date"
          value={toDate || ''}
          min={fromDate || undefined}
          max={effectiveMaxDate || undefined}
          onChange={handleToChange}
          className="w-[84px] bg-transparent border-0 outline-none text-[10.5px] font-medium cursor-pointer p-0"
          style={{ color: textColor, colorScheme: isDark ? 'dark' : 'light' }}
          title="End date"
        />
      </div>

      {/* Clear Button */}
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          title="Clear date range"
          className="ml-0.5 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
