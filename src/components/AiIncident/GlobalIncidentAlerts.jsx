import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { API_CONFIG, API_BASE_URL } from '../../../config.js';

export default function GlobalIncidentAlerts() {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const wsRef = useRef(null);
  const seenIncidentIdRef = useRef(new Set(JSON.parse(sessionStorage.getItem('seenGlobalAiIncidents') || '[]')));
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    
    const fetchLatestIncidents = async () => {
      if (!API_BASE_URL || !isMounted) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/ai-incident/incidents?limit=5`);
        const data = await res.json();
        
        if (data.incidents && data.incidents.length > 0) {
          // Process from oldest to newest so they stack correctly
          const recentIncidents = data.incidents.slice(0, 5).reverse();
          
          recentIncidents.forEach(acc => {
            const accId = acc.id || acc.incident_id;
            
            // If it's a very recent incident (within the last 2 minutes) and we haven't seen it
            const detectedTime = new Date(acc.detected_at).getTime();
            const now = Date.now();
            const isRecent = (now - detectedTime) < 120000;
            
            if (accId && !seenIncidentIdRef.current.has(accId) && isRecent) {
              seenIncidentIdRef.current.add(accId);
              sessionStorage.setItem('seenGlobalAiIncidents', JSON.stringify([...seenIncidentIdRef.current]));
              
              const newAlert = {
                id: accId + '-' + Date.now(),
                severity: acc.severity || 'MODERATE',
                vehicles: acc.vehicles_involved || 'N/A',
                time: new Date(acc.detected_at).toLocaleTimeString(),
                raw: acc
              };

              setActiveAlerts(prev => [newAlert, ...prev]);
            }
          });
        }
      } catch (err) {
        // silently ignore fetch errors to prevent console spam
      }
    };

    // Initial fetch
    fetchLatestIncidents();

    // Poll every 3 seconds
    const intervalId = setInterval(fetchLatestIncidents, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const closeAlert = (id) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  };

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
      {activeAlerts.map((alert, index) => (
        <div 
          key={alert.id}
          style={{ zIndex: 9999 + index }}
          className="absolute w-full max-w-md bg-red-600/95 backdrop-blur-md text-white shadow-2xl rounded-xl border-2 border-red-400 p-4 pointer-events-auto flex flex-col gap-3 animate-in zoom-in-95 duration-300"
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <AlertTriangle className="animate-pulse text-yellow-300" size={24} />
              <h3 className="font-bold text-base tracking-widest uppercase text-white drop-shadow-md">AI Incident Detected</h3>
            </div>
            <button 
              onClick={() => closeAlert(alert.id)}
              className="text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-1.5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {alert.raw?.image_path && (
            <div className="w-full h-48 bg-black/40 rounded-lg overflow-hidden border border-red-400/30">
              <img 
                src={`${API_BASE_URL}/${alert.raw.image_path}`} 
                alt="Incident Snapshot" 
                className="w-full h-full object-cover" 
              />
            </div>
          )}
          
          <div className="bg-black/20 rounded-lg p-3 text-sm flex flex-col gap-1.5 border border-red-400/30">
            <div className="flex justify-between">
              <span className="opacity-80 font-semibold">Severity:</span>
              <span className="font-bold text-red-200">{alert.severity}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-80 font-semibold">Zone:</span>
              <span className="font-bold">{alert.raw?.zone || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-80 font-semibold">Location:</span>
              <span className="font-bold">{alert.raw?.location || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-80 font-semibold">Date Detected:</span>
              <span className="font-bold">
                {alert.raw?.detected_at 
                  ? new Date(alert.raw.detected_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) 
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-80 font-semibold">Time:</span>
              <span className="font-bold">{alert.time}</span>
            </div>
          </div>
          
          <button 
            onClick={() => closeAlert(alert.id)}
            className="w-full mt-1 bg-white text-red-600 font-bold py-1.5 rounded-lg text-sm hover:bg-red-50 transition-colors uppercase tracking-wider shadow-sm"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}
