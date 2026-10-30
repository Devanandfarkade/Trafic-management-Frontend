import { pool } from "../config/db.js";

// Helper to get date ranges
function getDateRange(rangeStr) {
  const days = rangeStr === '30d' ? 30 : rangeStr === '90d' ? 90 : 7;
  return days;
}

export async function getAnalyticsData(range = '7d') {
  const days = getDateRange(range);
  
  // We need to fetch data for current period and previous period (for trend calculation)
  // Current Period: NOW() - X days
  // Previous Period: NOW() - 2X days to NOW() - X days

  // 1. Pie Chart Data (Totals by Type for Current Period)
  const pieQuery = `
    SELECT 'No Parking' as name, COUNT(*) as count FROM no_parking_violations WHERE detected_at >= NOW() - INTERVAL '${days} days'
    UNION ALL
    SELECT 'Heavy Vehicle' as name, COUNT(*) as count FROM heavy_vehicle_violations WHERE detected_at >= NOW() - INTERVAL '${days} days'
    UNION ALL
    SELECT 'Accidents' as name, COUNT(*) as count FROM incidents WHERE detected_at >= NOW() - INTERVAL '${days} days'
  `;

  // 2. Hotspots (Group by location for Current Period)
  const hotspotsQuery = `
    SELECT location_name as loc, SUM(count) as count FROM (
      SELECT COALESCE(location, 'Unknown') as location_name, COUNT(*) as count FROM no_parking_violations WHERE detected_at >= NOW() - INTERVAL '${days} days' GROUP BY 1
      UNION ALL
      SELECT COALESCE(loc.name, 'Unknown') as location_name, COUNT(*) as count 
      FROM heavy_vehicle_violations hvv
      LEFT JOIN locations loc ON hvv.location_id = loc.location_id
      WHERE hvv.detected_at >= NOW() - INTERVAL '${days} days' GROUP BY 1
      UNION ALL
      SELECT COALESCE(loc.name, 'Unknown') as location_name, COUNT(*) as count 
      FROM incidents i
      LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
      LEFT JOIN locations loc ON cam.location_id = loc.location_id
      WHERE i.detected_at >= NOW() - INTERVAL '${days} days' 
      GROUP BY 1
    ) combined
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 5
  `;

  // Previous period hotspots for trend
  const prevHotspotsQuery = `
    SELECT location_name as loc, SUM(count) as count FROM (
      SELECT COALESCE(location, 'Unknown') as location_name, COUNT(*) as count FROM no_parking_violations WHERE detected_at >= NOW() - INTERVAL '${days * 2} days' AND detected_at < NOW() - INTERVAL '${days} days' GROUP BY 1
      UNION ALL
      SELECT COALESCE(loc.name, 'Unknown') as location_name, COUNT(*) as count 
      FROM heavy_vehicle_violations hvv
      LEFT JOIN locations loc ON hvv.location_id = loc.location_id
      WHERE hvv.detected_at >= NOW() - INTERVAL '${days * 2} days' AND hvv.detected_at < NOW() - INTERVAL '${days} days' GROUP BY 1
      UNION ALL
      SELECT COALESCE(loc.name, 'Unknown') as location_name, COUNT(*) as count 
      FROM incidents i
      LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
      LEFT JOIN locations loc ON cam.location_id = loc.location_id
      WHERE i.detected_at >= NOW() - INTERVAL '${days * 2} days' AND i.detected_at < NOW() - INTERVAL '${days} days'
      GROUP BY 1
    ) combined
    GROUP BY 1
  `;

  // 3. Bar Chart Data (Group by date truncation)
  let trunc = 'day';
  if (days === 30) trunc = 'week';
  if (days === 90) trunc = 'month';

  // To make bar data look good, we can just group by date
  const barQuery = `
    SELECT date_trunc('day', time)::date as period, COUNT(*) as count
    FROM (
      SELECT detected_at as time FROM no_parking_violations WHERE detected_at >= NOW() - INTERVAL '${days} days'
      UNION ALL
      SELECT detected_at as time FROM heavy_vehicle_violations WHERE detected_at >= NOW() - INTERVAL '${days} days'
      UNION ALL
      SELECT detected_at as time FROM incidents WHERE detected_at >= NOW() - INTERVAL '${days} days'
    ) combined
    GROUP BY period
    ORDER BY period ASC
  `;

  try {
    const [pieRes, hotspotsRes, prevHotspotsRes, barRes] = await Promise.all([
      pool.query(pieQuery),
      pool.query(hotspotsQuery),
      pool.query(prevHotspotsQuery),
      pool.query(barQuery)
    ]);

    return {
      pieData: pieRes.rows,
      hotspotsData: hotspotsRes.rows,
      prevHotspotsData: prevHotspotsRes.rows,
      barData: barRes.rows,
      days
    };
  } catch (err) {
    console.error("Error in getAnalyticsData (trying fallback):", err.message);
    
    // Fallback queries without heavy_vehicle_violations
    const fallbackPieQuery = `
      SELECT 'No Parking' as name, COUNT(*) as count FROM no_parking_violations WHERE detected_at >= NOW() - INTERVAL '${days} days'
      UNION ALL
      SELECT 'Accidents' as name, COUNT(*) as count FROM incidents WHERE detected_at >= NOW() - INTERVAL '${days} days'
    `;

    const fallbackHotspotsQuery = `
      SELECT location_name as loc, SUM(count) as count FROM (
        SELECT COALESCE(location, 'Unknown') as location_name, COUNT(*) as count FROM no_parking_violations WHERE detected_at >= NOW() - INTERVAL '${days} days' GROUP BY 1
        UNION ALL
        SELECT COALESCE(loc.name, 'Unknown') as location_name, COUNT(*) as count 
        FROM incidents i
        LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
        LEFT JOIN locations loc ON cam.location_id = loc.location_id
        WHERE i.detected_at >= NOW() - INTERVAL '${days} days' 
        GROUP BY 1
      ) combined
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 5
    `;

    const fallbackPrevHotspotsQuery = `
      SELECT location_name as loc, SUM(count) as count FROM (
        SELECT COALESCE(location, 'Unknown') as location_name, COUNT(*) as count FROM no_parking_violations WHERE detected_at >= NOW() - INTERVAL '${days * 2} days' AND detected_at < NOW() - INTERVAL '${days} days' GROUP BY 1
        UNION ALL
        SELECT COALESCE(loc.name, 'Unknown') as location_name, COUNT(*) as count 
        FROM incidents i
        LEFT JOIN cameras cam ON i.camera_id = cam.camera_id
        LEFT JOIN locations loc ON cam.location_id = loc.location_id
        WHERE i.detected_at >= NOW() - INTERVAL '${days * 2} days' AND i.detected_at < NOW() - INTERVAL '${days} days'
        GROUP BY 1
      ) combined
      GROUP BY 1
    `;

    const fallbackBarQuery = `
      SELECT date_trunc('day', time)::date as period, COUNT(*) as count
      FROM (
        SELECT detected_at as time FROM no_parking_violations WHERE detected_at >= NOW() - INTERVAL '${days} days'
        UNION ALL
        SELECT detected_at as time FROM incidents WHERE detected_at >= NOW() - INTERVAL '${days} days'
      ) combined
      GROUP BY period
      ORDER BY period ASC
    `;

    try {
      const [pieRes, hotspotsRes, prevHotspotsRes, barRes] = await Promise.all([
        pool.query(fallbackPieQuery),
        pool.query(fallbackHotspotsQuery),
        pool.query(fallbackPrevHotspotsQuery),
        pool.query(fallbackBarQuery)
      ]);

      return {
        pieData: pieRes.rows,
        hotspotsData: hotspotsRes.rows,
        prevHotspotsData: prevHotspotsRes.rows,
        barData: barRes.rows,
        days
      };
    } catch (fallbackErr) {
      console.error("Fallback failed:", fallbackErr.message);
      throw fallbackErr;
    }
  }
}
