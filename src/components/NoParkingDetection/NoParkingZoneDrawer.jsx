import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Check,
  X,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Layers,
} from 'lucide-react';

/**
 * Generate a consistent storage key per camera
 */
const getCameraKey = (cam) => {
  if (!cam) return 'default';
  return String(cam.camera_id || cam.id || cam.value || cam.camera_code || cam.name || 'default');
};

/**
 * Robust normalizer for saved data format:
 * Supports:
 * - { boxes: [ { id, x, y, width, height }, ... ] }
 * - [ { id, x, y, width, height }, ... ]
 * - Single box: { x, y, width, height }
 * - Legacy polygon points: [ { x, y }, ... ]
 */
const normalizeSavedBoxes = (savedData) => {
  if (!savedData) return [];
  try {
    let parsed = typeof savedData === 'string' ? JSON.parse(savedData) : savedData;
    if (!parsed) return [];

    // Format 1: { boxes: [...] }
    if (Array.isArray(parsed.boxes)) {
      return parsed.boxes
        .filter((b) => b && typeof b.x === 'number' && typeof b.width === 'number')
        .map((b, idx) => ({
          id: b.id || `box_${Date.now()}_${idx}`,
          x: Math.max(0, Math.min(1, b.x)),
          y: Math.max(0, Math.min(1, b.y)),
          width: Math.max(0.01, Math.min(1 - b.x, b.width)),
          height: Math.max(0.01, Math.min(1 - b.y, b.height)),
        }));
    }

    // Format 2: Array of items
    if (Array.isArray(parsed)) {
      // Check if it's an array of box objects { x, y, width, height }
      if (parsed.length > 0 && typeof parsed[0].width === 'number') {
        return parsed.map((b, idx) => ({
          id: b.id || `box_${Date.now()}_${idx}`,
          x: Math.max(0, Math.min(1, b.x)),
          y: Math.max(0, Math.min(1, b.y)),
          width: Math.max(0.01, Math.min(1 - b.x, b.width)),
          height: Math.max(0.01, Math.min(1 - b.y, b.height)),
        }));
      }

      // Check if it's a polygon array of vertices [{ x, y }, ...]
      if (parsed.length >= 3 && typeof parsed[0].x === 'number') {
        const xs = parsed.map((p) => p.x);
        const ys = parsed.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return [
          {
            id: `box_${Date.now()}_0`,
            x: Math.max(0, minX),
            y: Math.max(0, minY),
            width: Math.min(1 - minX, maxX - minX),
            height: Math.min(1 - minY, maxY - minY),
          },
        ];
      }
    }

    // Format 3: Single box object { x, y, width, height }
    if (typeof parsed.x === 'number' && typeof parsed.width === 'number') {
      return [
        {
          id: parsed.id || `box_${Date.now()}_0`,
          x: Math.max(0, Math.min(1, parsed.x)),
          y: Math.max(0, Math.min(1, parsed.y)),
          width: Math.max(0.01, Math.min(1 - parsed.x, parsed.width)),
          height: Math.max(0.01, Math.min(1 - parsed.y, parsed.height)),
        },
      ];
    }
  } catch (err) {
    console.warn('Error parsing saved boxes:', err);
  }
  return [];
};

/**
 * Convert a box to 4 corner polygon points for CV backend
 */
const getBoxPolygonPoints = (b) => {
  if (!b) return [];
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height },
  ];
};

/**
 * NoParkingZoneDrawer Component
 * Multi-box Paint-style drawing, individual box selection, resizing (width & height),
 * drag repositioning, and individual box removal.
 */
export default function NoParkingZoneDrawer({
  imgRef,
  selectedCamera,
  onZoneChange,
  sendMessage,
  toast,
  isEditing,
  setIsEditing,
  isMaximized = false,
  streamId,
  pythonApiUrl,
  videoResolution = { width: 1280, height: 720 },
  zoneConfigured,
  serverZone,
  onZoneConfiguredChange,
}) {
  const [showZone, setShowZone] = useState(true);
  const [boxes, setBoxes] = useState([]); // Array of { id, x, y, width, height }
  const [savedBoxes, setSavedBoxes] = useState([]);
  const [selectedBoxId, setSelectedBoxId] = useState(null);

  // Dragging / Resizing interaction state
  // mode: null | 'drawing' | 'moving' | 'resizing'
  const [interactionState, setInteractionState] = useState(null);
  const [hoveredHandle, setHoveredHandle] = useState(null);

  const svgRef = useRef(null);
  const camKey = getCameraKey(selectedCamera);

  // Load saved boxes for the current camera
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`no_parking_zone_${camKey}`);
      if (saved) {
        const parsedBoxes = normalizeSavedBoxes(saved);
        setBoxes(parsedBoxes);
        setSavedBoxes(parsedBoxes);
        if (parsedBoxes.length > 0) {
          setSelectedBoxId(parsedBoxes[0].id);
        } else {
          setSelectedBoxId(null);
        }
        if (onZoneChange) {
          onZoneChange({
            boxes: parsedBoxes,
            points: parsedBoxes.flatMap(getBoxPolygonPoints),
          });
        }
        return;
      }
    } catch (e) {
      console.warn('Failed to load saved box from localStorage:', e);
    }
    setBoxes([]);
    setSavedBoxes([]);
    setSelectedBoxId(null);
    if (onZoneChange) onZoneChange(null);
  }, [camKey]);

  // Load zone from Python backend: GET /zone/{stream_id}
  useEffect(() => {
    if (!streamId || !pythonApiUrl) return;
    let isMounted = true;

    fetch(`${pythonApiUrl}/zone/${streamId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data && data.zone_configured && Array.isArray(data.zone) && data.zone.length === 4) {
          const [x1, y1, x2, y2] = data.zone;
          const img = imgRef?.current || document.getElementById('video');
          const realW = (img && img.naturalWidth > 0) ? img.naturalWidth : (videoResolution?.width || 1920);
          const realH = (img && img.naturalHeight > 0) ? img.naturalHeight : (videoResolution?.height || 1080);
          const minX = Math.min(x1, x2);
          const maxX = Math.max(x1, x2);
          const minY = Math.min(y1, y2);
          const maxY = Math.max(y1, y2);

          const newBox = {
            id: `box_server_${Date.now()}`,
            x: Math.max(0, Math.min(1, minX / realW)),
            y: Math.max(0, Math.min(1, minY / realH)),
            width: Math.max(0.02, Math.min(1 - minX / realW, (maxX - minX) / realW)),
            height: Math.max(0.02, Math.min(1 - minY / realH, (maxY - minY) / realH)),
          };

          setBoxes([newBox]);
          setSavedBoxes([newBox]);
          setSelectedBoxId(newBox.id);

          if (onZoneConfiguredChange) onZoneConfiguredChange(true, data.zone);
          if (onZoneChange) {
            onZoneChange({
              boxes: [newBox],
              points: getBoxPolygonPoints(newBox),
              x: newBox.x,
              y: newBox.y,
              width: newBox.width,
              height: newBox.height,
            });
          }
        } else if (data && data.zone_configured === false) {
          if (onZoneConfiguredChange) onZoneConfiguredChange(false, null);
        }
      })
      .catch((err) => {
        console.warn('[NoParkingZoneDrawer] GET /zone error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [streamId, pythonApiUrl, videoResolution?.width, videoResolution?.height]);

  // Sync serverZone from WS message if local boxes are empty
  useEffect(() => {
    if (Array.isArray(serverZone) && serverZone.length === 4 && boxes.length === 0) {
      const [x1, y1, x2, y2] = serverZone;
      const img = imgRef?.current || document.getElementById('video');
      const realW = (img && img.naturalWidth > 0) ? img.naturalWidth : (videoResolution?.width || 1920);
      const realH = (img && img.naturalHeight > 0) ? img.naturalHeight : (videoResolution?.height || 1080);
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      const newBox = {
        id: `box_ws_${Date.now()}`,
        x: Math.max(0, Math.min(1, minX / realW)),
        y: Math.max(0, Math.min(1, minY / realH)),
        width: Math.max(0.02, Math.min(1 - minX / realW, (maxX - minX) / realW)),
        height: Math.max(0.02, Math.min(1 - minY / realH, (maxY - minY) / realH)),
      };
      setBoxes([newBox]);
      setSavedBoxes([newBox]);
      setSelectedBoxId(newBox.id);
    }
  }, [serverZone]);

  // Sync savedBoxes when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setShowZone(true);
      const cloned = savedBoxes.map((b) => ({ ...b }));
      setBoxes(cloned);
      if (cloned.length > 0) {
        setSelectedBoxId(cloned[cloned.length - 1].id);
      } else {
        setSelectedBoxId(null);
      }
    } else {
      setInteractionState(null);
    }
  }, [isEditing]);

  // Helper to get normalized (0..1) pointer coordinates relative to the <img>
  const getNormCoords = (e) => {
    const targetEl = imgRef?.current || document.getElementById('video') || svgRef?.current;
    if (!targetEl) return { x: 0, y: 0 };
    const r = targetEl.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { x: 0, y: 0 };
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    return { x, y };
  };

  // 1. POINTER DOWN (Canvas empty area -> Draw brand new box)
  const handleCanvasPointerDown = (e) => {
    if (!isEditing || !isMaximized) return;
    if (e.button !== 0) return; // Only primary mouse button

    const coords = getNormCoords(e);
    const newId = `box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newBox = {
      id: newId,
      x: coords.x,
      y: coords.y,
      width: 0.001,
      height: 0.001,
    };

    setBoxes((prev) => [...prev, newBox]);
    setSelectedBoxId(newId);
    setInteractionState({
      mode: 'drawing',
      boxId: newId,
      startX: coords.x,
      startY: coords.y,
    });

    if (e.target && e.target.setPointerCapture) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // 2. POINTER DOWN ON AN EXISTING BOX (Select & Move)
  const handleBoxPointerDown = (boxItem, e) => {
    if (!isEditing || !isMaximized) return;
    e.stopPropagation();
    if (e.button !== 0) return;

    const coords = getNormCoords(e);
    setSelectedBoxId(boxItem.id);
    setInteractionState({
      mode: 'moving',
      boxId: boxItem.id,
      dragStartX: coords.x,
      dragStartY: coords.y,
      initialBox: { ...boxItem },
    });

    if (e.target && e.target.setPointerCapture) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // 3. POINTER DOWN ON RESIZE HANDLE (Resize width and/or height)
  const handleHandlePointerDown = (handleKey, e) => {
    if (!isEditing || !isMaximized) return;
    e.stopPropagation();
    if (e.button !== 0) return;

    const targetBox = boxes.find((b) => b.id === selectedBoxId);
    if (!targetBox) return;

    const coords = getNormCoords(e);
    setInteractionState({
      mode: 'resizing',
      boxId: selectedBoxId,
      handle: handleKey,
      startX: coords.x,
      startY: coords.y,
      initialBox: { ...targetBox },
    });

    if (e.target && e.target.setPointerCapture) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // 4. GLOBAL POINTER MOVE (Handling drawing, moving, resizing)
  const handlePointerMove = (e) => {
    if (!isEditing || !isMaximized || !interactionState) return;

    const coords = getNormCoords(e);
    const { mode, boxId } = interactionState;

    if (mode === 'drawing') {
      const { startX, startY } = interactionState;
      const x = Math.min(startX, coords.x);
      const y = Math.min(startY, coords.y);
      const width = Math.abs(coords.x - startX);
      const height = Math.abs(coords.y - startY);

      setBoxes((prev) =>
        prev.map((b) =>
          b.id === boxId
            ? {
                ...b,
                x: Number(x.toFixed(4)),
                y: Number(y.toFixed(4)),
                width: Number(Math.max(0.005, width).toFixed(4)),
                height: Number(Math.max(0.005, height).toFixed(4)),
              }
            : b
        )
      );
    } else if (mode === 'moving') {
      const { dragStartX, dragStartY, initialBox } = interactionState;
      const dx = coords.x - dragStartX;
      const dy = coords.y - dragStartY;

      const maxX = 1 - initialBox.width;
      const maxY = 1 - initialBox.height;

      const newX = Math.max(0, Math.min(maxX, initialBox.x + dx));
      const newY = Math.max(0, Math.min(maxY, initialBox.y + dy));

      setBoxes((prev) =>
        prev.map((b) =>
          b.id === boxId
            ? {
                ...b,
                x: Number(newX.toFixed(4)),
                y: Number(newY.toFixed(4)),
              }
            : b
        )
      );
    } else if (mode === 'resizing') {
      const { handle, initialBox } = interactionState;
      let left = initialBox.x;
      let top = initialBox.y;
      let right = initialBox.x + initialBox.width;
      let bottom = initialBox.y + initialBox.height;

      const minDim = 0.02; // minimum 2% size

      if (handle.includes('w')) {
        left = Math.min(coords.x, right - minDim);
      }
      if (handle.includes('e')) {
        right = Math.max(coords.x, left + minDim);
      }
      if (handle.includes('n')) {
        top = Math.min(coords.y, bottom - minDim);
      }
      if (handle.includes('s')) {
        bottom = Math.max(coords.y, top + minDim);
      }

      setBoxes((prev) =>
        prev.map((b) =>
          b.id === boxId
            ? {
                ...b,
                x: Number(Math.max(0, left).toFixed(4)),
                y: Number(Math.max(0, top).toFixed(4)),
                width: Number(Math.min(1 - left, right - left).toFixed(4)),
                height: Number(Math.min(1 - top, bottom - top).toFixed(4)),
              }
            : b
        )
      );
    }
  };

  // Centralized function to compute real frame zone coordinates and send to backend
  const sendZoneToServer = useCallback((boxToSave) => {
    if (!boxToSave || boxToSave.width < 0.01 || boxToSave.height < 0.01) return;

    const img = imgRef?.current || document.getElementById('video');
    const r = img ? img.getBoundingClientRect() : (svgRef.current ? svgRef.current.getBoundingClientRect() : null);

    // Real video frame resolution — read live from naturalWidth/naturalHeight (matches raw frame pixels)
    const realW = (img && img.naturalWidth > 0) ? img.naturalWidth : (videoResolution?.width || 1920);
    const realH = (img && img.naturalHeight > 0) ? img.naturalHeight : (videoResolution?.height || 1080);

    // Displayed size on screen
    const dispW = r && r.width > 0 ? r.width : 1;
    const dispH = r && r.height > 0 ? r.height : 1;

    // Scale factor
    const sx = realW / dispW;
    const sy = realH / dispH;

    // Mouse coordinates relative to the <img>
    const startX = boxToSave.x * dispW;
    const startY = boxToSave.y * dispH;
    const endX = (boxToSave.x + boxToSave.width) * dispW;
    const endY = (boxToSave.y + boxToSave.height) * dispH;

    // Normalize (so x1 < x2 and y1 < y2) + scale
    let x1 = Math.round(Math.min(startX, endX) * sx);
    let y1 = Math.round(Math.min(startY, endY) * sy);
    let x2 = Math.round(Math.max(startX, endX) * sx);
    let y2 = Math.round(Math.max(startY, endY) * sy);

    // Ensure strict x2 > x1 and y2 > y1 and within frame boundaries
    if (x2 <= x1) x2 = Math.min(realW, x1 + 10);
    if (y2 <= y1) y2 = Math.min(realH, y1 + 10);
    x1 = Math.max(0, Math.min(realW - 2, x1));
    y1 = Math.max(0, Math.min(realH - 2, y1));

    const zoneCoords = [x1, y1, x2, y2];
    console.log('Sending zone:', zoneCoords, `(frame: ${realW} x ${realH})`);

    // 1. Send set_zone via WebSocket (instant, no reconnect)
    if (sendMessage) {
      sendMessage({
        action: 'set_zone',
        zone: zoneCoords,
      });
    }

    // 2. POST /zone/{stream_id}?zone=x1,y1,x2,y2 (REST)
    if (streamId && pythonApiUrl) {
      fetch(`${pythonApiUrl}/zone/${streamId}?zone=${x1},${y1},${x2},${y2}`, {
        method: 'POST',
      })
        .then((res) => res.json())
        .then((data) => {
          console.log('[NoParkingZoneDrawer] POST /zone response:', data);
          if (onZoneConfiguredChange) onZoneConfiguredChange(true, zoneCoords);
        })
        .catch((err) => {
          console.error('[NoParkingZoneDrawer] POST /zone error:', err);
        });
    }
  }, [imgRef, videoResolution, sendMessage, streamId, pythonApiUrl, onZoneConfiguredChange]);

  // 5. GLOBAL POINTER UP
  const handlePointerUp = (e) => {
    if (!isEditing || !isMaximized || !interactionState) return;

    if (interactionState.mode === 'drawing') {
      const { boxId } = interactionState;
      setBoxes((prev) => {
        const target = prev.find((b) => b.id === boxId);
        // If user just tapped without dragging, remove micro box
        if (target && (target.width < 0.02 || target.height < 0.02)) {
          const filtered = prev.filter((b) => b.id !== boxId);
          setSelectedBoxId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
          return filtered;
        }
        if (target) {
          sendZoneToServer(target);
        }
        return prev;
      });
    }

    setInteractionState(null);
    if (e.target && e.target.releasePointerCapture) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // REMOVE A PARTICULAR BOX
  const handleRemoveBox = (boxIdToRemove, e) => {
    if (e) e.stopPropagation();
    setBoxes((prev) => {
      const updated = prev.filter((b) => b.id !== boxIdToRemove);
      if (selectedBoxId === boxIdToRemove) {
        setSelectedBoxId(updated.length > 0 ? updated[updated.length - 1].id : null);
      }
      return updated;
    });

    if (toast?.info) {
      toast.info('Box Removed', 'Selected No Parking box removed.');
    }
  };

  // ADD A NEW PRESET BOX
  const handleAddBox = (e) => {
    if (e) e.stopPropagation();
    const count = boxes.length;
    // Stagger position slightly based on existing box count
    const offset = (count * 0.05) % 0.25;
    const newId = `box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newBox = {
      id: newId,
      x: Number((0.25 + offset).toFixed(4)),
      y: Number((0.25 + offset).toFixed(4)),
      width: 0.40,
      height: 0.35,
    };

    setBoxes((prev) => [...prev, newBox]);
    setSelectedBoxId(newId);

    if (toast?.success) {
      toast.success('Box Added', `New box added (Box #${count + 1}). Drag or resize as needed.`);
    }
  };

  // CLEAR ALL BOXES
  const handleClearAll = (e) => {
    if (e) e.stopPropagation();
    setBoxes([]);
    setSelectedBoxId(null);

    // 1. Send clear_zone via WebSocket (instant, no reconnect)
    if (sendMessage) {
      sendMessage({ action: 'clear_zone' });
    }

    // 2. DELETE /zone/{stream_id} (REST)
    if (streamId && pythonApiUrl) {
      fetch(`${pythonApiUrl}/zone/${streamId}`, {
        method: 'DELETE',
      })
        .then((res) => res.json())
        .then((data) => {
          console.log('[NoParkingZoneDrawer] DELETE /zone on clear all:', data);
          if (onZoneConfiguredChange) onZoneConfiguredChange(false, null);
        })
        .catch((err) => {
          console.warn('[NoParkingZoneDrawer] DELETE /zone error on clear all:', err);
        });
    }
  };

  // CANCEL EDIT
  const handleCancel = (e) => {
    if (e) e.stopPropagation();
    const cloned = savedBoxes.map((b) => ({ ...b }));
    setBoxes(cloned);
    setSelectedBoxId(cloned.length > 0 ? cloned[0].id : null);
    setIsEditing(false);
    setInteractionState(null);
  };

  // SAVE ALL BOXES
  const handleSave = (e) => {
    if (e) e.stopPropagation();

    // Filter valid boxes (at least 2% dimension)
    const validBoxes = boxes.filter(
      (b) => b && b.width >= 0.02 && b.height >= 0.02
    );

    try {
      const dataToSave =
        validBoxes.length > 0
          ? {
              boxes: validBoxes.map((b) => ({
                ...b,
                points: getBoxPolygonPoints(b),
              })),
              points: validBoxes.flatMap(getBoxPolygonPoints),
              // Backward-compatibility props for single-box readers
              x: validBoxes[0]?.x,
              y: validBoxes[0]?.y,
              width: validBoxes[0]?.width,
              height: validBoxes[0]?.height,
            }
          : null;

      if (dataToSave) {
        localStorage.setItem(`no_parking_zone_${camKey}`, JSON.stringify(dataToSave));
      } else {
        localStorage.removeItem(`no_parking_zone_${camKey}`);
      }

      setBoxes(validBoxes);
      setSavedBoxes(validBoxes);
      setSelectedBoxId(validBoxes.length > 0 ? validBoxes[validBoxes.length - 1].id : null);
      setIsEditing(false);
      setInteractionState(null);

      // Broadcast update event
      window.dispatchEvent(
        new CustomEvent('no_parking_zone_saved', {
          detail: {
            camera_id: camKey,
            boxes: validBoxes,
            zone_boxes: validBoxes,
            box: validBoxes[0] || null,
            points: validBoxes.flatMap(getBoxPolygonPoints),
          },
        })
      );

      // Send legacy event if needed
      if (sendMessage) {
        sendMessage({
          action: 'set_roi',
          type: 'SET_NO_PARKING_ZONE',
          camera_id: camKey,
          zone_boxes: validBoxes,
          zone_box: validBoxes[0] || null,
          zone_points: validBoxes.flatMap(getBoxPolygonPoints),
        });
      }

      // Convert coordinates to original frame resolution: [x1, y1, x2, y2] and send
      if (validBoxes.length > 0) {
        sendZoneToServer(validBoxes[0]);
      } else {
        // Clear zone via WebSocket (instant, no reconnect)
        if (sendMessage) {
          sendMessage({ action: 'clear_zone' });
        }

        // 3. DELETE /zone/{stream_id} (REST)
        if (streamId && pythonApiUrl) {
          fetch(`${pythonApiUrl}/zone/${streamId}`, {
            method: 'DELETE',
          })
            .then((res) => res.json())
            .then((data) => {
              console.log('[NoParkingZoneDrawer] DELETE /zone response:', data);
              if (onZoneConfiguredChange) onZoneConfiguredChange(false, null);
            })
            .catch((err) => {
              console.error('[NoParkingZoneDrawer] DELETE /zone error:', err);
            });
        }
      }

      if (onZoneChange) onZoneChange(dataToSave);

      if (toast?.success) {
        toast.success(
          'No Parking Zones Saved',
          validBoxes.length > 0
            ? `${validBoxes.length} box zone${validBoxes.length > 1 ? 's' : ''} saved for ${
                selectedCamera?.label || selectedCamera?.name || 'this camera'
              }.`
            : 'No Parking Zone cleared for this camera.'
        );
      }
    } catch (err) {
      console.error('Failed to save box zones:', err);
      if (toast?.error) toast.error('Save Error', 'Could not save zones to storage.');
    }
  };

  // Active display boxes
  const currentBoxes = isEditing ? boxes : savedBoxes;
  const hasBoxes = currentBoxes.length > 0;
  const selectedBox = isEditing ? boxes.find((b) => b.id === selectedBoxId) : null;
  const selectedBoxIndex = selectedBox ? boxes.findIndex((b) => b.id === selectedBoxId) : -1;

  // Selected box SVG coordinates for handles (0..1000)
  const selSvgX = selectedBox ? selectedBox.x * 1000 : 0;
  const selSvgY = selectedBox ? selectedBox.y * 1000 : 0;
  const selSvgW = selectedBox ? selectedBox.width * 1000 : 0;
  const selSvgH = selectedBox ? selectedBox.height * 1000 : 0;

  // 8 Resize handles for currently selected box
  const resizeHandles =
    selectedBox && isEditing
      ? [
          { key: 'nw', cx: selSvgX, cy: selSvgY, cursor: 'nwse-resize' },
          { key: 'ne', cx: selSvgX + selSvgW, cy: selSvgY, cursor: 'nesw-resize' },
          { key: 'se', cx: selSvgX + selSvgW, cy: selSvgY + selSvgH, cursor: 'nwse-resize' },
          { key: 'sw', cx: selSvgX, cy: selSvgY + selSvgH, cursor: 'nesw-resize' },
          { key: 'n', cx: selSvgX + selSvgW / 2, cy: selSvgY, cursor: 'ns-resize' },
          { key: 's', cx: selSvgX + selSvgW / 2, cy: selSvgY + selSvgH, cursor: 'ns-resize' },
          { key: 'w', cx: selSvgX, cy: selSvgY + selSvgH / 2, cursor: 'ew-resize' },
          { key: 'e', cx: selSvgX + selSvgW, cy: selSvgY + selSvgH / 2, cursor: 'ew-resize' },
        ]
      : [];

  return (
    <>
      {/* =========================================================================
          1. FLOATING TOOLBAR IN EDITING MODE (Only shown when maximized)
         ========================================================================= */}
      {isEditing && isMaximized && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 pointer-events-auto bg-black/90 text-white px-3.5 py-1.5 rounded-xl border border-amber-500/50 shadow-2xl backdrop-blur-md flex items-center gap-2 max-w-[98%] flex-nowrap whitespace-nowrap overflow-x-auto no-scrollbar animate-in fade-in zoom-in-95 duration-200">
          {/* Instructions */}
          <span className="text-[11px] text-gray-300 mr-1 hidden md:inline shrink-0">
            {boxes.length === 0
              ? 'Click & drag on video or "+ Add Box"'
              : selectedBox
              ? `Box #${selectedBoxIndex + 1} selected: Drag to move • Handles to resize`
              : 'Click any box to select, move, resize or remove'}
          </span>

          {/* Add Box */}
          <button
            type="button"
            onClick={handleAddBox}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
            title="Add another No Parking box"
          >
            <Plus size={13} />
            <span>Add Box</span>
          </button>

          {/* Remove Selected Box */}
          {selectedBox && (
            <button
              type="button"
              onClick={(e) => handleRemoveBox(selectedBoxId, e)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow-md transition-all cursor-pointer active:scale-95 animate-in fade-in shrink-0 whitespace-nowrap"
              title={`Remove Box #${selectedBoxIndex + 1}`}
            >
              <Trash2 size={12} />
              <span>Remove Box #{selectedBoxIndex + 1}</span>
            </button>
          )}

          {/* Clear All */}
          {boxes.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-semibold bg-gray-800 hover:bg-red-950/60 text-gray-300 hover:text-red-300 border border-gray-700 transition-all cursor-pointer shrink-0 whitespace-nowrap"
              title="Clear all boxes"
            >
              <Trash2 size={11} />
              <span>Clear All</span>
            </button>
          )}

          {/* Cancel */}
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-500 transition-all cursor-pointer shrink-0 whitespace-nowrap"
            title="Cancel edits"
          >
            <X size={12} />
            <span>Cancel</span>
          </button>

          {/* Save All */}
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/40 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
            title="Save and activate all No Parking boxes"
          >
            <Check size={14} />
            <span>Save ({boxes.length} {boxes.length === 1 ? 'Box' : 'Boxes'})</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          2. TOGGLE ZONE VISIBILITY BADGE (Only shown when maximized and not editing)
         ========================================================================= */}
      {!isEditing && hasBoxes && isMaximized && (
        <div className="absolute top-12 left-3 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowZone((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-md border transition-all cursor-pointer shadow-md ${
              showZone
                ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                : 'bg-black/60 text-gray-300 border-white/10 hover:bg-black/80'
            }`}
            title={showZone ? 'Hide No Parking Zones' : 'Show No Parking Zones'}
          >
            {showZone ? <Eye size={12} className="text-red-400" /> : <EyeOff size={12} />}
            <span>
              {showZone
                ? `${savedBoxes.length} Zone${savedBoxes.length > 1 ? 's' : ''} Active`
                : 'Zones Hidden'}
            </span>
          </button>
        </div>
      )}

      {/* =========================================================================
          3. INTERACTIVE SVG OVERLAY CANVAS
         ========================================================================= */}
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`absolute inset-0 w-full h-full z-15 ${
          isEditing && isMaximized ? 'cursor-crosshair pointer-events-auto select-none' : 'pointer-events-none'
        }`}
        style={{
          outline: isEditing && isMaximized ? '2px dashed rgba(245, 158, 11, 0.65)' : 'none',
          outlineOffset: '-2px',
        }}
      >
        {/* Render ALL Boxes - Plain red borders */}
        {(showZone || isEditing) &&
          currentBoxes.map((b, idx) => {
            const isSel = isEditing && isMaximized && b.id === selectedBoxId;
            const bx = b.x * 1000;
            const by = b.y * 1000;
            const bw = b.width * 1000;
            const bh = b.height * 1000;

            if (bw <= 5 || bh <= 5) return null;

            return (
              <g key={b.id || idx}>
                {/* Plain Box with Red Border */}
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  fill={isSel ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)'}
                  stroke="#ef4444"
                  strokeWidth={isSel ? '3.5' : '2.5'}
                  onPointerDown={(e) => handleBoxPointerDown(b, e)}
                  className={
                    isEditing && isMaximized
                      ? 'cursor-move pointer-events-auto'
                      : 'pointer-events-none'
                  }
                />

                {/* Subtle Zone Number Tag in Top-Left (Plain & clean) */}
                {(isEditing || currentBoxes.length > 1) && (
                  <g className="pointer-events-none">
                    <rect
                      x={bx + 3}
                      y={by + 3}
                      width={currentBoxes.length > 9 ? 65 : 55}
                      height="20"
                      rx="3"
                      fill={isSel ? '#ef4444' : 'rgba(0, 0, 0, 0.7)'}
                      stroke={isSel ? '#ffffff' : '#ef4444'}
                      strokeWidth="1"
                    />
                    <text
                      x={bx + 8}
                      y={by + 17}
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      fontFamily="system-ui, sans-serif"
                    >
                      Zone #{idx + 1}
                    </text>
                  </g>
                )}

                {/* Direct 'X' (Remove Box) Icon Button on Top-Right Corner of the Selected Box */}
                {isSel && (
                  <g
                    className="pointer-events-auto cursor-pointer"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleRemoveBox(b.id, e);
                    }}
                  >
                    {/* Hit area & badge */}
                    <rect
                      x={bx + bw - 24}
                      y={by - 12}
                      width="24"
                      height="24"
                      rx="6"
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="transition-all hover:fill-red-700 shadow-lg"
                    />
                    {/* White 'X' icon */}
                    <line
                      x1={bx + bw - 18}
                      y1={by - 6}
                      x2={bx + bw - 6}
                      y2={by + 6}
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <line
                      x1={bx + bw - 6}
                      y1={by - 6}
                      x2={bx + bw - 18}
                      y2={by + 6}
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>
            );
          })}

        {/* 8 Resize Handles on the Currently Selected Box (To increase/decrease height & width) */}
        {isEditing &&
          isMaximized &&
          selectedBox &&
          resizeHandles.map((h) => (
            <g
              key={h.key}
              className="pointer-events-auto"
              style={{ cursor: h.cursor }}
              onPointerDown={(e) => handleHandlePointerDown(h.key, e)}
              onMouseEnter={() => setHoveredHandle(h.key)}
              onMouseLeave={() => setHoveredHandle(null)}
            >
              {/* Invisible Larger Hit Area */}
              <circle cx={h.cx} cy={h.cy} r="18" fill="transparent" />

              {/* Outer glow ring */}
              <circle
                cx={h.cx}
                cy={h.cy}
                r={hoveredHandle === h.key ? '11' : '8'}
                fill="rgba(245, 158, 11, 0.4)"
                className="transition-all duration-150"
              />

              {/* Square Resize Handle */}
              <rect
                x={h.cx - 5.5}
                y={h.cy - 5.5}
                width="11"
                height="11"
                fill="#ffffff"
                stroke="#f59e0b"
                strokeWidth="2"
                className="transition-all duration-150 shadow-md"
              />
            </g>
          ))}
      </svg>
    </>
  );
}

