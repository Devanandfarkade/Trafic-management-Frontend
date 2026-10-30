import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../config.js';

export default function useCameraFilter(moduleName = null, categoryId = null) {
  const [allCameras, setAllCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  // Available dropdown options from backend
  const [availableZones, setAvailableZones] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);

  // Filter States (storing IDs)
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 1. Fetch Zones on mount
  useEffect(() => {
    if (!API_BASE_URL) return;
    fetch(`${API_BASE_URL}/api/locations/zones`)
      .then(res => res.json())
      .then(data => setAvailableZones(data.zones || []))
      .catch(err => console.error("Error fetching zones:", err));
  }, [refreshTrigger]);

  // 2. Fetch Locations when Zone changes
  useEffect(() => {
    if (!API_BASE_URL) return;
    if (selectedZone) {
      fetch(`${API_BASE_URL}/api/locations/by-zone/${selectedZone}`)
        .then(res => res.json())
        .then(data => setAvailableLocations(data.locations || []))
        .catch(err => console.error("Error fetching locations:", err));
    } else {
      // If no zone is selected, fetch all locations
      fetch(`${API_BASE_URL}/api/locations`)
        .then(res => res.json())
        .then(data => setAvailableLocations(data.locations || []))
        .catch(err => console.error("Error fetching all locations:", err));
    }
  }, [selectedZone, refreshTrigger]);

  // 3. Fetch Cameras whenever filters change
  useEffect(() => {
    if (!API_BASE_URL) return;
    setLoading(true);

    const queryParams = new URLSearchParams();
    if (categoryId !== null && categoryId !== undefined) queryParams.append('category_id', categoryId);
    if (selectedZone) queryParams.append('zone_id', selectedZone);
    if (selectedLocation) queryParams.append('location_id', selectedLocation);

    let endpoint;
    if (categoryId !== null && categoryId !== undefined) {
      endpoint = `${API_BASE_URL}/api/cameras?${queryParams.toString()}`;
    } else if (moduleName) {
      endpoint = `${API_BASE_URL}/api/cameras/module/${moduleName}?${queryParams.toString()}`;
    } else {
      endpoint = `${API_BASE_URL}/api/cameras?${queryParams.toString()}`;
    }

    const processCameras = (cameras) => {
      const defaultWs = import.meta.env.VITE_DEFAULT_WS_URL || "ws://110.227.253.23:8081/live/ws";
      return cameras.map(c => {
        const activeFeature = c.features?.find(f => f.on_off_status);
        const resolvedWsUrl = activeFeature?.model_path || c.ws_url || defaultWs;

        return {
          id: c.camera_id || c.id,
          camera_id: c.camera_id || c.id,
          value: c.camera_code || String(c.camera_id || c.id),
          label: c.camera_name || c.name || c.camera_code,
          name: c.camera_name || c.name || c.camera_code,
          url: c.rtsp_url || c.rtsp,
          rtsp_url: c.rtsp_url || c.rtsp,
          location: c.locationid?.location || c.location?.location || c.location || '',
          category: c.category || '',
          subcategory: c.subcategory || '',
          module_type: c.module_type || '',
          ws_url: resolvedWsUrl,
          has_active_feature: c.has_active_feature ?? (c.features && c.features.length > 0 ? c.features.some(f => Boolean(f.on_off_status)) : false),
          features: c.features || [],
          latitude: c.locationid?.latitude ? parseFloat(c.locationid.latitude) : (c.latitude ? parseFloat(c.latitude) : null),
          longitude: c.locationid?.longitude ? parseFloat(c.locationid.longitude) : (c.longitude ? parseFloat(c.longitude) : null),
          location_id: c.locationid?.location_id || c.location_id || null,
          zone_id: c.zoneid?.zone_id || c.zone_id || null,
          zone_name: c.zone_name || c.zoneid?.name || c.zoneid?.zone || c.zone?.name || c.zone?.zone || c.zone || '',
        };
      });
    };

    fetch(endpoint)
      .then(res => res.json())
      .then(async data => {
        if (data.cameras && data.cameras.length > 0) {
          const formatted = processCameras(data.cameras);
          if (categoryId !== null && categoryId !== undefined) {
            formatted.sort((a, b) => {
              if (a.has_active_feature === b.has_active_feature) return 0;
              return a.has_active_feature ? -1 : 1;
            });
          }
          setAllCameras(formatted);
          setSelectedCameraId(prev => (prev && formatted.some(c => String(c.value) === String(prev) || String(c.id) === String(prev))) ? prev : '');
        } else {
          setAllCameras([]);
          setSelectedCameraId('');
        }
      })
      .catch(err => console.error("Error fetching cameras:", err))
      .finally(() => setLoading(false));

  }, [moduleName, categoryId, selectedZone, selectedLocation, refreshTrigger]);

  // Derived Filter Options
  const availableOptions = useMemo(() => {
    let filteredForCameras = allCameras;

    if (selectedCategory) {
      filteredForCameras = filteredForCameras.filter(c => c.category === selectedCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredForCameras = filteredForCameras.filter(c =>
        c.label?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.zone_name?.toLowerCase().includes(q) ||
        c.rtsp_url?.toLowerCase().includes(q)
      );
    }

    const uniqueCategories = [...new Set(allCameras.map(c => c.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const sortedLocations = [...availableLocations].sort((a, b) => (a.name || a.location || '').localeCompare(b.name || b.location || ''));
    const sortedZones = [...availableZones].sort((a, b) => (a.name || a.zone || '').localeCompare(b.name || b.zone || ''));

    return {
      zones: sortedZones,
      locations: sortedLocations,
      categories: uniqueCategories,
      cameras: filteredForCameras
    };
  }, [allCameras, availableZones, availableLocations, selectedCategory, searchQuery]);

  const handleZoneChange = (val) => {
    setSelectedZone(val);
    setSelectedLocation('');
    setSelectedCategory('');
  };

  const handleLocationChange = (val) => {
    setSelectedLocation(val);
    setSelectedCategory('');
  };

  const handleCategoryChange = (val) => {
    setSelectedCategory(val);
    const newCameras = allCameras.filter(c => !val || c.category === val);
    setSelectedCameraId(newCameras.length > 0 ? newCameras[0].value : '');
  };

  const clearFilters = () => {
    setSelectedZone('');
    setSelectedLocation('');
    setSelectedCategory('');
    setSearchQuery('');
    setSelectedCameraId('');
  };

  const refetch = () => {
    setRefreshTrigger(p => p + 1);
  };

  useEffect(() => {
    const handleUpdate = () => refetch();
    window.addEventListener('camera_settings_updated', handleUpdate);
    return () => window.removeEventListener('camera_settings_updated', handleUpdate);
  }, []);

  const selectedCamera = useMemo(() => {
    return allCameras.find(c => c.value === selectedCameraId) || (allCameras.length > 0 ? allCameras[0] : null);
  }, [allCameras, selectedCameraId]);

  return {
    loading,
    allCameras,
    availableOptions,
    filters: { zone: selectedZone, location: selectedLocation, category: selectedCategory, cameraId: selectedCameraId, searchQuery },
    actions: { setZone: handleZoneChange, setLocation: handleLocationChange, setCategory: handleCategoryChange, setCameraId: setSelectedCameraId, setSearchQuery, clearFilters },
    selectedCamera,
    refetch,
  };
}

