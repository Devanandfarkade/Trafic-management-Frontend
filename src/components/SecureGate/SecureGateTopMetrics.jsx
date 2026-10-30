import React from 'react';
import { Users, UserCheck, UserPlus } from 'lucide-react';

export default function SecureGateTopMetrics({ themeUtils, detections = [] }) {
  // Calculate current stats from live detections
  const recognizedCount = detections.filter(d => d.status === 'RECOGNIZED').length;
  const registeringCount = detections.filter(d => d.status === 'COLLECTING' || d.status === 'NEW_REGISTERED').length;
  const totalCount = detections.length;

  const MetricCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div 
      className="flex-1 rounded-xl border p-4 flex items-center justify-between shadow-sm"
      style={{ 
        backgroundColor: themeUtils.getBgColor('card'),
        borderColor: themeUtils.getBorderColor() 
      }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl font-black">{value}</h2>
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
        title="Total in Frame"
        value={totalCount}
        icon={Users}
        colorClass="text-blue-500"
        bgClass="bg-blue-500/10"
      />
      <MetricCard
        title="Recognized"
        value={recognizedCount}
        icon={UserCheck}
        colorClass="text-green-500"
        bgClass="bg-green-500/10"
      />
      <MetricCard
        title="Registering/New"
        value={registeringCount}
        icon={UserPlus}
        colorClass="text-yellow-500"
        bgClass="bg-yellow-500/10"
      />
    </div>
  );
}
