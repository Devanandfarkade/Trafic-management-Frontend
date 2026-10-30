import { getAlerts as getAlertsFromDb } from "../models/alertModel.js";

export const getAlerts = async (options = {}) => {
  const alerts = await getAlertsFromDb(typeof options === 'number' ? { limit: options } : options);
  
  // Format date & times for frontend
  return alerts.map(alert => {
    const rawDate = alert.time ? new Date(alert.time) : null;
    const isValidDate = rawDate && !isNaN(rawDate.getTime());
    return {
      id: alert.id,
      type: alert.type,
      loc: alert.loc,
      date: isValidDate ? rawDate.toLocaleDateString('en-CA') : (alert.date || 'N/A'), // YYYY-MM-DD
      time: isValidDate ? rawDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : (alert.time || 'N/A'),
      severity: formatSeverity(alert.severity),
      status: formatStatus(alert.status),
      image: alert.image || null
    };
  });
};



// Ensure consistent capitalization for frontend styling
function formatSeverity(sev) {
  if (!sev) return "Medium";
  const s = sev.toUpperCase();
  if (s.includes('CRITICAL') || s.includes('SEVERE')) return 'Critical';
  if (s.includes('HIGH') || s.includes('MAJOR')) return 'High';
  if (s.includes('LOW') || s.includes('MINOR')) return 'Low';
  return 'Medium';
}

function formatStatus(status) {
  if (!status) return "Open";
  const s = status.toUpperCase();
  if (s.includes('RESOLV')) return 'Resolved';
  if (s.includes('DISPATCH')) return 'Dispatch';
  if (s.includes('TICKET')) return 'Ticketed';
  return 'Open';
}
