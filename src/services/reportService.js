import * as reportModel from "../models/reportModel.js";

/* ============================================================
 * REPORT SERVICE
 * Business logic layer for Reports module
 * ============================================================ */

/**
 * Fetch report list based on module and parameters
 */
export async function getReports({ module = "no_parking", startDate, endDate, search, page = 1, limit = 1000 } = {}) {
  const normModule = (module || "no_parking").toLowerCase().trim();
  const options = { startDate, endDate, search, page, limit };

  if (normModule === "no_parking") {
    const result = await reportModel.getNoParkingReports(options);
    return {
      success: true,
      module: "no_parking",
      count: result.rows.length,
      total: result.total,
      violations: result.rows,
      data: result.rows,
    };
  }

  if (normModule === "in_out" || normModule === "in-out") {
    const result = await reportModel.getInOutReports(options);
    return {
      success: true,
      module: "in_out",
      count: result.rows.length,
      total: result.total,
      events: result.rows,
      data: result.rows,
    };
  }

  if (normModule === "incident" || normModule === "ai_incident" || normModule === "ai-incident") {
    const result = await reportModel.getIncidentReports(options);
    return {
      success: true,
      module: "incident",
      count: result.rows.length,
      total: result.total,
      incidents: result.rows,
      data: result.rows,
    };
  }

  if (normModule === "heavy_vehicle" || normModule === "heavy-vehicle") {
    const result = await reportModel.getHeavyVehicleReports(options);
    return {
      success: true,
      module: "heavy_vehicle",
      count: result.rows.length,
      total: result.total,
      rows: result.rows,
      data: result.rows,
    };
  }

  // Aggregate default (if module='all')
  const [noParking, inOut, incident, heavyVehicle] = await Promise.all([
    reportModel.getNoParkingReports(options),
    reportModel.getInOutReports(options),
    reportModel.getIncidentReports(options),
    reportModel.getHeavyVehicleReports(options),
  ]);

  const aggregated = [
    ...noParking.rows.map((r) => ({ ...r, _module: "no_parking" })),
    ...inOut.rows.map((r) => ({ ...r, _module: "in_out" })),
    ...incident.rows.map((r) => ({ ...r, _module: "incident" })),
    ...heavyVehicle.rows.map((r) => ({ ...r, _module: "heavy_vehicle" })),
  ];

  return {
    success: true,
    module: "all",
    count: aggregated.length,
    total: noParking.total + inOut.total + incident.total + heavyVehicle.total,
    data: aggregated,
  };
}

/**
 * Fetch detailed record by module and record ID
 */
export async function getReportById(module, id) {
  const normModule = (module || "").toLowerCase().trim();

  if (normModule === "no_parking" || normModule === "no-parking") {
    const record = await reportModel.getNoParkingReportById(id);
    return { success: !!record, module: "no_parking", data: record };
  }

  if (normModule === "in_out" || normModule === "in-out") {
    const record = await reportModel.getInOutReportById(id);
    return { success: !!record, module: "in_out", data: record };
  }

  if (normModule === "incident" || normModule === "ai_incident" || normModule === "ai-incident") {
    const record = await reportModel.getIncidentReportById(id);
    return { success: !!record, module: "incident", data: record };
  }

  if (normModule === "heavy_vehicle" || normModule === "heavy-vehicle") {
    const record = await reportModel.getHeavyVehicleReportById(id);
    return { success: !!record, module: "heavy_vehicle", data: record };
  }

  return { success: false, message: `Unknown module: ${module}` };
}

/**
 * Fetch summary statistics across all modules
 */
export async function getReportStats({ startDate, endDate } = {}) {
  const stats = await reportModel.getReportSummaryStats({ startDate, endDate });
  return {
    success: true,
    stats,
  };
}
