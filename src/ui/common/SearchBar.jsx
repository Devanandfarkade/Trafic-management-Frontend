import React from 'react';
import { FiSearch } from 'react-icons/fi';
import { useTheme } from '../Settings/themeUtils';

export const SearchBar = ({ 
  placeholder = "Search...", 
  searchValue, 
  onSearchChange,
  selectOptions = [],
  selectValue,
  onSelectChange,
  className = ""
}) => {
  const { themeUtils } = useTheme();

  return (
    <div 
      className={`flex items-center w-full h-8 rounded-md border shadow-sm overflow-hidden ${className}`}
      style={{ 
        borderColor: themeUtils.getBorderColor(),
        backgroundColor: themeUtils.getBgColor('default') 
      }}
    >
      {/* Optional Select Field */}
      {selectOptions && selectOptions.length > 0 && (
        <select
          value={selectValue}
          onChange={onSelectChange}
          className="h-full px-3 text-xs focus:outline-none border-r"
          style={{ 
            backgroundColor: themeUtils.getBgColor('card'),
            color: themeUtils.getTextColor(true),
            borderColor: themeUtils.getBorderColor()
          }}
        >
          <option value="">All</option>
          {selectOptions.map((opt, idx) => (
            <option key={idx} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Search Input */}
      <div className="relative flex-1 flex items-center h-full">
        <FiSearch 
          className="absolute left-2.5 w-3.5 h-3.5" 
          style={{ color: themeUtils.getTextColor(false) }} 
        />
        <input
          type="text"
          value={searchValue}
          onChange={onSearchChange}
          placeholder={placeholder}
          className="w-full h-full pl-8 pr-3 text-xs focus:outline-none bg-transparent"
          style={{ 
            color: themeUtils.getTextColor(true) 
          }}
        />
      </div>
    </div>
  );
};

export default SearchBar;
