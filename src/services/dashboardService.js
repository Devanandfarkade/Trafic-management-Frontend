import * as DashboardModel from "../models/dashboardModel.js";
import { getISTDate } from "../utils/dateUtils.js";

/* ============================================================
 * DASHBOARD SERVICE
 * Provides metrics for dashboard cards and overviews
 * ============================================================ */

function resolveDates(date, from_date, to_date) {
  let fromDate = from_date || date;
  let toDate = to_date || date;

  if (date === "all" || from_date === "all" || to_date === "all") {
    return { fromDate: null, toDate: null };
  }

  if (!fromDate && !toDate) {
    fromDate = getISTDate();
    toDate = getISTDate();
  } else if (fromDate && !toDate) {
    toDate = fromDate;
  } else if (!fromDate && toDate) {
    fromDate = toDate;
  }

  return { fromDate, toDate };
}

export async function getStats(date, from_date, to_date, zoneId = null, locationId = null, cameraId = null) {
  const { fromDate, toDate } = resolveDates(date, from_date, to_date);
  const raw = await DashboardModel.getDashboardStats(fromDate, toDate, zoneId, locationId, cameraId);

  const totalIn = parseInt(raw.inOut.total_in || 0, 10);
  const totalOut = parseInt(raw.inOut.total_out || 0, 10);
  const totalVehicles = parseInt(raw.inOut.total || (totalIn + totalOut), 10);

  const totalViolations = parseInt(raw.violations.total || 0, 10);
  const pendingViolations = parseInt(raw.violations.pending || 0, 10);
  const resolvedViolations = parseInt(raw.violations.resolved || 0, 10);
  const rejectedViolations = parseInt(raw.violations.rejected || 0, 10);

  const totalCameras = parseInt(raw.cameras.total || 0, 10);
  const activeCameras = parseInt(raw.cameras.active || 0, 10);
  const inactiveCameras = parseInt(raw.cameras.inactive || 0, 10);

  return {
    success: true,
    fromDate,
    toDate,
    stats: {
      vehicles_detected: {
        total: totalVehicles,
        total_in: totalIn,
        total_out: totalOut,
      },
      violations_today: {
        total: totalViolations,
        pending: pendingViolations,
        resolved: resolvedViolations,
        rejected: rejectedViolations,
      },
      cameras: {
        total: totalCameras,
        active: activeCameras,
        inactive: inactiveCameras,
        active_today: raw.activeCamerasToday,
      },
      heavy_vehicles_today: {
        total: parseInt(raw.heavyVehicles.total || 0, 10),
        detected: parseInt(raw.heavyVehicles.detected || 0, 10),
        resolved: parseInt(raw.heavyVehicles.resolved || 0, 10),
      },
      alerts_today: {
        total: parseInt(raw.alertsToday || 0, 10),
      },
    },
  };
}

/* ============================================================
 * IN/OUT VEHICLE COUNT SUMMARY
 * ============================================================ */
export async function getInOutSummary(date, from_date, to_date, zoneId = null, locationId = null, cameraId = null) {
  const { fromDate, toDate } = resolveDates(date, from_date, to_date);
  const { rows, totals } = await DashboardModel.getDashboardInOutSummary(fromDate, toDate, zoneId, locationId, cameraId);

  const colors = {
    Car: '#3b82f6',
    Bike: '#10b981',
    Bus: '#8b5cf6',
    Truck: '#f59e0b',
  };

  const counts = {
    Car: { inCount: 0, outCount: 0, count: 0, color: colors.Car },
    Bike: { inCount: 0, outCount: 0, count: 0, color: colors.Bike },
    Bus: { inCount: 0, outCount: 0, count: 0, color: colors.Bus },
    Truck: { inCount: 0, outCount: 0, count: 0, color: colors.Truck },
  };

  rows.forEach((row) => {
    const rawType = (row.vehicle_type || '').toLowerCase();
    const dir = (row.direction || '').toLowerCase();
    const c = parseInt(row.count || 0, 10);

    let key = 'Car';
    if (rawType.includes('bike') || rawType.includes('motor') || rawType.includes('scooter')) key = 'Bike';
    else if (rawType.includes('bus')) key = 'Bus';
    else if (rawType.includes('truck') || rawType.includes('heavy') || rawType.includes('trailer')) key = 'Truck';

    if (dir === 'in') {
      counts[key].inCount += c;
    } else if (dir === 'out') {
      counts[key].outCount += c;
    }
    counts[key].count += c;
  });

  const totalIn = parseInt(totals.total_in || 0, 10);
  const totalOut = parseInt(totals.total_out || 0, 10);
  const total = parseInt(totals.total || (totalIn + totalOut), 10);

  const items = Object.entries(counts).map(([name, data]) => ({
    name,
    inCount: data.inCount,
    outCount: data.outCount,
    count: data.count,
    percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
    color: data.color,
  }));

  return {
    success: true,
    fromDate,
    toDate,
    total,
    totalIn,
    totalOut,
    items,
  };
}

/* ============================================================
 * HEAVY VEHICLE DETECTIONS OVERVIEW
 * ============================================================ */
export async function getHeavyVehicleSummary(date, from_date, to_date, zoneId = null, locationId = null, cameraId = null) {
  const { fromDate, toDate } = resolveDates(date, from_date, to_date);
  const { rows, total } = await DashboardModel.getDashboardHeavyVehicleSummary(fromDate, toDate, zoneId, locationId, cameraId);

  const colors = {
    'CEMENT MIXER': '#3b82f6',
    'EXCAVATOR': '#ec4899',
    'ROLLER COMPACTOR': '#22c55e',
    'TOWER CRANE': '#eab308',
    'DUMP TRUCK': '#f97316',
  };

  const counts = {
    'CEMENT MIXER': 0,
    'EXCAVATOR': 0,
    'ROLLER COMPACTOR': 0,
    'TOWER CRANE': 0,
    'DUMP TRUCK': 0,
  };

  rows.forEach((row) => {
    const rawType = (row.vehicle_type || '').toUpperCase().trim();
    const count = parseInt(row.total || 0, 10);

    if (rawType.includes('MIXER') || rawType.includes('CEMENT')) counts['CEMENT MIXER'] += count;
    else if (rawType.includes('EXCAVATOR')) counts['EXCAVATOR'] += count;
    else if (rawType.includes('ROLLER') || rawType.includes('COMPACTOR')) counts['ROLLER COMPACTOR'] += count;
    else if (rawType.includes('CRANE') || rawType.includes('TOWER')) counts['TOWER CRANE'] += count;
    else if (rawType.includes('DUMP') || rawType.includes('TRUCK')) counts['DUMP TRUCK'] += count;
    else counts['DUMP TRUCK'] += count;
  });

  const items = Object.entries(counts).map(([name, count]) => ({
    name,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    color: colors[name],
  }));

  return {
    success: true,
    fromDate,
    toDate,
    total,
    items,
  };
}

/* ============================================================
 * LIVE VIOLATIONS
 * ============================================================ */
export async function getLiveViolations(date, from_date, to_date, limit = 20, zoneId = null, locationId = null, cameraId = null) {
  const { fromDate, toDate } = resolveDates(date, from_date, to_date);
  const violations = await DashboardModel.getDashboardLiveViolations(fromDate, toDate, limit, zoneId, locationId, cameraId);

  return {
    success: true,
    fromDate,
    toDate,
    count: violations.length,
    violations,
  };
}


