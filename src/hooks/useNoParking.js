import { useState, useRef, useCallback, useEffect } from 'react';
import { API_CONFIG } from '../../config';

export default function useNoParking(rtspUrl) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [frame, setFrame] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState({
    total_vehicles_seen: 0,
    active_vehicles: 0,
    violations_count: 0,
    latest_violation: null
  });

  const wsRef = useRef(null);
  const timeoutRef = useRef(null);
  const frameTimeoutRef = useRef(null);
  const isIntentionalDisconnectRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const connect = useCallback(function doConnect() {
    if (!rtspUrl) return;

    // Prevent duplicate connections
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setIsLoading(true);
    setError(null);
    isIntentionalDisconnectRef.current = false;

    try {
      const wsUrl = `${API_CONFIG.NO_PARKING_WS_URL}/ws?rtsp_url=${encodeURIComponent(rtspUrl)}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setIsLoading(false);
        setError(null);

        // If no frame arrives in 8s, try fallback to default WS
        const defaultWs = API_CONFIG.DEFAULT_WS_URL || 'ws://110.227.253.23:8081/live/ws';
        if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
        frameTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current || isIntentionalDisconnectRef.current) return;
          // Check if we connected to non-default WS but got no frames
          const currentUrl = wsRef.current?._url || '';
          if (!currentUrl.startsWith(defaultWs)) {
            console.log('[NoParking] No frames from primary WS, hook will reconnect via default...');
          }
        }, 8000);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        let handled = false;

        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);

            if (data.error) {
              setError(data.error);
              return;
            }

            const frameB64 = data.frame || data.image || data.jpeg || data.data;
            if (frameB64) {
              if (frameTimeoutRef.current) { clearTimeout(frameTimeoutRef.current); frameTimeoutRef.current = null; }
              // Some servers send raw base64 without data: prefix
              setFrame(frameB64.startsWith('data:') ? frameB64 : frameB64);
              handled = true;
            }

            if (data.status) {
              setStatus(prev => ({ ...prev, ...data.status }));
            }
          } catch (err) {
            console.error('Failed to parse No Parking WS message:', err);
          }
        }

        // Binary JPEG frames
        if (!handled && event.data instanceof Blob) {
          if (frameTimeoutRef.current) { clearTimeout(frameTimeoutRef.current); frameTimeoutRef.current = null; }
          const reader = new FileReader();
          reader.onload = () => { if (mountedRef.current) setFrame(reader.result); };
          reader.readAsDataURL(event.data);
        } else if (!handled && event.data instanceof ArrayBuffer) {
          if (frameTimeoutRef.current) { clearTimeout(frameTimeoutRef.current); frameTimeoutRef.current = null; }
          const blob = new Blob([event.data], { type: 'image/jpeg' });
          setFrame(URL.createObjectURL(blob));
        }
      };

      ws.onerror = (err) => {
        if (!mountedRef.current) return;
        console.error("No Parking WebSocket error:", err);
        setError("WebSocket connection failed.");
        setIsConnected(false);
        setIsLoading(false);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        setIsLoading(false);
        
        // Auto-reconnect if it wasn't an intentional stop
        if (!isIntentionalDisconnectRef.current) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            if (mountedRef.current && !isIntentionalDisconnectRef.current) {
              doConnect();
            }
          }, 3000); // Reconnect after 3 seconds
        }
      };

      wsRef.current = ws;

    } catch (err) {
      if (!mountedRef.current) return;
      setError("Failed to initialize WebSocket");
      setIsLoading(false);
      setIsConnected(false);
    }
  }, [rtspUrl]);

  const disconnect = useCallback(() => {
    isIntentionalDisconnectRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsLoading(false);
    setFrame(null);
  }, []);

  return {
    isConnected,
    isLoading,
    frame,
    status,
    error,
    connect,
    disconnect
  };
}
