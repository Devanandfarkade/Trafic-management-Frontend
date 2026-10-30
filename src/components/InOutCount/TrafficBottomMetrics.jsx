import React from 'react';
import { Activity, Car, Bike, Truck, Bus } from 'lucide-react';
import { useTheme } from '../../ui/Settings/themeUtils';
import BottomStatCard from '../../ui/common/BottomStatCard';

export default function TrafficBottomMetrics({ themeUtils, counts, totalIn, totalOut }) {
  const { theme } = useTheme();

  return (
    <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
      <BottomStatCard 
        title="TOTAL VEHICLES" 
        value={totalIn + totalOut} 
        icon={<Activity className="w-5 h-5 text-blue-500" />} 
      />
      <BottomStatCard 
        title="CAR" 
        value={(counts?.car_in || 0) + (counts?.car_out || 0)} 
        icon={<Car className="w-5 h-5 text-blue-500" />} 
      />
      <BottomStatCard 
        title="BIKE" 
        value={(counts?.bike_in || 0) + (counts?.bike_out || 0)} 
        icon={<Bike className="w-5 h-5 text-green-500" />} 
      />
      <BottomStatCard 
        title="TRUCK" 
        value={(counts?.truck_in || 0) + (counts?.truck_out || 0)} 
        icon={<Truck className="w-5 h-5 text-yellow-500" />} 
      />
      <BottomStatCard 
        title="BUS" 
        value={(counts?.bus_in || 0) + (counts?.bus_out || 0)} 
        icon={<Bus className="w-5 h-5 text-purple-500" />} 
      />
      <BottomStatCard 
        title="AUTO RICKSHAW" 
        value={(counts?.auto_in || counts?.rickshaw_in || 0) + (counts?.auto_out || counts?.rickshaw_out || 0)} 
        icon={<Activity className="w-5 h-5 text-amber-500" />} 
      />
      <BottomStatCard 
        title="OTHER" 
        value={(counts?.other_in || 0) + (counts?.other_out || 0)} 
        icon={<Activity className="w-5 h-5 text-cyan-500" />} 
      />
    </div>
  );
}
