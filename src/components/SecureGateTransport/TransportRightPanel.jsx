import React from 'react';
import { ScanLine, Clock } from 'lucide-react';

export default function TransportRightPanel({
  themeUtils,
  detections,
  error
}) {
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor('card');
  const textSecondary = themeUtils.getTextColor(false);

  return (
    <div className="h-full flex flex-col p-4 rounded-xl border gap-4" style={{ backgroundColor: cardBg, borderColor }}>
      <div className="flex justify-between items-end border-b pb-3" style={{ borderColor }}>
        <h3 className="font-medium tracking-wide">Recent Detections</h3>
        <span className="text-xs px-2 py-1 bg-black/10 rounded-full border" style={{ borderColor, color: textSecondary }}>
          {detections.length} recorded
        </span>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3">
        {detections.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
            <ScanLine size={48} className="mb-4" />
            <p className="text-sm">No recent detections yet.</p>
          </div>
        ) : (
          detections.map((det, index) => (
            <div
              key={det.detection_id || index}
              className="flex justify-between items-center p-3 rounded-lg border bg-black/10 hover:bg-black/20 transition-colors group"
              style={{ borderColor }}
            >
              <div className="flex items-center gap-4">
                {/* Small preview if image exists */}
                {det.plate_image ? (
                  <div className="w-12 h-8 rounded border overflow-hidden flex items-center justify-center bg-black/30" style={{ borderColor }}>
                    <img
                      src={det.plate_image.startsWith('http') || det.plate_image.startsWith('data:') ? det.plate_image : `data:image/jpeg;base64,${det.plate_image}`}
                      alt="Plate"
                      className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-8 rounded border flex items-center justify-center bg-black/30 opacity-50" style={{ borderColor }}>
                    <ScanLine size={14} />
                  </div>
                )}

                <div className="flex flex-col">
                  <span className="font-mono font-medium tracking-widest text-blue-400 group-hover:text-blue-300 transition-colors">
                    {det.plate}
                  </span>
                  <span className="text-[10px] uppercase opacity-70" style={{ color: textSecondary }}>
                    CONF: {((parseFloat(det.confidence || 0) <= 1 ? parseFloat(det.confidence || 0) * 100 : parseFloat(det.confidence || 0))).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-xs opacity-80 font-medium">
                  {new Date(det.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="text-[10px] flex items-center gap-1 opacity-50 mt-1" style={{ color: textSecondary }}>
                  <Clock size={10} /> {new Date(det.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
