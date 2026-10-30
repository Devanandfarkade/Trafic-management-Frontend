import { useState, useEffect, useRef, useCallback } from 'react';
import { API_CONFIG } from '../../config.js';

/**
 * Custom hook for Python Live Triple Seat Detection API (Port 8091)
 *
 * Endpoints:
 * 1. WS:   ws://<SERVER_IP>:8091/triple/ws?rtsp_url=<URL-ENCODED-RTSP-URL>
 * 2. GET:  http://<SERVER_IP>:8091/health
 * 3. POST: http://<SERVER_IP>:8091/triple/reload (optional / admin)
 *
 * Message types:
 * - Frame (continuous, ~15 fps): { type: "frame", frame: "<base64 JPEG>" }
 * - Detection (on confirmed violation): { type: "detection", event: "triple_seat", bike_id: 17, riders: 3, time: "...", rtsp_url: "...", snapshot: "<base64 JPEG>" }
 */
export default function useTripleRidingStream({
  rtspUrl: initialRtspUrl,
  serverApiUrl = API_CONFIG.TRIPLE_RIDING_API_URL || 'http://110.227.253.23:8091',
  serverWsUrl = API_CONFIG.TRIPLE_RIDING_WS_URL || 'ws://110.227.253.23:8091',
  autoConnect = true,
  onDetection = null
} = {}) {
  const [rtspUrl, setRtspUrl] = useState(
    initialRtspUrl || API_CONFIG.RTSP_TRIPLE_RIDING_CAM || 'rtsp://admin:Admin%40123@192.168.1.21:554'
  );
  const [apiUrl, setApiUrl] = useState(serverApiUrl);
  const [wsBaseUrl, setWsBaseUrl] = useState(serverWsUrl);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [lastDetection, setLastDetection] = useState(null);
  const [fps, setFps] = useState(0);

  // Health state
  const [health, setHealth] = useState({
    status: 'unknown',
    active_recognizers: 0,
    model_loaded: false,
    lastChecked: null,
    latency: null,
    error: null
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Reload Weights state
  const [isReloadingWeights, setIsReloadingWeights] = useState(false);
  const [reloadResult, setReloadResult] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastFpsCalcTimeRef = useRef(Date.now());
  const isMountedRef = useRef(true);
  const onDetectionRef = useRef(onDetection);

  // Sync onDetection callback reference
  useEffect(() => {
    onDetectionRef.current = onDetection;
  }, [onDetection]);

  // Sync rtspUrl if initialRtspUrl changes externally
  useEffect(() => {
    if (initialRtspUrl && initialRtspUrl !== rtspUrl) {
      setRtspUrl(initialRtspUrl);
    }
  }, [initialRtspUrl]);

  // FPS counter ticker
  useEffect(() => {
    const fpsInterval = setInterval(() => {
      const now = Date.now();
      const deltaSec = (now - lastFpsCalcTimeRef.current) / 1000;
      if (deltaSec > 0) {
        const currentFps = Math.round(frameCountRef.current / deltaSec);
        setFps(currentFps);
        frameCountRef.current = 0;
        lastFpsCalcTimeRef.current = now;
      }
    }, 1000);

    return () => clearInterval(fpsInterval);
  }, []);

  /**
   * Health Check: GET http://<SERVER_IP>:8091/health
   */
  const checkHealth = useCallback(async (customUrl = null) => {
    const targetBase = customUrl || apiUrl;
    setIsCheckingHealth(true);
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${targetBase.replace(/\/+$/, '')}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      if (res.ok) {
        const data = await res.json();
        const healthData = {
          status: data.status || 'ok',
          active_recognizers: data.active_recognizers ?? 0,
          model_loaded: !!data.model_loaded,
          lastChecked: new Date(),
          latency,
          error: null
        };
        setHealth(healthData);
        return healthData;
      } else {
        const errorHealth = {
          status: 'error',
          active_recognizers: 0,
          model_loaded: false,
          lastChecked: new Date(),
          latency,
          error: `HTTP ${res.status}`
        };
        setHealth(errorHealth);
        return errorHealth;
      }
    } catch (err) {
      const errorHealth = {
        status: 'offline',
        active_recognizers: 0,
        model_loaded: false,
        lastChecked: new Date(),
        latency: null,
        error: err.name === 'AbortError' ? 'Connection timed out' : err.message
      };
      setHealth(errorHealth);
      return errorHealth;
    } finally {
      setIsCheckingHealth(false);
    }
  }, [apiUrl]);

  /**
   * Reload YOLO Weights: POST http://<SERVER_IP>:8091/triple/reload
   */
  const reloadWeights = useCallback(async () => {
    setIsReloadingWeights(true);
    setReloadResult(null);
    try {
      const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/triple/reload`, {
        method: 'POST'
      });
      const data = await res.json();
      setReloadResult(data);
      return data;
    } catch (err) {
      const errorResult = {
        status: 'error',
        message: err.message || 'Failed to reload YOLO weights on Python server'
      };
      setReloadResult(errorResult);
      return errorResult;
    } finally {
      setIsReloadingWeights(false);
    }
  }, [apiUrl]);

  /**
   * Connect to Python WebSocket stream:
   * ws://<SERVER_IP>:8091/triple/ws?rtsp_url=<URL-ENCODED-RTSP-URL>
   */
  const connect = useCallback((overrideRtsp = null) => {
    const activeRtsp = overrideRtsp || rtspUrl;
    if (!activeRtsp) {
      setStreamError('No RTSP stream URL configured');
      return;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      wsRef.current.close(1000, "Reconnecting");
    }

    setIsConnecting(true);
    setStreamError(null);

    try {
      const cleanWsBase = wsBaseUrl.replace(/\/+$/, '');
      const encodedRtsp = encodeURIComponent(activeRtsp);
      const wsUrl = `${cleanWsBase}/triple/ws?rtsp_url=${encodedRtsp}`;

      console.log('[TripleRidingStream] Connecting to Python WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        console.log('[TripleRidingStream] WebSocket Connected successfully!');
        setIsConnected(true);
        setIsConnecting(false);
        setStreamError(null);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const data = JSON.parse(event.data);

          // Type 1 — Frame message (continuous, ~15 fps)
          if (data.type === 'frame' && data.frame) {
            frameCountRef.current += 1;
            const src = data.frame.startsWith('data:')
              ? data.frame
              : `data:image/jpeg;base64,${data.frame}`;
            setLiveFrame(src);
          }
          // Type 2 — Detection message (event-based, only on confirmed violation)
          else if (data.type === 'detection') {
            console.log(`[TripleRidingStream] Triple seat detected: Bike #${data.bike_id}, ${data.riders} riders`);

            const fullSnapshot = data.snapshot
              ? (data.snapshot.startsWith('data:') ? data.snapshot : `data:image/jpeg;base64,${data.snapshot}`)
              : null;

            const detectionEvent = {
              type: 'detection',
              event: data.event || 'triple_seat',
              bike_id: data.bike_id,
              riders: data.riders,
              time: data.time || new Date().toISOString(),
              rtsp_url: data.rtsp_url,
              snapshot: fullSnapshot
            };

            setLastDetection(detectionEvent);

            if (onDetectionRef.current) {
              onDetectionRef.current(detectionEvent);
            }
          }
        } catch (err) {
          console.error('[TripleRidingStream] Error parsing socket payload:', err);
        }
      };

      ws.onerror = (e) => {
        if (!isMountedRef.current) return;
        console.warn('[TripleRidingStream] WebSocket error:', e);
        setStreamError('Connection to Python AI server failed. Please check server status.');
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        console.log(`[TripleRidingStream] WebSocket closed with code ${event.code}:`, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Auto-reconnect if closed abnormally (recommended 3s retry per documentation)
        if (event.code !== 1000) {
          setStreamError('Stream disconnected. Reconnecting in 3s...');
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect(activeRtsp);
            }
          }, 3000);
        }
      };
    } catch (err) {
      console.error('[TripleRidingStream] WebSocket creation error:', err);
      setStreamError(err.message || 'Failed to initialize WebSocket');
      setIsConnecting(false);
    }
  }, [rtspUrl, wsBaseUrl]);

  /**
   * Disconnect cleanly
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "User initiated disconnect");
      } catch (e) {
        console.error('[TripleRidingStream] Error closing WebSocket:', e);
      }
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setLiveFrame(null);
  }, []);

  /**
   * Reconnect trigger
   */
  const reconnect = useCallback((overrideRtsp = null) => {
    disconnect();
    setTimeout(() => {
      connect(overrideRtsp);
    }, 300);
  }, [disconnect, connect]);

  // Initial connect & cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    if (autoConnect && rtspUrl) {
      connect(rtspUrl);
      checkHealth();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [rtspUrl, autoConnect]);

  return {
    // Stream status & live feed
    isConnected,
    isConnecting,
    streamError,
    liveFrame,
    lastDetection,
    fps,

    // Endpoints & configuration
    rtspUrl,
    setRtspUrl,
    apiUrl,
    setApiUrl,
    wsBaseUrl,
    setWsBaseUrl,

    // Server health
    health,
    isCheckingHealth,
    checkHealth,

    // YOLO weights reload
    isReloadingWeights,
    reloadResult,
    reloadWeights,

    // Controls
    connect,
    disconnect,
    reconnect
  };
}
