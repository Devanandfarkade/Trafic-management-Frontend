import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../Settings/themeUtils.jsx';
import { ChevronDown, Search, X } from 'lucide-react';

const SearchableSelect = ({
  name,
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  disabled = false,
  error = "",
  icon = null,
  className = "",
  extraOption = null,
  size = "md"
}) => {
  const { theme, themeUtils } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery("");
    }
  }, [isOpen]);

  const selectedOption = options.find(
    (opt) => opt.id?.toString() === value?.toString()
  );

  const filteredOptions = options.filter((opt) =>
    opt.name?.toString().toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (option) => {
    if (disabled) return;
    onChange({
      target: {
        name: name,
        value: option.id
      }
    });
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    onChange({
      target: {
        name: name,
        value: ""
      }
    });
  };

  const getBorderColor = () => {
    if (error) return '#ef4444';
    if (isOpen) return theme.headerBg || '#3b82f6';
    return themeUtils.getBorderColor?.() || '#d1d5db';
  };

  const isSm = size === "sm";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full ${isSm ? 'px-2.5 py-1 text-xs rounded-lg h-[34px]' : 'px-3 py-1.5 text-sm rounded-md'} border outline-none transition-all flex items-center justify-between cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        style={{
          borderColor: getBorderColor(),
          backgroundColor: disabled ? themeUtils.getBgColor?.('hover') || '#e5e7eb' : themeUtils.getBgColor?.('input') || '#f9fafb',
          color: themeUtils.getTextColor?.() || '#1f2937',
        }}
      >
        <div className="flex items-center gap-1.5 overflow-hidden mr-1.5">
          {icon && <span className="shrink-0" style={{ color: theme.headerBg || '#3B82F6' }}>{icon}</span>}
          <span className="truncate font-medium" style={{ color: selectedOption ? themeUtils.getTextColor?.(true) : themeUtils.getTextColor?.(false) }}>
            {selectedOption ? selectedOption.name : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedOption && !disabled && (
            <X
              size={isSm ? 12 : 14}
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
            />
          )}
          <ChevronDown
            size={isSm ? 13 : 16}
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {isOpen && (
        <div
          className={`absolute z-[9999] ${isSm ? 'min-w-[190px] w-max max-w-[260px]' : 'w-full'} mt-1 rounded-lg border shadow-xl overflow-hidden flex flex-col max-h-60`}
          style={{
            borderColor: themeUtils.getBorderColor?.() || '#d1d5db',
            backgroundColor: themeUtils.getBgColor?.('card') || '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
        >
          {/* Search Input */}
          <div
            className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
            style={{ borderColor: themeUtils.getBorderColor?.() || '#e5e7eb' }}
          >
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none border-none p-0"
              style={{
                color: themeUtils.getTextColor?.() || '#1f2937'
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 hide-scrollbar">
            {filteredOptions.length > 0 ? (
              <>
                {filteredOptions.map((opt) => {
                  const isSelected = opt.id?.toString() === value?.toString();
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelect(opt)}
                      className="px-3 py-2 text-sm cursor-pointer transition-colors truncate"
                      style={{
                        backgroundColor: isSelected
                          ? (theme.headerBg ? `${theme.headerBg}15` : '#3b82f615')
                          : 'transparent',
                        color: isSelected
                          ? (theme.headerBg || '#3b82f6')
                          : (themeUtils.getTextColor?.() || '#1f2937')
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.target.style.backgroundColor = themeUtils.getBgColor?.('hover') || '#f3f4f6';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.target.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {opt.name}
                    </div>
                  );
                })}
                {extraOption && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      extraOption.onClick(searchQuery);
                      setIsOpen(false);
                    }}
                    className="px-3 py-2 text-sm cursor-pointer transition-colors border-t border-dashed font-semibold sticky bottom-0"
                    style={{
                      backgroundColor: themeUtils.getBgColor?.('card') || '#ffffff',
                      color: theme.headerBg || '#3b82f6',
                      borderColor: themeUtils.getBorderColor?.() || '#e5e7eb'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = themeUtils.getBgColor?.('hover') || '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = themeUtils.getBgColor?.('card') || '#ffffff';
                    }}
                  >
                    {extraOption.label}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col">
                <div className="px-3 py-3 text-sm text-center text-gray-500">
                  No entries found
                </div>
                {extraOption && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      extraOption.onClick(searchQuery);
                      setIsOpen(false);
                    }}
                    className="px-3 py-2 text-sm cursor-pointer transition-colors border-t border-dashed font-semibold"
                    style={{
                      color: theme.headerBg || '#3b82f6',
                      borderColor: themeUtils.getBorderColor?.() || '#e5e7eb'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = themeUtils.getBgColor?.('hover') || '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                    }}
                  >
                    {extraOption.label}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
