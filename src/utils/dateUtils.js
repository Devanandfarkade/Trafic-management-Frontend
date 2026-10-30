/**
 * Utility to convert any Date or timestamp string into Indian Standard Time (IST, UTC+05:30)
 * Returns ISO-like IST string: "YYYY-MM-DDTHH:mm:ss.sss"
 */
export function getISTTimestamp(inputDate) {
  if (!inputDate) {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${formatter.format(d).replace(" ", "T")}.${ms}`;
  }

  // If inputDate is numeric string or number or ISO string
  const d = new Date(inputDate);
  if (isNaN(d.getTime())) {
    // If input is already formatted string like "2026-09-10 19:45:00", return as is
    return String(inputDate);
  }

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${formatter.format(d).replace(" ", "T")}.${ms}`;
}

/**
 * Returns current date in IST formatted as YYYY-MM-DD
 */
export function getISTDate(inputDate) {
  const d = inputDate ? new Date(inputDate) : new Date();
  const valid = !isNaN(d.getTime()) ? d : new Date();
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(valid);
}
