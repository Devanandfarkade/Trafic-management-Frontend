/**
 * Returns today's date in local 'YYYY-MM-DD' format.
 */
export const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Extracts 'YYYY-MM-DD' in local timezone from any timestamp or date string.
 */
export const toLocalDateStr = (val) => {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    if (typeof val === 'string') {
      const part = val.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
    return '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
