import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../Settings/themeUtils';
import { Camera, MapPin, Search, X, Building2 } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

export default function GlobalCameraFilter({
  cameraFilter,
  hideCamera = false,
  onCameraSelect,
  onLocationSelect,
  onClear,
  className = "",
  size = "sm"
}) {
  const { themeUtils } = useTheme();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);
  
  if (!cameraFilter) return null;

  const {
    availableOptions: { zones, locations, categories, cameras },
    filters: { zone, location, category, cameraId, searchQuery },
    actions: { setZone, setLocation, setCategory, setCameraId, setSearchQuery, clearFilters },
    allCameras = []
  } = cameraFilter;

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const borderColor = themeUtils.getBorderColor?.() || '#e5e7eb';
  const textColor = themeUtils.getTextColor(true);

  const selectClasses = "appearance-none bg-transparent outline-none cursor-pointer w-full pl-7 pr-3 text-xs font-medium truncate h-full flex items-center";
  const hasActiveFilters = Boolean(zone || location || category || cameraId || searchQuery);

  const handleClearAll = () => {
    clearFilters();
    if (onClear) onClear();
  };

  // Compute matching cameras for search autocomplete
  const matchingCameras = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const source = allCameras.length > 0 ? allCameras : (cameras || []);
    return source.filter(c =>
      (c.label && c.label.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q)) ||
      (c.value && String(c.value).toLowerCase().includes(q))
    ).slice(0, 8);
  }, [searchQuery, allCameras, cameras]);

  const handleSelectCamera = (cam) => {
    setCameraId(cam.value);
    setSearchQuery(cam.label || cam.name || '');
    setShowSuggestions(false);
    if (onCameraSelect) {
      onCameraSelect(cam.value, cam);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (matchingCameras.length > 0) {
        handleSelectCamera(matchingCameras[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className={`flex items-center gap-1 sm:gap-1.5 max-w-full ${className || 'flex-wrap justify-start sm:justify-end'}`}>
      
      {/* Search Filter with Auto-suggest & Fly-to-location */}
      <div ref={searchContainerRef} className="relative shrink-0">
        <div 
          className="relative flex items-center border rounded-lg transition-colors focus-within:ring-1 focus-within:ring-blue-500 bg-white dark:bg-[#111827]/90 w-[95px] sm:w-[105px] xl:w-[130px] h-[34px]" 
          style={{ borderColor }}
        >
          <Search size={12} className="absolute left-2 text-gray-400 pointer-events-none" />
          <input 
            type="text"
            value={searchQuery || ''}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              if (searchQuery && searchQuery.trim()) setShowSuggestions(true);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
            className="appearance-none bg-transparent outline-none w-full pl-6 pr-6 text-xs font-medium placeholder-gray-400 h-full"
            style={{ color: textColor }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowSuggestions(false);
                if (onClear) onClear();
              }}
              className="absolute right-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-0.5 rounded cursor-pointer"
              title="Clear search query"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && matchingCameras.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-[240px] sm:w-[280px] max-h-[260px] overflow-y-auto hide-scrollbar bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-blue-900/60 rounded-xl shadow-2xl z-[9999] p-1.5 flex flex-col gap-1 backdrop-blur-lg">
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 px-2 py-1 uppercase tracking-wider flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <span>Matching Cameras</span>
              <span className="text-[9px] lowercase font-normal">press enter to select</span>
            </div>
            {matchingCameras.map((cam) => (
              <div
                key={cam.value}
                onClick={() => handleSelectCamera(cam)}
                className="px-2.5 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left transition-colors cursor-pointer flex items-center justify-between gap-2 group border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <Camera size={12} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-500 transition-colors">
                      {cam.label || cam.name}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                      <MapPin size={9} /> {cam.location || 'Unknown Location'}
                    </span>
                  </div>
                </div>
                {cam.category && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold shrink-0">
                    {cam.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zone Filter */}
      <SearchableSelect
        name="zone"
        value={zone || ""}
        onChange={(e) => setZone(e.target.value)}
        options={(zones || []).map(z => ({ id: z.id, name: z.name }))}
        placeholder="All Zones"
        icon={<Building2 size={12} />}
        size={size}
        className="shrink-0 w-[92px] sm:w-[100px] xl:w-[115px]"
      />

      {/* Location Filter */}
      <SearchableSelect
        name="location"
        value={location || ""}
        onChange={(e) => {
          setLocation(e.target.value);
          if (onLocationSelect) onLocationSelect(e.target.value);
        }}
        options={(locations || []).map(loc => ({ id: loc.id, name: loc.name }))}
        placeholder="All Locations"
        icon={<MapPin size={12} />}
        size={size}
        className="shrink-0 w-[96px] sm:w-[105px] xl:w-[120px]"
      />

      {/* Camera Filter */}
      {!hideCamera && (
        <SearchableSelect
          name="camera"
          value={cameraId || ""}
          onChange={(e) => {
            setCameraId(e.target.value);
            if (onCameraSelect) onCameraSelect(e.target.value);
          }}
          options={(cameras || []).map(cam => ({ id: cam.value, name: cam.label }))}
          placeholder={cameras.length === 0 ? "No Cameras Found" : "All Cameras"}
          icon={<Camera size={12} />}
          disabled={cameras.length === 0}
          size={size}
          className="shrink-0 w-[98px] sm:w-[108px] xl:w-[125px]"
        />
      )}

      {/* Reset Filters Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearAll}
          className="flex items-center gap-1 px-2 h-[34px] text-[11px] font-bold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/30 transition-colors shrink-0 cursor-pointer"
          title="Reset all filters"
        >
          <X size={12} />
          <span>Reset</span>
        </button>
      )}

    </div>
  );
}
