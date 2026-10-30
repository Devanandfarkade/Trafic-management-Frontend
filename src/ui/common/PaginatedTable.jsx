import React, { useState, useMemo } from 'react';
import { useTheme } from '../Settings/themeUtils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';

export default function PaginatedTable({ title, columns, data, itemsPerPage = 5, headerContent, sortable = true }) {
  const { theme, themeUtils } = useTheme();
  const isDark = theme.mode === "Dark";

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(itemsPerPage);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (idx) => {
    if (!sortable) return;
    const col = columns[idx];
    if (col?.sortable === false) return;
    const headerTitle = typeof col === 'object' ? (col.header || col.title) : col;
    if (headerTitle === 'ACTION' || headerTitle === 'ACTIONS' || headerTitle === 'Action' || headerTitle === 'Actions') return;

    setSortConfig(prev => {
      if (prev.key === idx) {
        return { key: idx, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key: idx, direction: 'asc' };
    });
  };

  const sortedData = useMemo(() => {
    if (sortConfig.key === null || !data || data.length === 0) return data || [];
    const col = columns[sortConfig.key];
    const accessor = col?.accessor || col?.key;

    return [...data].sort((a, b) => {
      let valA = accessor ? a[accessor] : '';
      let valB = accessor ? b[accessor] : '';

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      // Number comparison
      if (!isNaN(valA) && !isNaN(valB) && valA !== '' && valB !== '') {
        return sortConfig.direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }

      // Date comparison
      const dateA = new Date(valA);
      const dateB = new Date(valB);
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime()) && typeof valA === 'string' && (valA.includes('-') || valA.includes('/') || valA.includes(':'))) {
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // String comparison
      return sortConfig.direction === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [data, columns, sortConfig]);

  const isAllRecords = !pageSize || pageSize === Infinity || pageSize === "ALL" || pageSize === "all";
  const totalPages = isAllRecords ? 1 : Math.ceil(sortedData.length / pageSize) || 1;
  const currentData = isAllRecords ? sortedData : sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePageSizeChange = (e) => {
    const val = e.target.value;
    if (val === "ALL" || val === "all") {
      setPageSize(Infinity);
    } else {
      setPageSize(Number(val));
    }
    setCurrentPage(1);
  };

  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor?.() || (isDark ? "#1e2a40" : "#e5e7eb");
  const cardBg = themeUtils.getBgColor?.('card') || (isDark ? "#0f1724" : "#ffffff");
  const rowHover = themeUtils.getBgColor?.('hover') || (isDark ? "rgba(255, 255, 255, 0.05)" : "#F3F4F6");
  const headerBgStyle = theme.headerBg?.includes("gradient")
    ? { background: theme.headerBg }
    : { backgroundColor: theme.headerBg || "#3b82f6" };
  const headerTextColor = "#ffffff";

  return (
    <div
      className="border rounded-lg shadow-lg overflow-hidden flex flex-col transition-all duration-300 w-full"
      style={{ backgroundColor: cardBg, borderColor: borderColor }}
    >
      <div className="px-3 py-2 border-b flex flex-wrap gap-3 justify-between items-center bg-black/5 dark:bg-white/5" style={{ borderColor: borderColor }}>
        <h3 className="text-[10px] font-medium tracking-widest uppercase whitespace-nowrap" style={{ color: theme.headerBg || "#3b82f6" }}>
          {title}
        </h3>

        <div className="flex items-center gap-3 ml-auto">
          {headerContent && (
            <div className="flex items-center gap-2">
              {headerContent}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase" style={{ color: textSecondary }}>
            <span>Show:</span>
            <select
              value={isAllRecords ? "ALL" : pageSize}
              onChange={handlePageSizeChange}
              className="px-1.5 py-0.5 rounded border text-[9px] font-bold outline-none cursor-pointer"
              style={{
                backgroundColor: cardBg,
                borderColor: borderColor,
                color: textPrimary
              }}
            >
              <option value="ALL" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">ALL</option>
              <option value={5} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">5</option>
              <option value={10} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">10</option>
              <option value={20} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">20</option>
              <option value={50} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">50</option>
            </select>
          </div>

          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap" style={{ color: textSecondary, borderColor: borderColor }}>
            TOTAL: {data.length}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={headerBgStyle}>
              {columns.map((col, idx) => {
                const headerTitle = typeof col === 'object' ? (col.header || col.title) : col;
                const isSortableCol = sortable && col?.sortable !== false &&
                  headerTitle !== 'ACTION' && headerTitle !== 'ACTIONS' &&
                  headerTitle !== 'Action' && headerTitle !== 'Actions' &&
                  headerTitle !== 'SNAPSHOT' && headerTitle !== 'IMAGE' && headerTitle !== 'PHOTO';
                const isActive = sortConfig.key === idx;

                return (
                  <th
                    key={idx}
                    onClick={() => isSortableCol && handleSort(idx)}
                    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b select-none ${isSortableCol ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                    style={{ color: headerTextColor, borderColor: `${borderColor}40` }}
                  >
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span>{headerTitle}</span>
                      {isSortableCol && (
                        <span className="inline-flex items-center text-[10px] text-white">
                          {!isActive && <FaSort className="opacity-60" />}
                          {isActive && sortConfig.direction === 'asc' && <FaSortUp className="text-white" />}
                          {isActive && sortConfig.direction === 'desc' && <FaSortDown className="text-white" />}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {currentData.length > 0 ? (
              currentData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b last:border-b-0 transition-colors"
                  style={{ borderColor: borderColor }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = rowHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className="px-3 py-1.5 text-[11px] font-normal" style={{ color: textPrimary }}>
                      {col.render ? col.render(row, rowIndex) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-[11px] font-medium" style={{ color: textSecondary }}>
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="px-3 py-2 border-t flex justify-between items-center bg-black/5 dark:bg-white/5" style={{ borderColor: borderColor }}>
        <span className="text-[10px] font-medium uppercase" style={{ color: textSecondary }}>
          {isAllRecords
            ? `Showing all ${data.length} of ${data.length}`
            : `Showing ${(currentPage - 1) * pageSize + (currentData.length > 0 ? 1 : 0)} to ${Math.min(currentPage * pageSize, data.length)} of ${data.length}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={isAllRecords || currentPage === 1}
            className={`p-1.5 rounded border transition-colors ${isAllRecords || currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
            style={{ borderColor: borderColor, color: textPrimary }}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[9px] font-medium px-2" style={{ color: textPrimary }}>
            PAGE {currentPage} OF {totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={isAllRecords || currentPage === totalPages}
            className={`p-1.5 rounded border transition-colors ${isAllRecords || currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
            style={{ borderColor: borderColor, color: textPrimary }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
