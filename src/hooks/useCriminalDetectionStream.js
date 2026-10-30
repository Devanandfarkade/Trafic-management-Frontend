import { useState, useEffect, useRef, useCallback } from 'react';
import { API_CONFIG } from '../../config.js';

/**
 * Custom hook for Python Live Face Recognition & Criminal Detection Stream (Port 8090)
 * 
 * Endpoints:
 * 1. WS:   ws://<SERVER_IP>:8090/face/ws?rtsp_url=<RTSP_URL>
 * 2. POST: http://<SERVER_IP>:8090/faces/reload
 * 3. GET:  http://<SERVER_IP>:8090/health
 */
export function base64ToBlob(b64, mime = "video/mp4") {
  try {
    const cleanB64 = b64.includes(",") ? b64.split(",")[1] : b64;
    const byteChars = atob(cleanB64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch (err) {
    console.error("[CriminalDetectionStream] base64ToBlob error:", err);
    return null;
  }
}

export default function useCriminalDetectionStream({
  rtspUrl: initialRtspUrl,
  serverApiUrl = API_CONFIG.CRIMINAL_DETECTION_API_URL || 'http://110.227.253.23:8090',
  serverWsUrl = API_CONFIG.CRIMINAL_DETECTION_WS_URL || 'ws://110.227.253.23:8090',
  autoConnect = true,
  onDetection = null,
  onDetectionClip = null
} = {}) {
  const [rtspUrl, setRtspUrl] = useState(initialRtspUrl || API_CONFIG.RTSP_CRIMINAL_CAM || 'rtsp://admin:Admin%40123@192.168.1.21:554');
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
    lastChecked: null,
    latency: null
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Reload Database state
  const [isReloadingDb, setIsReloadingDb] = useState(false);
  const [reloadResult, setReloadResult] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastFpsCalcTimeRef = useRef(Date.now());
  const isMountedRef = useRef(true);
  const onDetectionRef = useRef(onDetection);
  const onDetectionClipRef = useRef(onDetectionClip);
  const recordingCanvasRef = useRef(null);
  const isRecordingRef = useRef(false);

  // Initialize canvas for capturing video clips
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, 640, 360);
      }
      recordingCanvasRef.current = canvas;
    }
  }, []);

  /**
   * Captures a 5-second video clip from the live surveillance stream
   * Returns a Promise<Blob> containing the recorded video
   */
  const capture5sVideo = useCallback((durationMs = 5000) => {
    return new Promise((resolve) => {
      try {
        const canvas = recordingCanvasRef.current;
        if (!canvas || typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
          console.warn('[CriminalDetectionStream] MediaRecorder or canvas.captureStream not supported');
          return resolve(null);
        }

        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
          mimeType = 'video/webm;codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        }

        const stream = canvas.captureStream(15);
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks = [];
        isRecordingRef.current = true;

        // Keep canvas stream active with a timestamp overlay update
        const tickInterval = setInterval(() => {
          if (canvas && recorder.state === 'recording') {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const now = new Date();
              const timeStr = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
              ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
              ctx.fillRect(10, 10, 200, 24);
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.arc(22, 22, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 11px monospace';
              ctx.fillText(`REC ${timeStr}`, 34, 26);
            }
          }
        }, 100);

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          clearInterval(tickInterval);
          isRecordingRef.current = false;
          try {
            const finalMime = recorder.mimeType || mimeType;
            const blob = new Blob(chunks, { type: finalMime });
            console.log(`[CriminalDetectionStream] Captured 5s video evidence: ${blob.size} bytes (${finalMime})`);
            resolve(blob);
          } catch (err) {
            console.warn('[CriminalDetectionStream] Error creating video Blob:', err);
            resolve(null);
          }
        };

        recorder.onerror = (err) => {
          clearInterval(tickInterval);
          isRecordingRef.current = false;
          console.warn('[CriminalDetectionStream] MediaRecorder error:', err);
          resolve(null);
        };

        recorder.start(500);

        setTimeout(() => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }, durationMs);
      } catch (err) {
        isRecordingRef.current = false;
        console.warn('[CriminalDetectionStream] Could not record video:', err);
        resolve(null);
      }
    });
  }, []);

  // Keep latest onDetection & onDetectionClip callback references
  useEffect(() => {
    onDetectionRef.current = onDetection;
    onDetectionClipRef.current = onDetectionClip;
  }, [onDetection, onDetectionClip]);

  // Keep rtspUrl synced if initialRtspUrl prop changes externally
  useEffect(() => {
    if (initialRtspUrl && initialRtspUrl !== rtspUrl) {
      setRtspUrl(initialRtspUrl);
    }
  }, [initialRtspUrl]);

  // Calculate FPS every second
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
   * Health Check: GET http://<SERVER_IP>:8090/health
   */
  const checkHealth = useCallback(async (customUrl = null) => {
    const targetBase = customUrl || apiUrl;
    setIsCheckingHealth(true);
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
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
          lastChecked: new Date(),
          latency
        };
        setHealth(healthData);
        return healthData;
      } else {
        const errorHealth = {
          status: 'error',
          active_recognizers: 0,
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
   * Reload Face Database: POST http://<SERVER_IP>:8090/faces/reload
   */
  const reloadFaceDatabase = useCallback(async () => {
    setIsReloadingDb(true);
    setReloadResult(null);
    try {
      const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/faces/reload`, {
        method: 'POST'
      });
      const data = await res.json();
      setReloadResult(data);
      return data;
    } catch (err) {
      const errorResult = {
        status: 'error',
        message: err.message || 'Failed to connect to Python server reload endpoint'
      };
      setReloadResult(errorResult);
      return errorResult;
    } finally {
      setIsReloadingDb(false);
    }
  }, [apiUrl]);

  /**
   * Connect to Python WebSocket stream:
   * ws://<SERVER_IP>:8090/face/ws?rtsp_url=<RTSP_URL>
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
      const wsUrl = `${cleanWsBase}/face/ws?rtsp_url=${encodedRtsp}`;

      console.log('[CriminalDetectionStream] Connecting to Python WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        console.log('[CriminalDetectionStream] WebSocket Connected successfully!');
        setIsConnected(true);
        setIsConnecting(false);
        setStreamError(null);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const data = JSON.parse(event.data);

          // Type 1 — Frame (live video stream, ~15 FPS)
          if (data.type === 'frame' && data.frame) {
            frameCountRef.current += 1;
            const src = data.frame.startsWith('data:')
              ? data.frame
              : `data:image/jpeg;base64,${data.frame}`;
            setLiveFrame(src);

            if (recordingCanvasRef.current) {
              const frameImg = new Image();
              frameImg.onload = () => {
                if (recordingCanvasRef.current) {
                  const ctx = recordingCanvasRef.current.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(frameImg, 0, 0, 640, 360);
                  }
                }
              };
              frameImg.src = src;
            }
          }
          // Type 2 — Detection (instant alert with face_image + snapshot)
          else if (data.type === 'detection') {
            console.log(`[CriminalDetectionStream] Known person matched: ${data.emp_id} (${data.match_percentage}%) [ID: ${data.detection_id || 'N/A'}]`);

            const faceThumb = data.face_image
              ? (data.face_image.startsWith('data:') ? data.face_image : `data:image/jpeg;base64,${data.face_image}`)
              : null;

            const fullSnapshot = data.snapshot
              ? (data.snapshot.startsWith('data:') ? data.snapshot : `data:image/jpeg;base64,${data.snapshot}`)
              : null;

            const detectionEvent = {
              type: 'detection',
              detection_id: data.detection_id || null,
              emp_id: data.emp_id,
              match_percentage: typeof data.match_percentage === 'number'
                ? Number(data.match_percentage.toFixed(2))
                : parseFloat(data.match_percentage || 0),
              face_image: faceThumb,
              snapshot: fullSnapshot,
              clip_incoming: data.clip_incoming ?? true,
              clip_eta_seconds: data.clip_eta_seconds || 4.0,
              timestamp: new Date().toISOString()
            };
            setLastDetection(detectionEvent);

            if (onDetectionRef.current) {
              onDetectionRef.current(detectionEvent, capture5sVideo);
            }
          }
          // Type 3 — Detection Clip (arrives ~4s later with MP4 video)
          else if (data.type === 'detection_clip') {
            console.log(`[CriminalDetectionStream] Detection clip arrived for ${data.detection_id} (${data.clip_duration_seconds}s)`);

            const blob = data.clip_base64 ? base64ToBlob(data.clip_base64, data.clip_mime || 'video/mp4') : null;
            const clipUrl = blob ? URL.createObjectURL(blob) : null;

            const clipEvent = {
              type: 'detection_clip',
              detection_id: data.detection_id,
              emp_id: data.emp_id,
              match_percentage: data.match_percentage,
              clip_duration_seconds: data.clip_duration_seconds || 7.15,
              clip_mime: data.clip_mime || 'video/mp4',
              clip_blob: blob,
              clip_url: clipUrl,
              clip_base64: data.clip_base64,
              timestamp: new Date().toISOString()
            };

            if (onDetectionClipRef.current) {
              onDetectionClipRef.current(clipEvent);
            }
          }
        } catch (err) {
          console.error('[CriminalDetectionStream] Error parsing socket payload:', err);
        }
      };

      ws.onerror = (e) => {
        if (!isMountedRef.current) return;
        console.warn('[CriminalDetectionStream] WebSocket error:', e);
        setStreamError('Connection to Python AI server failed. Please check server status.');
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        console.log(`[CriminalDetectionStream] WebSocket closed with code ${event.code}:`, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Auto-reconnect if closed abnormally (code !== 1000)
        // Per documentation: reconnect after 2-3 seconds as recognizer stays alive on server
        if (event.code !== 1000) {
          setStreamError('Stream disconnected. Reconnecting in 2.5s...');
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect(activeRtsp);
            }
          }, 2500);
        }
      };
    } catch (err) {
      console.error('[CriminalDetectionStream] WebSocket creation error:', err);
      setStreamError(err.message || 'Failed to initialize WebSocket');
      setIsConnecting(false);
    }
  }, [rtspUrl, wsBaseUrl]);

  /**
   * Graceful disconnect
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
        console.error('Error closing WebSocket:', e);
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
  }, [rtspUrl, autoConnect]); // Connects/reconnects whenever rtspUrl changes

  return {
    // Stream status & data
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

    // Face database reload
    isReloadingDb,
    reloadResult,
    reloadFaceDatabase,

    // Control functions
    connect,
    disconnect,
    reconnect,
    capture5sVideo
  };
}
