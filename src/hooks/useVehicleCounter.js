import { useState, useEffect, useRef, useCallback } from "react";
import { API_CONFIG } from "../../config";

const useVehicleCounter = (
  rtspUrl,
  gateY = API_CONFIG.DEFAULT_GATE_Y || 0.2,
  confidence = API_CONFIG.DEFAULT_CONFIDENCE || 0.25,
  selectedVehicleType = null,
  cameraWsUrl = null,  // Optional: camera's pre-resolved ws_url from useCameraFilter
) => {
  const [isConnected, setIsConnected] = useState(false);
  const [frame, setFrame] = useState(null);
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({
    cement_mixer: 0,
    excavator: 0,
    roller_compactor: 0,
    tower_crane: 0,
    dump_truck: 0,
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const bgCheckTimeoutRef = useRef(null);
  const timeoutRef = useRef(null);
  const frameTimeoutRef = useRef(null);
  const isIntentionalDisconnectRef = useRef(false);
  const isMountedRef = useRef(true);

  const connect = useCallback(function doConnect() {
    if (!rtspUrl) {
      setError("RTSP URL is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    isIntentionalDisconnectRef.current = false;
    isMountedRef.current = true;

    const defaultWs = API_CONFIG.DEFAULT_WS_URL || "ws://110.227.253.23:8081/live/ws";
    const pythonHost = API_CONFIG.HEAVY_VEHICLE_HOST || "110.227.253.23";
    const serviceConfig = API_CONFIG.HEAVY_VEHICLE_SERVICES?.[selectedVehicleType];

    let primaryWsUrl;
    if (serviceConfig) {
      primaryWsUrl = `ws://${pythonHost}:${serviceConfig.port}${serviceConfig.wsPath}?rtsp_url=${encodeURIComponent(rtspUrl)}`;
    } else if (cameraWsUrl) {
      // Use camera's pre-resolved ws_url (active feature WS or default WS)
      const sep = cameraWsUrl.includes("?") ? "&" : "?";
      primaryWsUrl = `${cameraWsUrl}${sep}rtsp_url=${encodeURIComponent(rtspUrl)}&gate_y=${gateY}&confidence=${confidence}`;
    } else {
      // For in/out counting: use the vehicle WS service as primary
      const vehicleWsBase = API_CONFIG.WS_URL;
      if (vehicleWsBase) {
        primaryWsUrl = `${vehicleWsBase}/ws?rtsp_url=${encodeURIComponent(rtspUrl)}&gate_y=${gateY}&confidence=${confidence}`;
      } else {
        primaryWsUrl = null; // Will go straight to default
      }
    }

    const fallbackWsUrl = `${defaultWs}?rtsp_url=${encodeURIComponent(rtspUrl)}`;
    const targetPrimaryUrl = primaryWsUrl || fallbackWsUrl;

    let fallbackActive = false;
    let primaryRetries = 0;
    const MAX_PRIMARY_RETRIES = 3;

    const clearFrameTimeout = () => {
      if (frameTimeoutRef.current) { clearTimeout(frameTimeoutRef.current); frameTimeoutRef.current = null; }
    };
    
    const cleanupWs = () => {
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };

    const startBackgroundCheck = () => {
      if (!targetPrimaryUrl || targetPrimaryUrl === fallbackWsUrl) return;
      if (bgCheckTimeoutRef.current) clearInterval(bgCheckTimeoutRef.current);
      bgCheckTimeoutRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        console.log(`[VehicleCounter] Background check pinging primary WS...`);
        const testWs = new WebSocket(targetPrimaryUrl);
        testWs.onopen = () => {
          console.log(`[VehicleCounter] Primary WS is back! Switching from fallback...`);
          testWs.close();
          clearInterval(bgCheckTimeoutRef.current);
          bgCheckTimeoutRef.current = null;
          fallbackActive = false;
          primaryRetries = 0;
          connectToUrl(targetPrimaryUrl);
        };
        testWs.onerror = () => testWs.close();
      }, 10000);
    };

    const handleConnectionFailure = (failedUrl) => {
      if (!isMountedRef.current || isIntentionalDisconnectRef.current) return;
      cleanupWs();
      clearFrameTimeout();
      setIsConnected(false);
      setIsLoading(false);

      if (failedUrl === targetPrimaryUrl && targetPrimaryUrl !== fallbackWsUrl) {
        if (primaryRetries < MAX_PRIMARY_RETRIES) {
          primaryRetries++;
          console.log(`[VehicleCounter] Primary WS failed. Retrying (${primaryRetries}/${MAX_PRIMARY_RETRIES})...`);
          timeoutRef.current = setTimeout(() => { if (isMountedRef.current) connectToUrl(targetPrimaryUrl); }, 2000);
        } else {
          console.log(`[VehicleCounter] Primary WS max retries reached. Switching to fallback...`);
          fallbackActive = true;
          connectToUrl(fallbackWsUrl);
        }
      } else {
        console.log(`[VehicleCounter] WS failed. Retrying...`);
        timeoutRef.current = setTimeout(() => { if (isMountedRef.current) connectToUrl(failedUrl); }, 5000);
      }
    };

    const connectToUrl = (targetUrl) => {
      if (!isMountedRef.current || !targetUrl) return;
      cleanupWs();
      
      const isFallbackConnection = targetUrl === fallbackWsUrl && targetPrimaryUrl !== fallbackWsUrl;
      if (!isFallbackConnection) {
        setIsConnected(false);
        setIsLoading(true);
      }
      setError(null);

      try {
        console.log("Connecting to Vehicle WebSocket:", targetUrl);
        const ws = new WebSocket(targetUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMountedRef.current || ws !== wsRef.current) return;
          setIsConnected(true);
          setIsLoading(false);
          console.log("Vehicle WS connected:", targetUrl);
          
          if (isFallbackConnection) startBackgroundCheck();

          clearFrameTimeout();
          frameTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current || ws !== wsRef.current) return;
            handleConnectionFailure(targetUrl);
          }, 8000);
        };

        ws.onmessage = (event) => {
          if (!isMountedRef.current || ws !== wsRef.current) return;
          let handled = false;

          if (typeof event.data === "string") {
            try {
              const data = JSON.parse(event.data);
              if (data.error) { setError(data.error); return; }

              const frameB64 = data.frame || data.image || data.jpeg;
              if (frameB64) {
                clearFrameTimeout();
                const src = frameB64.startsWith("data:") ? frameB64 : `data:image/jpeg;base64,${frameB64}`;
                setFrame(src);
                handled = true;
              }

              if (data.detection) {
                const classesObj = data.detection.classes || {};
                setCounts((prev) => ({ ...prev, ...classesObj, total_count: data.detection.total_count || 0, class_names: data.detection.class_names || [] }));
              } else if (data.counts) {
                setCounts((prev) => ({ ...prev, ...data.counts }));
              }

              if (data.new_events && data.new_events.length > 0) {
                setEvents((prev) => [...data.new_events, ...prev]);
              }
            } catch (err) {}
          }

          if (!handled && event.data instanceof Blob) {
            clearFrameTimeout();
            const reader = new FileReader();
            reader.onload = () => { if (isMountedRef.current) setFrame(reader.result); };
            reader.readAsDataURL(event.data);
          } else if (!handled && event.data instanceof ArrayBuffer) {
            clearFrameTimeout();
            const blob = new Blob([event.data], { type: "image/jpeg" });
            setFrame(URL.createObjectURL(blob));
          }
        };

        ws.onclose = () => {
          if (!isMountedRef.current || ws !== wsRef.current || isIntentionalDisconnectRef.current) return;
          handleConnectionFailure(targetUrl);
        };

        ws.onerror = () => {
          if (!isMountedRef.current || ws !== wsRef.current) return;
          handleConnectionFailure(targetUrl);
        };
      } catch (err) {
        handleConnectionFailure(targetUrl);
      }
    };

    connectToUrl(targetPrimaryUrl);
  }, [rtspUrl, gateY, confidence, selectedVehicleType, cameraWsUrl]);


  const disconnect = useCallback(() => {
    isIntentionalDisconnectRef.current = true;
    isMountedRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (frameTimeoutRef.current) {
      clearTimeout(frameTimeoutRef.current);
    }
    if (bgCheckTimeoutRef.current) {
      clearInterval(bgCheckTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setFrame(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
      if (bgCheckTimeoutRef.current) clearInterval(bgCheckTimeoutRef.current);
    };
  }, []);

  return {
    isConnected,
    isLoading,
    frame,
    counts,
    events,
    error,
    connect,
    disconnect,
    getTotal: (vehicle) => {
      return (counts[`${vehicle}_in`] || 0) + (counts[`${vehicle}_out`] || 0);
    },
    getGrandTotal: () => {
      return Object.values(counts).reduce((a, b) => (typeof b === "number" ? a + b : a), 0);
    },
  };
};

export default useVehicleCounter;
