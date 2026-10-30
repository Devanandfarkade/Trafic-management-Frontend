import { useState, useCallback, useRef } from 'react';
import { API_CONFIG } from '../../config';

export default function useFaceRecognition(rtspUrl, wsUrl = null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [frame, setFrame] = useState(null);
  const [detections, setDetections] = useState([]);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
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

          // If no frame within 8s, try fallback
          if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
          frameTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            if (!fallbackTried && defaultWs && !targetUrl.startsWith(defaultWs)) {
              fallbackTried = true;
              console.log('[FaceRecognition] No frames from primary WS, falling back...');
              ws.close();
              connectToUrl(defaultWs);
            }
          }, 8000);
        };

        ws.onmessage = (event) => {
          if (!isMountedRef.current) return;
          let handled = false;

          if (typeof event.data === "string") {
            try {
              const data = JSON.parse(event.data);
              const frameB64 = data.frame || data.image || data.jpeg || data.data;
              if (frameB64) {
                if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
                const src = frameB64.startsWith("data:") ? frameB64 : `data:image/jpeg;base64,${frameB64}`;
                setFrame(src);
                handled = true;
              }
              if (data.detections) setDetections(data.detections);
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
          wsRef.current = null;

          // Try fallback default WS before giving up
          if (!fallbackTried && defaultWs && !targetUrl.startsWith(defaultWs)) {
            fallbackTried = true;
            console.log('[FaceRecognition] Primary WS closed, falling back to default WS...');
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
          console.warn('[FaceRecognition] WebSocket error on', targetUrl);
          setIsLoading(false);

          // Try fallback if primary fails
          if (!fallbackTried && defaultWs && !targetUrl.startsWith(defaultWs)) {
            fallbackTried = true;
            console.log('[FaceRecognition] Primary WS error, falling back to default WS...');
            connectToUrl(defaultWs);
          }
        };
      } catch (err) {
        console.error('Failed to establish WebSocket connection', err);
        setError('Failed to establish connection');
        setIsLoading(false);
      }
    };

    const primaryWsBase = wsUrl || API_CONFIG.FACE_RECOGNITION_WS_URL;
    const primaryWsUrl = primaryWsBase
      ? `${primaryWsBase}?rtsp_url=${encodeURIComponent(rtspUrl)}`
      : `${defaultWs}?rtsp_url=${encodeURIComponent(rtspUrl)}`;

    connectToUrl(primaryWsUrl);
  }, [rtspUrl, wsUrl]);

  const disconnect = useCallback(() => {
    isMountedRef.current = false;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);

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
    setFrame(null);
    setDetections([]);
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    frame,
    detections,
    connect,
    disconnect
  };
}
