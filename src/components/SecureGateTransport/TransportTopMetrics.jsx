import React, { useEffect, useState } from 'react';
import { Database, FileDigit, ScanLine } from 'lucide-react';
import { plateDetectionService } from '../../services/plateDetectionService';

export default function TransportTopMetrics({ themeUtils, streamId }) {
  const [stats, setStats] = useState({
    total: 0,
    frames: 0,
    rate: 0
  });
  const [healthInfo, setHealthInfo] = useState(null);

  useEffect(() => {
    let intervalId;

    const fetchStats = async () => {
      try {
        const data = await plateDetectionService.getActiveStreams();
        if (data && data.streams && streamId && data.streams[streamId]) {
          const streamData = data.streams[streamId];
          setStats({
            total: streamData.detections || 0,
            frames: streamData.total_frames || 0,
            rate: streamData.detection_rate || 0
          });
        }

        const health = await plateDetectionService.getHealthInfo();
        if (health) {
          setHealthInfo(health);
        }
      } catch (err) {
        console.error("Failed to fetch stream stats", err);
      }
    };

    fetchStats();

    // Poll stats every 3 seconds since this is a live stream dashboard
    intervalId = setInterval(fetchStats, 3000);

    return () => clearInterval(intervalId);
  }, [streamId]);

  const MetricCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div
      className="flex-1 rounded-xl border p-4 flex items-center justify-between shadow-sm"
      style={{
        backgroundColor: themeUtils.getBgColor('card'),
        borderColor: themeUtils.getBorderColor()
      }}
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider opacity-70 mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl font-normal">{value}</h2>
        </div>
      </div>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bgClass} ${colorClass}`}>
        <Icon size={20} />
      </div>
    </div>
  );

  return (
    <div className="flex gap-3">
      <MetricCard
        title="Total Detections"
        value={stats.total}
        icon={Database}
        colorClass="text-blue-500"
        bgClass="bg-blue-500/10"
      />
      <MetricCard
        title="Status"
        value={healthInfo ? (healthInfo.status === 'healthy' ? 'ONLINE' : 'ERROR') : 'CONNECTING...'}
        icon={FileDigit}
        colorClass={healthInfo && healthInfo.status === 'healthy' ? "text-purple-500" : "text-yellow-500"}
        bgClass={healthInfo && healthInfo.status === 'healthy' ? "bg-purple-500/10" : "bg-yellow-500/10"}
      />
    </div>
  );
}
