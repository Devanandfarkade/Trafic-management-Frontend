import { useState, useEffect, useRef, useCallback } from "react";
import { API_CONFIG } from "../../config.js";

export default function useCementMixer(overrideRtspUrl) {
  const rtspUrl =
    overrideRtspUrl ||
    import.meta.env.VITE_RTSP_CEMENT_MIXER_CAM ||
    "rtsp://192.168.1.13:8080/h264_ulaw.sdp";

  const [isConnected, setIsConnected] = useState(false);
  const [frame, setFrame] = useState(null);
  const [alertActive, setAlertActive] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;
  const timeoutRef = useRef(null);
  const isIntentionalDisconnectRef = useRef(false);
  const alertTimeoutRef = useRef(null);

  const getWsBaseUrl = () => {
    return API_CONFIG.CEMENT_MIXER_WS_URL || "ws://localhost:8050";
  };

  const connect = useCallback(function doConnect() {
    if (!rtspUrl) {
      setError("RTSP URL is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    isIntentionalDisconnectRef.current = false;

    const wsBaseUrl = getWsBaseUrl().replace(/\/$/, "");
    const wsUrl = `${wsBaseUrl}/ws?rtsp_url=${encodeURIComponent(rtspUrl)}`;

    try {
      if (wsRef.current) {
        isIntentionalDisconnectRef.current = true;
        wsRef.current.close();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      console.log("Connecting to Cement Mixer WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (ws !== wsRef.current) return;
        setIsConnected(true);
        setIsLoading(false);
        reconnectAttemptsRef.current = 0;
        console.log("✅ Cement Mixer WebSocket Connected to:", rtspUrl);
      };

      ws.onmessage = (event) => {
        if (ws !== wsRef.current) return;
        try {
          const data = JSON.parse(event.data);

          if (data.frame) {
            setFrame(data.frame);
          }

          if (data.alert) {
            setAlertActive(true);
            setDetectionCount((prev) => prev + 1);

            if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
            alertTimeoutRef.current = setTimeout(() => {
              setAlertActive(false);
            }, 5000);
          }
        } catch (err) {
          console.error("Error parsing Cement Mixer WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        if (ws !== wsRef.current) return;
        setIsConnected(false);
        setIsLoading(false);
        console.log("❌ Cement Mixer WebSocket Disconnected");

        if (isIntentionalDisconnectRef.current) return;

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Reconnecting Cement Mixer attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
          timeoutRef.current = setTimeout(() => {
            doConnect();
          }, reconnectDelay);
        } else {
          setError("Max reconnection attempts reached");
        }
      };

      ws.onerror = (err) => {
        if (ws !== wsRef.current) return;
        console.error("Cement Mixer WebSocket error:", err);
        setError("WebSocket connection error");
        setIsLoading(false);
      };
    } catch (err) {
      setError(`Connection error: ${err.message}`);
      setIsLoading(false);
    }
  }, [rtspUrl]);

  const disconnect = useCallback(() => {
    isIntentionalDisconnectRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setFrame(null);
    reconnectAttemptsRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    isLoading,
    frame,
    alertActive,
    detectionCount,
    error,
    connect,
    disconnect,
    rtspUrl,
  };
}
