import React, { useState, useEffect, useRef } from "react";
import { Filter, X, RefreshCw } from "lucide-react";

export default function AllInOneFilter({
  filters,
  values,
  onChange,
  onReset,
  fields = [],
  totalItems,
  themeUtils,
  title = "Filter Alerts"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQueries, setSearchQueries] = useState({});
  const [openSubField, setOpenSubField] = useState(null); // holds key of open sub-dropdown
  const [openDirection, setOpenDirection] = useState("bottom"); // "bottom" | "top"
  const filterRef = useRef(null);
  const cardRef = useRef(null);

  const today = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  const safeFilters = filters || values || {};

  const handleSearchChange = (key, val) => {
    setSearchQueries((prev) => ({ ...prev, [key]: val }));
  };

  const handleToggleSub = (key, event) => {
    if (openSubField === key) {
      setOpenSubField(null);
    } else {
      if (cardRef.current) {
        const cardRect = cardRef.current.getBoundingClientRect();
        const buttonRect = event.currentTarget.getBoundingClientRect();

        const spaceBelow = cardRect.bottom - buttonRect.bottom;
        const spaceAbove = buttonRect.top - cardRect.top;

        let direction = "bottom";
        if (spaceBelow < 170 && spaceAbove < 170) {
          // Both vertical directions are tight! Check horizontal space inside card
          const spaceRight = cardRect.right - buttonRect.right;
          const spaceLeft = buttonRect.left - cardRect.left;

          if (spaceRight >= 200) {
            direction = "right";
          } else if (spaceLeft >= 200) {
            direction = "left";
          } else {
            // Fallback to larger vertical space
            direction = spaceAbove > spaceBelow ? "top" : "bottom";
          }
        } else if (spaceBelow < 170 && spaceAbove > spaceBelow) {
          direction = "top";
        } else {
          direction = "bottom";
        }
        setOpenDirection(direction);
      } else {
        setOpenDirection("bottom");
      }
      setOpenSubField(key);
    }
  };

  const handleReset = () => {
    setSearchQueries({});
    setOpenSubField(null);
    setOpenDirection("bottom");
    if (onReset) onReset();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsOpen(false);
        setOpenSubField(null);
      } else {
        // If clicking inside the card but not on the active sub-dropdown's button or popup content, close the sub-dropdown
        if (openSubField) {
          const clickedOnSubButton = event.target.closest(`button[data-subfield="${openSubField}"]`);
          const clickedOnSubPopup = event.target.closest(`div[data-subfield-popup="${openSubField}"]`);
          if (!clickedOnSubButton && !clickedOnSubPopup) {
            setOpenSubField(null);
          }
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openSubField]);

  const activeFilterCount = (fields || []).reduce((count, field) => {
    if (!field) return count;
    if (field.type === "dateRange") {
      const fromVal = field.keys?.from && safeFilters[field.keys.from];
      const toVal = field.keys?.to && safeFilters[field.keys.to];
      
      const ignoreFrom = field.ignoreValues?.from;
      const ignoreTo = field.ignoreValues?.to;
      
      if (fromVal && fromVal !== ignoreFrom) count++;
      if (toVal && toVal !== ignoreTo) count++;
    } else if (field.type === "date") {
      const val = field.key && safeFilters[field.key];
      const ignoreVal = field.ignoreValue;
      if (val && val !== ignoreVal) count++;
    } else if (field.type === "segmented") {
      if (field.key && safeFilters[field.key] && safeFilters[field.key] !== field.defaultValue) count++;
    } else {
      const val = field.key && safeFilters[field.key];
      const ignoreVal = field.ignoreValue !== undefined ? field.ignoreValue : field.defaultValue;
      if (val && val !== ignoreVal) {
        if (Array.isArray(val)) {
          if (val.length > 0) count++;
        } else {
          count++;
        }
      }
    }
    return count;
  }, 0);

  return (
    <div className="relative inline-flex items-center gap-1 text-left" ref={filterRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-3 rounded-md text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all duration-300 select-none hover:scale-[1.02] active:scale-95 border cursor-pointer"
        style={{
          borderColor: themeUtils.getBorderColor(),
          backgroundColor: isOpen ? themeUtils.getBgColor("input") : "rgba(255, 255, 255, 0.03)",
          color: themeUtils.getTextColor(),
        }}
      >
        <Filter size={11} className={isOpen ? "text-amber-500 animate-pulse" : ""} />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white bg-amber-500">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Outside Clear Button when filters are active */}
      {activeFilterCount > 0 && onReset && (
        <button
          type="button"
          onClick={handleReset}
          className="h-8 px-2.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all border text-red-400 hover:text-red-300 border-red-500/30 bg-red-500/10 hover:bg-red-500/20 cursor-pointer"
          title="Clear all active filters"
        >
          <RefreshCw size={10} />
          <span>Clear</span>
        </button>
      )}

      {isOpen && (
        <div
          ref={cardRef}
          className="absolute right-0 top-full mt-2 w-[480px] rounded-xl shadow-2xl border p-4 z-50 transition-all duration-300 backdrop-blur-md"
          style={{
            backgroundColor: themeUtils.getBgColor("card"),
            borderColor: themeUtils.getBorderColor(),
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
            overflow: "hidden"
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: themeUtils.getBorderColor() }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: themeUtils.getTextColor(true) }}>
              {title}
            </span>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[9px] uppercase font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 bg-transparent border-none outline-none cursor-pointer"
                  title="Reset Filters"
                >
                  <RefreshCw size={8} /> Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors bg-transparent border-none outline-none cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Filters Content — 2 Column Layout */}
          <div className="grid grid-cols-2 gap-3 text-left">
            {(fields || []).map((field, idx) => {
              if (field.type === "date") {
                return (
                  <div key={idx} className="col-span-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: themeUtils.getTextColor(false) }}>
                      {field.label}
                    </span>
                    <input
                      type="date"
                      value={safeFilters[field.key] || ""}
                      onChange={(e) => onChange && onChange(field.key, e.target.value)}
                      className="w-full h-8 px-2 py-1 text-[11px] font-semibold border rounded-md focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                      style={{
                        borderColor: themeUtils.getBorderColor(),
                        backgroundColor: themeUtils.getBgColor("input"),
                        color: themeUtils.getTextColor(),
                      }}
                    />
                  </div>
                );
              }

              if (field.type === "dateRange") {
                return (
                  <div key={idx} className="col-span-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: themeUtils.getTextColor(false) }}>
                      {field.label}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[9px] opacity-70 mb-0.5" style={{ color: themeUtils.getTextColor(false) }}>From</span>
                        <input
                          type="date"
                          value={safeFilters[field.keys?.from] || ""}
                          max={safeFilters[field.keys?.to] || today}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (onChange) onChange(field.keys?.from, val);
                            if (safeFilters[field.keys?.to] && safeFilters[field.keys?.to] < val) {
                              if (onChange) onChange(field.keys?.to, val);
                            }
                          }}
                          className="w-full h-8 px-2 py-1 text-[11px] font-semibold border rounded-md focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                          style={{
                            borderColor: themeUtils.getBorderColor(),
                            backgroundColor: themeUtils.getBgColor("input"),
                            color: themeUtils.getTextColor(),
                          }}
                        />
                      </div>
                      <div>
                        <span className="block text-[9px] opacity-70 mb-0.5" style={{ color: themeUtils.getTextColor(false) }}>To</span>
                        <input
                          type="date"
                          value={safeFilters[field.keys?.to] || ""}
                          min={safeFilters[field.keys?.from] || undefined}
                          max={today}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (today && val > today) val = today;
                            if (safeFilters[field.keys?.from] && val < safeFilters[field.keys?.from]) {
                              val = safeFilters[field.keys?.from];
                            }
                            if (onChange) onChange(field.keys?.to, val);
                          }}
                          className="w-full h-8 px-2 py-1 text-[11px] font-semibold border rounded-md focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                          style={{
                            borderColor: themeUtils.getBorderColor(),
                            backgroundColor: themeUtils.getBgColor("input"),
                            color: themeUtils.getTextColor(),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              if (field.type === "select") {
                const query = (searchQueries[field.key] || "").toLowerCase();
                const filteredOptions = (field.options || []).filter(opt => {
                  const label = typeof opt === "object" ? (opt.name !== undefined ? opt.name : opt.label) : opt;
                  return String(label).toLowerCase().includes(query);
                });
                const currentValue = safeFilters[field.key];
                
                // Get current display label
                let displayLabel = field.placeholder || `Select ${field.label}`;
                if (currentValue && (!Array.isArray(currentValue) || currentValue.length > 0)) {
                  if (Array.isArray(currentValue)) {
                    displayLabel = `${currentValue.length} Selected`;
                  } else {
                    const selectedOpt = (field.options || []).find(opt => {
                      const val = typeof opt === "object" ? (opt.id !== undefined ? opt.id : (opt.value !== undefined ? opt.value : opt.val)) : opt;
                      return String(val) === String(currentValue);
                    });
                    if (selectedOpt) {
                      displayLabel = typeof selectedOpt === "object" ? (selectedOpt.name !== undefined ? selectedOpt.name : selectedOpt.label) : selectedOpt;
                    }
                  }
                }

                const isSubOpen = openSubField === field.key;

                return (
                  <div key={idx} className="relative flex flex-col gap-1.5 col-span-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: themeUtils.getTextColor(false) }}>
                      {field.label}
                    </span>
                    
                    {/* Collapsed Dropdown Button */}
                    <button
                      type="button"
                      data-subfield={field.key}
                      onClick={(e) => handleToggleSub(field.key, e)}
                      className="w-full h-8 px-3 rounded-md text-[11px] font-semibold border flex items-center justify-between transition-all select-none cursor-pointer"
                      style={{
                        borderColor: themeUtils.getBorderColor(),
                        backgroundColor: themeUtils.getBgColor("input"),
                        color: themeUtils.getTextColor(),
                      }}
                    >
                      <span className="truncate pr-2">{displayLabel}</span>
                      <span className="text-[8px] opacity-60">▼</span>
                    </button>

                    {/* Sub-dropdown Popup Container */}
                    {isSubOpen && (
                      <div 
                        data-subfield-popup={field.key}
                        className={`absolute z-50 flex flex-col gap-1.5 border rounded-lg p-2 ${
                          openDirection === "top" ? "bottom-full mb-1 left-0 right-0" :
                          openDirection === "right" ? "left-full top-0 ml-1 w-[200px]" :
                          openDirection === "left" ? "right-full top-0 mr-1 w-[200px]" :
                          "top-full mt-1 left-0 right-0"
                        }`}
                        style={{
                          borderColor: themeUtils.getBorderColor(),
                          backgroundColor: themeUtils.getBgColor("card"),
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
                        }}
                      >
                        {/* Search Input */}
                        <input
                          type="text"
                          placeholder={`Search ${field.label}...`}
                          value={searchQueries[field.key] || ""}
                          onChange={(e) => handleSearchChange(field.key, e.target.value)}
                          className="w-full h-7 px-2 text-[10px] border rounded outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                          style={{
                            borderColor: themeUtils.getBorderColor(),
                            backgroundColor: themeUtils.getBgColor("input"),
                            color: themeUtils.getTextColor(),
                          }}
                          autoFocus
                        />

                        {/* Scrollable Checkbox List */}
                        <div 
                          className="max-h-[120px] overflow-y-auto flex flex-col gap-1 hide-scrollbar"
                        >
                          {filteredOptions.length === 0 ? (
                            <span className="text-[10px] opacity-50 px-1 py-0.5" style={{ color: themeUtils.getTextColor(false) }}>No options found</span>
                          ) : (
                            filteredOptions.map((opt, optIdx) => {
                              const val = typeof opt === "object" ? (opt.id !== undefined ? opt.id : (opt.value !== undefined ? opt.value : opt.val)) : opt;
                              const label = typeof opt === "object" ? (opt.name !== undefined ? opt.name : opt.label) : opt;
                              const isChecked = Array.isArray(currentValue)
                                ? currentValue.includes(val)
                                : currentValue === val;

                              return (
                                <label 
                                  key={optIdx} 
                                  className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white/5 cursor-pointer select-none text-[11px] transition-colors"
                                  style={{ color: themeUtils.getTextColor() }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (Array.isArray(currentValue)) {
                                        const nextVal = isChecked
                                          ? currentValue.filter(v => v !== val)
                                          : [...currentValue, val];
                                        onChange && onChange(field.key, nextVal);
                                      } else {
                                        if (isChecked) {
                                          onChange && onChange(field.key, "");
                                        } else {
                                          onChange && onChange(field.key, val);
                                        }
                                        setOpenSubField(null); // Close only for single select
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                                  />
                                  <span className="truncate">{label}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              if (field.type === "segmented") {
                return (
                  <div key={idx} className="col-span-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: themeUtils.getTextColor(false) }}>
                      {field.label}
                    </span>
                    <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg border" style={{ borderColor: themeUtils.getBorderColor(), backgroundColor: themeUtils.getBgColor("input") }}>
                      {(field.options || []).map((item, itemIdx) => (
                        <button
                          key={itemIdx}
                          type="button"
                          onClick={() => onChange && onChange(field.key, item)}
                          className={`py-1 text-[10px] font-bold rounded-md transition-all ${
                            (safeFilters[field.key] || field.defaultValue) === item
                              ? "bg-amber-500 text-white shadow"
                              : "text-gray-400 hover:text-gray-200"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Footer Status */}
          <div className="mt-4 pt-3 border-t text-[10px] text-center opacity-65 font-medium flex items-center justify-between" style={{ borderColor: themeUtils.getBorderColor(), color: themeUtils.getTextColor(false) }}>
            {totalItems !== undefined && (
              <span>Found: <b style={{ color: themeUtils.getTextColor(true) }}>{totalItems}</b> items</span>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[9px] uppercase font-bold rounded shadow transition-all duration-200 ml-auto border-none cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
