import { useState, useCallback, useRef } from 'react';
import { API_CONFIG } from '../../config';

export default function useTransportStream(rtspUrl, wsUrl = null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamId, setStreamId] = useState(null);
  const [detections, setDetections] = useState([]);
  const [latestPlate, setLatestPlate] = useState(null);
  const [latestEntry, setLatestEntry] = useState(null);
  const [frame, setFrame] = useState(null);

  const wsRef = useRef(null);
  const lastEntryIdRef = useRef(null); // Keep track of last processed entry to avoid spam
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const frameTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!rtspUrl) {
      setError('No RTSP URL provided');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsLoading(true);
    setError(null);
    isMountedRef.current = true;

    const defaultWs = API_CONFIG.DEFAULT_WS_URL || 'ws://110.227.253.23:8081/live/ws';
    let fallbackTried = false;

    const connectToUrl = (targetUrl) => {
      if (!isMountedRef.current) return;

      try {
        const sep = targetUrl.includes('?') ? '&' : '?';
        const wsUrl = targetUrl.includes('rtsp_url=')
          ? targetUrl
          : `${targetUrl}${sep}rtsp_url=${encodeURIComponent(rtspUrl)}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMountedRef.current) return;
          setIsConnected(true);
          setIsLoading(false);
          setError(null);

          // Setup keep-alive ping
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('ping');
            }
          }, 30000);

          // If no frame within 8s, try fallback
          if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
          frameTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            if (!fallbackTried && defaultWs && !targetUrl.startsWith(defaultWs)) {
              fallbackTried = true;
              console.log('[Transport] No frames from primary WS, falling back...');
              ws.close();
              connectToUrl(defaultWs);
            }
          }, 8000);
        };

        ws.onmessage = (event) => {
          if (!isMountedRef.current) return;
          if (event.data === 'pong') return;

          let handled = false;
          if (typeof event.data === "string") {
            try {
              const data = JSON.parse(event.data);

              if (data.type === 'connected') {
                setStreamId(data.stream_id);
                return;
              }

              const frameB64 = data.frame || data.image || data.jpeg || data.data;
              if (frameB64) {
                if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
                const src = frameB64.startsWith("data:") ? frameB64 : `data:image/jpeg;base64,${frameB64}`;
                setFrame(src);
                handled = true;
              }

              // Python sends stream_id on every frame
              if (data.stream_id && !streamId) {
                setStreamId(data.stream_id);
              }

              // Python attaches final_plate + car_image + entry_image when a detection occurred
              // data.latest_entry holds the full detection result dict
              if (data.latest_entry && data.latest_entry.plate) {
                const entry = data.latest_entry;
                
                // Only process if it's a NEW entry we haven't seen yet
                if (lastEntryIdRef.current !== entry.entry_id) {
                  lastEntryIdRef.current = entry.entry_id;
                  setLatestEntry(entry);

                  // Update latestPlate with full entry so UI can show plate + car image
                  setLatestPlate({
                    plate: data.final_plate || entry.plate,
                    car_image: data.car_image || entry.vehicle_image_base64 || null,
                    entry_image: data.entry_image || entry.entry_image_base64 || null,
                    time: entry.time,
                    ocr_confidence: entry.ocr_confidence,
                    entry_id: entry.entry_id,
                  });

                  // Map to what the UI components (RightPanel, Table) expect
                  const mappedDetection = {
                    detection_id: entry.entry_id,
                    plate: data.final_plate || entry.plate,
                    confidence: entry.ocr_confidence || entry.detector_confidence || 0,
                    plate_image: entry.vehicle_image_base64 || entry.entry_image_base64 || null,
                    timestamp: entry.timestamp || new Date().toISOString()
                  };

                  // Push to detections list (capped at 50)
                  setDetections(prev => [mappedDetection, ...prev].slice(0, 50));
                }
              }

            } catch (err) {
              console.error('Error parsing websocket message', err);
            }
          }

          // Binary frames
          if (!handled && event.data instanceof Blob) {
            if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
            const reader = new FileReader();
            reader.onload = () => { if (isMountedRef.current) setFrame(reader.result); };
            reader.readAsDataURL(event.data);
          } else if (!handled && event.data instanceof ArrayBuffer) {
            if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
            const blob = new Blob([event.data], { type: "image/jpeg" });
            setFrame(URL.createObjectURL(blob));
          }
        };

        ws.onclose = (event) => {
          if (!isMountedRef.current) return;
          setIsConnected(false);
          setStreamId(null);

          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
          }

          // Try fallback default WS before giving up
          if (!fallbackTried && defaultWs && !targetUrl.startsWith(defaultWs)) {
            fallbackTried = true;
            console.log('[Transport] Primary WS closed, falling back to default WS...');
            connectToUrl(defaultWs);
            return;
          }

          // Reconnect after delay (unless normal closure)
          if (event.code !== 1000) {
            setError('Connection lost. Reconnecting...');
            reconnectTimeoutRef.current = setTimeout(() => {
              fallbackTried = false;
              if (isMountedRef.current) connect();
            }, 5000);
          }
        };

        ws.onerror = () => {
          if (!isMountedRef.current) return;
          console.warn('[Transport] WebSocket error on', targetUrl);
          setIsLoading(false);

          // Try fallback if primary fails
          if (!fallbackTried && defaultWs && !targetUrl.startsWith(defaultWs)) {
            fallbackTried = true;
            console.log('[Transport] Primary WS error, falling back to default WS...');
            connectToUrl(defaultWs);
          }
        };
      } catch (err) {
        console.error('Failed to establish WebSocket connection', err);
        setError('Failed to establish connection');
        setIsLoading(false);
      }
    };

    const primaryWsBase = wsUrl || API_CONFIG.LICENSE_PLATE_WS_URL;
    const primaryWsUrl = primaryWsBase
      ? `${primaryWsBase}?rtsp_url=${encodeURIComponent(rtspUrl)}`
      : `${defaultWs}?rtsp_url=${encodeURIComponent(rtspUrl)}`;

    connectToUrl(primaryWsUrl);
  }, [rtspUrl, wsUrl]);

  const disconnect = useCallback(() => {
    isMountedRef.current = false;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

    if (wsRef.current) {
      const ws = wsRef.current;
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close(1000);
      } else {
        ws.close(1000);
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    setStreamId(null);
    setDetections([]);
    setLatestPlate(null);
    setFrame(null);
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    streamId,
    detections,
    latestPlate,
    latestEntry,
    frame,
    connect,
    disconnect
  };
}
