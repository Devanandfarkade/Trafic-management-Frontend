// components/Common/RecordsPerPage.jsx
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from "../Settings/themeUtils";

const RecordsPerPage = ({
  value,
  onChange,
  options = [10, 25, 50],
  className = "",
  allValue = "ALL",
  label = ""
}) => {
  const { themeUtils } = useTheme();

  // Handle the change event
  const handleChange = (e) => {
    const selectedValue = e.target.value;
    if (selectedValue === allValue) {
      onChange(null);
    } else {
      onChange(Number(selectedValue));
    }
  };

  // Determine what value to show in the select
  const displayValue = value === null || value === Infinity || value === "ALL" ? allValue : value;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap opacity-50" style={{ color: themeUtils.getTextColor(false) }}>
          {label}
        </span>
      )}
      <div className="relative group">
        <select
          value={displayValue}
          onChange={handleChange}
          className="appearance-none pl-3 pr-8 h-8 rounded-lg border text-[11px] font-black uppercase tracking-widest focus:ring-1 focus:ring-blue-500/50 focus:outline-none transition-all cursor-pointer box-border shadow-sm hover:shadow-md"
          style={{
            backgroundColor: themeUtils.getBgColor("input"),
            borderColor: themeUtils.getBorderColor(),
            color: themeUtils.getTextColor(true),
            colorScheme: "dark",
          }}
        >
          <option key={allValue} value={allValue} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            ALL
          </option>
          {options.map(option => (
            <option key={option} value={option} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              {option}
            </option>
          ))}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
          <ChevronDown size={14} style={{ color: themeUtils.getTextColor(true) }} />
        </div>
      </div>
    </div>
  );
};

export default RecordsPerPage;