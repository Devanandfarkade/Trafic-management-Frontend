import React from 'react';
import BottomStatCard from '../../ui/common/BottomStatCard';
import { Activity, Truck } from 'lucide-react';

const VEHICLE_TYPES = [
  "cement_mixer",
  "excavator",
  "roller_compactor",
  "tower_crane",
  "dump_truck",
];


export default function CountTopMetrics({ themeUtils, total, counts, classColors }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">

      <BottomStatCard title="TOTAL DETECTED" value={total || 0} icon={<Activity className="w-5 h-5 text-blue-500" />} />
      {VEHICLE_TYPES.map((cls) => {
        const val = (counts && typeof counts[cls] === "number") ? counts[cls] : 0;
        const color = (classColors && classColors[cls]) || "#3b82f6";
        return (
          <BottomStatCard
            key={cls}
            title={cls.toUpperCase().replace("_", " ")}
            value={val}
            icon={<Truck className="w-5 h-5" style={{ color }} />}
          />
        );
      })}
    </div>
  );
}
