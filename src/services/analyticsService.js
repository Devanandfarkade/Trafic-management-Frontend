import { getAnalyticsData as getAnalyticsDataFromDb } from "../models/analyticsModel.js";

const COLORS = {
  'No Parking': '#ef4444',
  'Heavy Vehicle': '#f59e0b',
  'Accidents': '#3b82f6',
  'Unknown': '#8b5cf6'
};

export const getAnalyticsData = async (range) => {
  const data = await getAnalyticsDataFromDb(range);

  // 1. Process Pie Data
  let totalViolations = 0;
  data.pieData.forEach(item => { totalViolations += parseInt(item.count || 0); });

  const pieData = data.pieData.map(item => {
    const count = parseInt(item.count || 0);
    return {
      name: item.name,
      count,
      percentage: totalViolations > 0 ? Math.round((count / totalViolations) * 100) : 0,
      color: COLORS[item.name] || COLORS['Unknown']
    };
  }).filter(item => item.count > 0);

  // 2. Process Hotspots & Calculate Trends
  const prevMap = {};
  data.prevHotspotsData.forEach(item => { prevMap[item.loc] = parseInt(item.count || 0); });

  const hotspots = data.hotspotsData.map(item => {
    const curr = parseInt(item.count || 0);
    const prev = prevMap[item.loc] || 0;

    let trendStr = '0%';
    if (prev > 0) {
      const diff = curr - prev;
      const pct = Math.round((diff / prev) * 100);
      trendStr = pct > 0 ? `+${pct}%` : `${pct}%`;
    } else if (curr > 0) {
      trendStr = '+100%';
    }

    return {
      loc: item.loc,
      count: curr,
      trend: trendStr
    };
  });

  // 3. Process Bar Data (Format dates)
  let barData = [];
  if (range === '7d') {
    const countsByDateStr = {};
    data.barData.forEach(item => {
      if (item.period) {
        // item.period is the parsed Date from pg (at local midnight, e.g., Wed Oct 07 2026 00:00:00 GMT+0530)
        const d = new Date(item.period);
        // We MUST use local date methods because node-postgres parses DATE to local midnight. 
        // toISOString() would shift it to UTC, which subtracts the timezone offset and can cause a -1 day shift.
        const year = d.getFullYear();
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`; 
        countsByDateStr[dateStr] = parseInt(item.count || 0);
      }
    });

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      
      const year = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`; // Local date string
      
      const formatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      barData.push({
        month: formatted,
        count: countsByDateStr[dateStr] || 0
      });
    }
  } else {
    barData = data.barData.map(item => {
      const dateObj = new Date(item.period);
      let formatted = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return {
        month: formatted,
        count: parseInt(item.count || 0)
      };
    });

    if (barData.length === 0) {
      barData.push({ month: 'No Data', count: 0 });
    }
  }

  // 4. Generate basic insights
  const insights = [];
  const currTotal = totalViolations;
  let prevTotal = 0;
  data.prevHotspotsData.forEach(item => { prevTotal += parseInt(item.count || 0); });

  if (prevTotal > 0) {
    const diff = currTotal - prevTotal;
    const pct = Math.round(Math.abs(diff) / prevTotal * 100);
    if (diff > 0) {
      insights.push({
        title: `${pct}% Increase in Violations`,
        desc: `Compared to previous ${data.days} days.`,
        icon: 'TrendingUp',
        color: 'text-red-500',
        isPositive: false
      });
    } else if (diff < 0) {
      insights.push({
        title: `${pct}% Decrease in Violations`,
        desc: `Compared to previous ${data.days} days.`,
        icon: 'TrendingDown',
        color: 'text-green-500',
        isPositive: true
      });
    } else {
      insights.push({
        title: `Violations remain steady`,
        desc: `No change compared to previous ${data.days} days.`,
        icon: 'TrendingUp',
        color: 'text-blue-500',
        isPositive: true
      });
    }
  } else if (currTotal > 0) {
    insights.push({
      title: 'New Violations Detected',
      desc: `${currTotal} violations in the last ${data.days} days.`,
      icon: 'AlertOctagon',
      color: 'text-orange-500',
      isPositive: false
    });
  } else {
    insights.push({
      title: 'No Data',
      desc: 'No violations detected in this period.',
      icon: 'AlertOctagon',
      color: 'text-gray-500',
      isPositive: true
    });
  }

  return {
    label: `Last ${data.days} Days`,
    barData,
    pieData,
    hotspots,
    insights
  };
};
