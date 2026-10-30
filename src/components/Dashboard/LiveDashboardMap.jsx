import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2, Minimize2, Camera, X } from 'lucide-react';
import { API_CONFIG, API_BASE_URL } from '../../../config.js';

/* ============================================================
 * ICON FACTORIES
 * ============================================================ */

/** Blue/red dot for a camera cluster */
const createClusterIcon = (count) => {
  const color = '#3b82f6';
  const glow = '0 0 12px #3b82f6, 0 0 5px #3b82f6';
  const pulse = '';
  const size = count > 1 ? 22 : 16;
  const badge = count > 1
    ? `<span style="
        position:absolute;top:-5px;right:-5px;
        background:#fff;color:${color};
        font-size:9px;font-weight:900;
        width:14px;height:14px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 4px rgba(0,0,0,.3);line-height:1;
      ">${count}</span>`
    : '';

  const html = `
    <div style="position:relative;display:inline-block;">
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};box-shadow:${glow};
        border:2.5px solid white;cursor:pointer;${pulse}
      "></div>
      ${badge}
    </div>
  `;
  return new L.DivIcon({
    html,
    className: 'custom-camera-dot',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
};

/** Red dot icon for an active incident (blinking when active, solid when acknowledged) */
const createIncidentIcon = (isAcknowledged = false) => {
  const pulseStyle = isAcknowledged
    ? ''
    : 'animation:dashPulse 0.9s ease-in-out infinite;';
  const shadow = isAcknowledged
    ? '0 0 6px rgba(239,68,68,0.5)'
    : '0 0 14px #ef4444, 0 0 5px #ef4444';

  const html = `
    <div style="
      position:relative;
      width:18px;height:18px;border-radius:50%;
      background:#ef4444;
      box-shadow:${shadow};
      border:2.5px solid ${isAcknowledged ? '#10b981' : 'white'};
      ${pulseStyle}
      cursor:pointer;
    ">
      ${isAcknowledged ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:bold;line-height:1;">✓</span>` : ''}
    </div>
  `;
  return new L.DivIcon({
    html,
    className: 'incident-dot',
    iconSize: [18, 18],
    iconAnchor: [-7, 9], // Shifted right by 16px to prevent covering camera dot
    popupAnchor: [16, -12], // Position popup above the red dot
  });
};

/* ============================================================
 * MAP CENTER UPDATER & CAMERA CENTER CONTROLLER
 * ============================================================ */
const MapCenterUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom());
    }
  }, []); // Run ONLY on mount to prevent snapping on re-renders
  return null;
};

const CameraCenterController = ({ targetCamera, markerRefs }) => {
  const map = useMap();

  useEffect(() => {
    if (!targetCamera) return;
    const lat = parseFloat(targetCamera.latitude);
    const lng = parseFloat(targetCamera.longitude);

    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 16), {
        duration: 1.2,
      });

      const camKey = String(targetCamera.value || targetCamera.id || targetCamera.camera_id);
      const marker = markerRefs?.current?.[camKey];
      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, 500);
      }
    }
  }, [targetCamera, map, markerRefs]);

  return null;
};

/* ============================================================
 * POPUP STREAM PLAYER — Live camera feed inside map popup
 * ============================================================ */
function PopupStreamPlayer({ cam }) {
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState('connecting'); // connecting | buffering | live | offline
  const [isMaximized, setIsMaximized] = useState(false);
  const wsRef = useRef(null);
  const frameTimeoutRef = useRef(null);
  const lastBlobUrlRef = useRef(null);

  const camUrl = cam?.url || cam?.rtsp_url || '';

  useEffect(() => {
    if (!camUrl) {
      setFrame(null);
      setStatus('offline');
      return;
    }

    const defaultWsBase = import.meta.env.VITE_DEFAULT_WS_URL || API_CONFIG?.DEFAULT_WS_URL || 'ws://110.227.253.23:8081/live/ws';

    const buildWsUrl = (baseUrl, rtsp) => {
      if (!baseUrl || !rtsp) return null;
      let clean = String(baseUrl).trim();
      if (clean.startsWith('http://')) clean = 'ws://' + clean.slice(7);
      else if (clean.startsWith('https://')) clean = 'wss://' + clean.slice(8);

      const parts = clean.split('?');
      let path = parts[0].replace(/\/+$/, '');
      const query = parts[1] ? `?${parts[1]}` : '';

      if (!path.endsWith('/ws')) {
        path = `${path}/ws`;
      }

      const sep = (path + query).includes('?') ? '&' : '?';
      return `${path}${query}${sep}rtsp_url=${encodeURIComponent(rtsp)}`;
    };

    const fallbackWsUrl = buildWsUrl(defaultWsBase, camUrl);

    // Check if camera has an assigned active feature
    const activeFeature = cam.features?.find(f =>
      (f.on_off_status === true || f.on_off_status === 'true' || f.on_off_status === 1) && f.model_path
    );

    const hasAssignedFeature = Boolean(
      (cam.has_active_feature !== false) &&
      activeFeature &&
      activeFeature.model_path
    );

    const primaryWsUrl = hasAssignedFeature
      ? buildWsUrl(activeFeature.model_path, camUrl)
      : fallbackWsUrl;

    let isMounted = true;
    let fallbackTried = (primaryWsUrl === fallbackWsUrl);
    let frameReceived = false;

    setStatus('connecting');
    setFrame(null);

    const clearFrameTimeout = () => {
      if (frameTimeoutRef.current) {
        clearTimeout(frameTimeoutRef.current);
        frameTimeoutRef.current = null;
      }
    };

    const connectToUrl = (targetUrl) => {
      if (!isMounted || !targetUrl) {
        setStatus('offline');
        return;
      }

      try {
        setStatus('connecting');
        const ws = new WebSocket(targetUrl);
        wsRef.current = ws;

        const tryFallback = (reason) => {
          if (!isMounted) return;
          clearFrameTimeout();
          if (!fallbackTried && fallbackWsUrl && targetUrl !== fallbackWsUrl) {
            fallbackTried = true;
            console.warn(`[PopupStream] Primary stream failed (${reason}). Falling back to DEFAULT_WS_URL:`, fallbackWsUrl);
            try {
              if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
              }
            } catch (_) { }
            connectToUrl(fallbackWsUrl);
          } else {
            setStatus('offline');
          }
        };

        ws.onopen = () => {
          if (!isMounted) return;
          setStatus('buffering');

          // If no frames arrive within 7 seconds, trigger fallback to default WS URL
          clearFrameTimeout();
          frameTimeoutRef.current = setTimeout(() => {
            if (!isMounted) return;
            if (!frameReceived) {
              tryFallback('No frames received within 7s');
            }
          }, 7000);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          let handled = false;

          // 1. JSON Frame Handling
          if (typeof event.data === 'string') {
            try {
              const data = JSON.parse(event.data);
              const rawFrame = data.frame || data.image || data.jpeg || data.data;
              if (rawFrame) {
                const frameSrc = rawFrame.startsWith('data:')
                  ? rawFrame
                  : `data:image/jpeg;base64,${rawFrame}`;
                clearFrameTimeout();
                frameReceived = true;
                setFrame(frameSrc);
                setStatus('live');
                handled = true;
              }
            } catch (_) { }
          }

          // 2. Binary Frame Handling (Blob or ArrayBuffer)
          if (!handled && event.data instanceof Blob) {
            clearFrameTimeout();
            frameReceived = true;
            if (lastBlobUrlRef.current) {
              URL.revokeObjectURL(lastBlobUrlRef.current);
            }
            const url = URL.createObjectURL(event.data);
            lastBlobUrlRef.current = url;
            setFrame(url);
            setStatus('live');
          } else if (!handled && event.data instanceof ArrayBuffer) {
            clearFrameTimeout();
            frameReceived = true;
            if (lastBlobUrlRef.current) {
              URL.revokeObjectURL(lastBlobUrlRef.current);
            }
            const blob = new Blob([event.data], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            lastBlobUrlRef.current = url;
            setFrame(url);
            setStatus('live');
          }
        };

        ws.onerror = () => {
          if (!frameReceived) {
            tryFallback('WebSocket connection error');
          } else {
            setStatus('offline');
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          clearFrameTimeout();
          if (!frameReceived) {
            tryFallback('WebSocket closed before receiving frames');
          } else {
            setStatus('offline');
          }
        };
      } catch (err) {
        console.error('[PopupStream] Error creating WebSocket:', err);
        tryFallback('WebSocket creation error');
      }
    };

    connectToUrl(primaryWsUrl);

    return () => {
      isMounted = false;
      clearFrameTimeout();
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
      if (lastBlobUrlRef.current) {
        URL.revokeObjectURL(lastBlobUrlRef.current);
        lastBlobUrlRef.current = null;
      }
    };
  }, [camUrl, cam.features, cam.ws_url, cam.has_active_feature]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '16 / 9',
      minHeight: 190,
      background: '#0f172a',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {frame ? (
        <img
          src={frame}
          alt={cam?.label || 'Camera Feed'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          color: '#94a3b8',
          fontSize: 10
        }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: status === 'live' ? '#10b981' : status === 'buffering' ? '#f59e0b' : status === 'connecting' ? '#38bdf8' : '#ef4444',
            boxShadow: status === 'live' ? '0 0 8px #10b981' : 'none'
          }} />
          <span>{status === 'live' ? 'Live Stream' : status === 'buffering' ? 'Buffering Live Stream...' : status === 'connecting' ? 'Connecting Stream...' : 'Stream Offline'}</span>
        </div>
      )}

      {/* Live Badge Overlay */}
      <div style={{
        position: 'absolute',
        top: 6,
        left: 6,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        padding: '2px 6px',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 9,
        fontWeight: 700,
        color: status === 'live' ? '#4ade80' : status === 'buffering' ? '#facc15' : status === 'connecting' ? '#38bdf8' : '#f87171',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: status === 'live' ? '#22c55e' : status === 'buffering' ? '#eab308' : status === 'connecting' ? '#38bdf8' : '#ef4444'
        }} />
        {status === 'live' ? 'LIVE' : status === 'buffering' ? 'BUFFERING' : status === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
      </div>

      {/* Maximize Button Overlay */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsMaximized(true);
        }}
        title="Maximize Live Stream"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          padding: '4px 6px',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          cursor: 'pointer',
          zIndex: 20,
          fontSize: 9,
          fontWeight: 700,
        }}
      >
        <Maximize2 size={11} />
        <span>Maximize</span>
      </button>

      {/* Fullscreen Portal Overlay */}
      {isMaximized && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col p-4 md:p-6 text-white font-sans">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${status === 'live' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              <div>
                <h2 className="text-base md:text-lg font-bold text-white tracking-wide">{cam?.label || cam?.name || 'Camera Live Stream'}</h2>
                <p className="text-xs text-gray-400">
                  {cam?.zone_name || cam?.zone ? `Zone: ${cam.zone_name || cam.zone}` : ''} {cam?.location ? `${(cam?.zone_name || cam?.zone) ? ' | ' : ''}Location: ${cam.location}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${status === 'live' ? 'bg-green-950/80 border-green-500/40 text-green-400' : 'bg-yellow-950/80 border-yellow-500/40 text-yellow-400'}`}>
                {status === 'live' ? '● LIVE' : status.toUpperCase()}
              </div>

              {/* Minimize Button */}
              <button
                onClick={() => setIsMaximized(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
                title="Minimize Stream"
              >
                <Minimize2 size={15} />
                <span>Minimize</span>
              </button>

              {/* Close X Button */}
              <button
                onClick={() => setIsMaximized(false)}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Close Fullscreen"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Stream Container */}
          <div className="flex-1 relative my-3 bg-black rounded-xl border border-gray-800 overflow-hidden flex items-center justify-center">
            {frame ? (
              <img src={frame} alt={cam?.label || 'Camera Feed'} className="w-full h-full object-fill bg-black" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <Camera size={40} className="animate-pulse text-blue-400" />
                <span className="text-sm font-medium">{status === 'buffering' ? 'Buffering Live Stream...' : 'Connecting Stream...'}</span>
              </div>
            )}

            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-md text-xs font-mono text-gray-300 flex items-center gap-2 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>REC | {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ============================================================
 * CLUSTER POPUP — prev/next navigation between cameras
 * ============================================================ */
function ClusterPopup({ cameras, onCameraClick, selectedCameraId }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (selectedCameraId && cameras.length > 0) {
      const matchIdx = cameras.findIndex(c =>
        String(c.value) === String(selectedCameraId) ||
        String(c.id) === String(selectedCameraId) ||
        String(c.camera_id) === String(selectedCameraId)
      );
      if (matchIdx !== -1) {
        setIdx(matchIdx);
      }
    }
  }, [selectedCameraId, cameras]);

  const cam = cameras[idx] || cameras[0];
  const total = cameras.length;

  const handleSelectCameraIndex = (newIdx) => {
    setIdx(newIdx);
    const targetCam = cameras[newIdx];
    if (targetCam && onCameraClick) {
      onCameraClick(targetCam);
    }
  };

  const isPrimarySelected = cam && selectedCameraId && (
    String(cam.value) === String(selectedCameraId) ||
    String(cam.id) === String(selectedCameraId) ||
    String(cam.camera_id) === String(selectedCameraId)
  );

  return (
    <div style={{ minWidth: 350, maxWidth: 400, fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
        borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '12px 12px 0 0',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ color: '#93c5fd', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
          {total > 1 ? `Camera ${idx + 1} of ${total}` : 'CAMERA SPOT'}
        </span>
        {total > 1 && (
          <div style={{ display: 'flex', gap: 6, marginRight: 20 }}>
            <button
              onClick={() => handleSelectCameraIndex((idx - 1 + total) % total)}
              style={{
                background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#93c5fd',
                borderRadius: 4, padding: '2px 7px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
              }}
              title="Previous camera"
            >‹</button>
            <button
              onClick={() => handleSelectCameraIndex((idx + 1) % total)}
              style={{
                background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#93c5fd',
                borderRadius: 4, padding: '2px 7px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
              }}
              title="Next camera"
            >›</button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px', background: '#0f172a', color: '#f8fafc' }}>
        {/* Live Stream Video Player inside popup */}
        <PopupStreamPlayer cam={cam} />

        <div style={{ fontWeight: 700, fontSize: 13, color: '#38bdf8', marginBottom: 6, lineHeight: 1.3 }}>
          {cam.label || cam.name}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
          <strong style={{ color: '#cbd5e1' }}>Zone:</strong> {cam.zone_name || cam.zone || 'N/A'}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
          <strong style={{ color: '#cbd5e1' }}>Location:</strong> {cam.location || 'N/A'}
        </div>

        {/* Navigation dots */}
        {total > 1 && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8 }}>
            {cameras.map((_, i) => (
              <div
                key={i}
                onClick={() => handleSelectCameraIndex(i)}
                style={{
                  width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
                  background: i === idx ? '#38bdf8' : '#334155',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 * INCIDENT POPUP — prev/next navigation & OK Acknowledge action
 * ============================================================ */
function IncidentPopup({
  incidents,
  acknowledgedIncidentIds = new Set(),
  onAcknowledgeIncident,
  acknowledgedViolationIds = new Set(),
  onAcknowledgeViolation
}) {
  const [idx, setIdx] = useState(0);
  const inc = incidents[idx] || incidents[0];
  const total = incidents.length;

  const isViolation = inc?.isViolation || inc?.module === 'No Parking' || !!inc?.plate;
  const incId = inc?.id || inc?.incident_id || inc?.violation_id;
  const isAcked = isViolation
    ? ((acknowledgedViolationIds && (acknowledgedViolationIds.has(incId) || acknowledgedViolationIds.has(String(incId)))) || inc?.status === 'ACKNOWLEDGED' || inc?.status === 'RESOLVED')
    : ((acknowledgedIncidentIds && (acknowledgedIncidentIds.has(incId) || acknowledgedIncidentIds.has(String(incId)))) || inc?.status === 'ACKNOWLEDGED' || inc?.status === 'RESOLVED');

  const titleHeader = isViolation
    ? (total > 1 ? `Violation ${idx + 1} of ${total}` : 'NO PARKING VIOLATION')
    : (total > 1 ? `Incident ${idx + 1} of ${total}` : 'AI INCIDENT');

  // Evidence image handling
  let imageSrc = null;
  const rawImg = inc?.violation_image_path || inc?.image_path || inc?.image || inc?.violation_image;
  if (rawImg) {
    if (rawImg.startsWith('http') || rawImg.startsWith('data:')) {
      imageSrc = rawImg;
    } else {
      const clean = rawImg.replace(/\\/g, '/');
      imageSrc = `${API_BASE_URL}/${clean}`;
    }
  } else if (inc?.violation_image_base64) {
    imageSrc = inc.violation_image_base64.startsWith('data:')
      ? inc.violation_image_base64
      : `data:image/jpeg;base64,${inc.violation_image_base64}`;
  }

  const handleOkClick = () => {
    if (isViolation) {
      if (onAcknowledgeViolation) onAcknowledgeViolation(incId);
    } else {
      if (onAcknowledgeIncident) onAcknowledgeIncident(incId);
    }
  };

  return (
    <div style={{ minWidth: 350, maxWidth: 400, fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{
        background: isAcked ? 'linear-gradient(135deg, #14532d 0%, #064e3b 100%)' : 'linear-gradient(135deg, #831843 0%, #7f1d1d 100%)',
        borderBottom: isAcked ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px 12px 0 0',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ color: isAcked ? '#86efac' : '#fca5a5', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
          {titleHeader} {isAcked ? '(Acknowledged)' : ''}
        </span>
        {total > 1 && (
          <div style={{ display: 'flex', gap: 6, marginRight: 20 }}>
            <button
              onClick={() => setIdx(i => (i - 1 + total) % total)}
              style={{
                background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)', color: '#fff',
                borderRadius: 4, padding: '2px 7px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
              }}
              title="Previous item"
            >‹</button>
            <button
              onClick={() => setIdx(i => (i + 1) % total)}
              style={{
                background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)', color: '#fff',
                borderRadius: 4, padding: '2px 7px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
              }}
              title="Next item"
            >›</button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px', background: '#0f172a', color: '#f8fafc' }}>
        {/* Evidence Image */}
        {imageSrc && (
          <div style={{ width: '100%', aspectRatio: '16 / 9', minHeight: 180, borderRadius: 8, overflow: 'hidden', marginBottom: 10, background: '#1e293b' }}>
            <img
              src={imageSrc}
              alt="Evidence"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        {isViolation ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 13, color: isAcked ? '#4ade80' : '#f87171', marginBottom: 6, lineHeight: 1.3 }}>
              {isAcked ? '✓ Violation Acknowledged' : '⚠ No Parking Detected'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
              <strong style={{ color: '#cbd5e1' }}>Plate:</strong> {inc?.plate || `Vehicle #${inc?.vehicle_id || 'N/A'}`}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
              <strong style={{ color: '#cbd5e1' }}>Location:</strong> {inc?.location || inc?.camera || 'Unknown'}
            </div>
            {inc?.stationary && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
                <strong style={{ color: '#cbd5e1' }}>Stationary:</strong> {inc.stationary}s
              </div>
            )}
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
              <strong style={{ color: '#cbd5e1' }}>Status:</strong> {isAcked ? 'ACKNOWLEDGED' : (inc?.status || 'UNRESOLVED')}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 13, color: isAcked ? '#4ade80' : '#f87171', marginBottom: 6, lineHeight: 1.3 }}>
              {isAcked ? '✓ Incident Acknowledged' : `⚠ ${inc?.incident_type || inc?.type || 'AI Incident'} Detected`}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
              <strong style={{ color: '#cbd5e1' }}>Severity:</strong> {inc?.severity || 'N/A'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
              <strong style={{ color: '#cbd5e1' }}>Status:</strong> {isAcked ? 'ACKNOWLEDGED' : (inc?.status || 'UNRESOLVED')}
            </div>
          </>
        )}

        {/* Navigation dots */}
        {total > 1 && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 10 }}>
            {incidents.map((_, i) => (
              <div
                key={i}
                onClick={() => setIdx(i)}
                style={{
                  width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
                  background: i === idx ? (isAcked ? '#22c55e' : '#f87171') : '#334155',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        )}

        {/* OK / Acknowledge Button */}
        {!isAcked ? (
          <button
            onClick={handleOkClick}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 0',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
              transition: 'transform 0.15s, opacity 0.15s'
            }}
          >
            <span>✓</span> OK (Stop Blinking)
          </button>
        ) : (
          <div style={{
            width: '100%',
            background: 'rgba(22, 163, 74, 0.15)',
            color: '#4ade80',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 8,
            padding: '7px 0',
            fontSize: 11,
            fontWeight: 700,
            textAlign: 'center',
          }}>
            ✓ Acknowledged
          </div>
        )}

        <div style={{ fontSize: 10, color: '#64748b', marginTop: 8, textAlign: 'center' }}>
          {inc?.detected_at || inc?.time ? new Date(inc.detected_at || inc.time).toLocaleString() : ''}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * MAIN COMPONENT
 * ============================================================ */
const PROXIMITY_DEG = 0.0002; // ~22m — cameras closer than this get grouped

const defaultLat = parseFloat(import.meta.env.VITE_MAP_DEFAULT_CENTER_LAT || '18.1500');
const defaultLng = parseFloat(import.meta.env.VITE_MAP_DEFAULT_CENTER_LNG || '74.5833');
const defaultCenter = [defaultLat, defaultLng];

export default function LiveDashboardMap({
  cameras,
  criticalAlerts,
  aiIncidents,
  violations = [],
  mapFilter,
  onCameraClick,
  acknowledgedIncidentIds = new Set(),
  onAcknowledgeIncident,
  acknowledgedViolationIds = new Set(),
  onAcknowledgeViolation,
  targetCamera,
  selectedMapCamera
}) {
  const markerRefs = useRef({});

  /* ---- helpers ---- */
  const getCameraAlerts = useCallback((camera) => {
    if (!criticalAlerts?.length) return [];
    return criticalAlerts.filter(a =>
      a.loc === camera.location || a.loc === camera.label || a.loc === camera.id
    );
  }, [criticalAlerts]);

  const hasViolation = (camera) => getCameraAlerts(camera).length > 0;

  /* ---- filter cameras that have valid coords ---- */
  const validCameras = cameras.filter(cam => {
    if (!cam.latitude || !cam.longitude || isNaN(cam.latitude) || isNaN(cam.longitude)) return false;
    if (mapFilter === 'Cameras') return true;
    if (mapFilter === 'Alerts') return hasViolation(cam);
    return true;
  });

  /* ---- cluster cameras that are very close together ---- */
  const clusters = [];
  const assigned = new Set();

  validCameras.forEach((cam, i) => {
    if (assigned.has(i)) return;
    const group = [cam];
    assigned.add(i);

    validCameras.forEach((other, j) => {
      if (i === j || assigned.has(j)) return;
      const dLat = Math.abs(cam.latitude - other.latitude);
      const dLng = Math.abs(cam.longitude - other.longitude);
      if (dLat < PROXIMITY_DEG && dLng < PROXIMITY_DEG) {
        group.push(other);
        assigned.add(j);
      }
    });

    // Centroid of the cluster
    const avgLat = group.reduce((s, c) => s + parseFloat(c.latitude), 0) / group.length;
    const avgLng = group.reduce((s, c) => s + parseFloat(c.longitude), 0) / group.length;
    const anyViolation = group.some(c => hasViolation(c));

    clusters.push({ cameras: group, lat: avgLat, lng: avgLng, anyViolation });
  });

  /* ---- check item acknowledgement status ---- */
  const isItemAcknowledged = (item) => {
    const id = item.id || item.violation_id || item.incident_id;
    const strId = String(id);
    if (item.isViolation) {
      if (acknowledgedViolationIds && (acknowledgedViolationIds.has(id) || acknowledgedViolationIds.has(strId))) {
        return true;
      }
      return item.status === 'ACKNOWLEDGED' || item.status === 'RESOLVED';
    } else {
      if (acknowledgedIncidentIds && (acknowledgedIncidentIds.has(id) || acknowledgedIncidentIds.has(strId))) {
        return true;
      }
      return item.status === 'ACKNOWLEDGED' || item.status === 'RESOLVED';
    }
  };

  /* ---- collect incidents AND violations that have lat/lng ---- */
  const alertDots = [
    ...(aiIncidents || []).map(inc => ({ ...inc, isViolation: false })),
    ...(violations || []).map(v => ({ ...v, isViolation: true })),
  ].filter(item => {
    if (mapFilter === 'Cameras') return false; // Hide alert dots if filtering for Cameras only

    // Do not show acknowledged or resolved items on the map
    if (isItemAcknowledged(item)) return false;

    const lat = parseFloat(item.latitude);
    const lng = parseFloat(item.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  });

  /* ---- cluster alerts that are very close together ---- */
  const alertClusters = [];
  const assignedAlerts = new Set();

  alertDots.forEach((item, i) => {
    if (assignedAlerts.has(i)) return;
    const group = [item];
    assignedAlerts.add(i);

    alertDots.forEach((other, j) => {
      if (i === j || assignedAlerts.has(j)) return;
      const dLat = Math.abs(parseFloat(item.latitude) - parseFloat(other.latitude));
      const dLng = Math.abs(parseFloat(item.longitude) - parseFloat(other.longitude));
      if (dLat < PROXIMITY_DEG && dLng < PROXIMITY_DEG) {
        group.push(other);
        assignedAlerts.add(j);
      }
    });

    const avgLat = group.reduce((s, c) => s + parseFloat(c.latitude), 0) / group.length;
    const avgLng = group.reduce((s, c) => s + parseFloat(c.longitude), 0) / group.length;

    // Cluster is acknowledged if ALL items in it are acknowledged
    const isAcknowledged = group.every(it => isItemAcknowledged(it));

    alertClusters.push({ items: group, lat: avgLat, lng: avgLng, isAcknowledged });
  });

  return (
    <>
      {/* Keyframe for pulsing animation & popup styles */}
      <style>{`
        @keyframes dashPulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.3); opacity: 0.75; }
        }
        .leaflet-pane.leaflet-popup-pane {
          z-index: 1000 !important;
        }
        .leaflet-popup-content-wrapper {
          padding: 0 !important;
          border-radius: 14px !important;
          overflow: hidden;
          background: #0f172a !important;
          color: #f8fafc !important;
          border: 1px solid rgba(59, 130, 246, 0.35) !important;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(59, 130, 246, 0.15) !important;
          max-width: 450px !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          max-width: 450px !important;
          width: auto !important;
        }
        .leaflet-popup-tip {
          background: #0f172a !important;
          border: 1px solid rgba(59, 130, 246, 0.3) !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: #94a3b8 !important;
          padding: 6px 8px 0 0 !important;
          font-size: 16px !important;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          color: #fff !important;
        }
      `}</style>

      <div className="absolute inset-0 z-0 h-full w-full bg-gray-100 dark:bg-[#0d131f]">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          minZoom={10}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          zoomControl={false}
        >
          <MapCenterUpdater center={defaultCenter} />
          <CameraCenterController targetCamera={targetCamera} markerRefs={markerRefs} />

          <TileLayer
            attribution='Map data &copy; Google'
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t:poi|p.v:off,s.t:transit|p.v:off,s.t:landscape.natural|p.v:off"
            className="dark:opacity-90 dark:invert dark:contrast-125 dark:hue-rotate-180"
          />

          {/* ── Camera Cluster Markers ── */}
          {clusters.map((cluster, ci) => (
            <Marker
              key={`cluster-${ci}`}
              position={[cluster.lat, cluster.lng]}
              icon={createClusterIcon(cluster.cameras.length)}
              eventHandlers={{
                click: () => {
                  if (cluster.cameras && cluster.cameras.length > 0 && onCameraClick) {
                    onCameraClick(cluster.cameras[0]);
                  }
                }
              }}
              ref={(ref) => {
                if (ref) {
                  cluster.cameras.forEach(cam => {
                    const key = String(cam.value || cam.id || cam.camera_id);
                    markerRefs.current[key] = ref;
                  });
                }
              }}
            >
              <Popup className="cluster-popup">
                <ClusterPopup
                  cameras={cluster.cameras}
                  onCameraClick={onCameraClick}
                  selectedCameraId={selectedMapCamera?.value || selectedMapCamera?.id || targetCamera?.value || targetCamera?.id || targetCamera?.camera_id}
                />
              </Popup>
            </Marker>
          ))}

          {/* ── Alert (Incident / Violation) Red Dot Markers ── */}
          {alertClusters.map((cluster, ci) => (
            <Marker
              key={`alert-cluster-${ci}`}
              position={[cluster.lat, cluster.lng]}
              icon={createIncidentIcon(cluster.isAcknowledged)}
            >
              <Popup className="cluster-popup incident-popup">
                <IncidentPopup
                  incidents={cluster.items}
                  acknowledgedIncidentIds={acknowledgedIncidentIds}
                  onAcknowledgeIncident={onAcknowledgeIncident}
                  acknowledgedViolationIds={acknowledgedViolationIds}
                  onAcknowledgeViolation={onAcknowledgeViolation}
                />
              </Popup>
            </Marker>
          ))}
        </MapContainer>

      </div>
    </>
  );
}

