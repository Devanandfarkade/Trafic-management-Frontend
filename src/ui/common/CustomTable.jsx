import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../ui/Settings/themeUtils';

const CustomTable = ({ 
  data = [], 
  columns = [], 
  actions = [],
  searchTerm = '',
  recordsPerPage = 10,
  showPagination = true,
  onSort,
  sortField,
  sortOrder,
  loading = false,
  emptyMessage = "No data available"
}) => {
  const { theme, themeUtils } = useTheme();
  const [currentPage, setCurrentPage] = useState(1);
  const isDark = theme.mode === "dark";

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data || [];
    
    return (data || []).filter(item => {
      return Object.values(item).some(value => 
        String(value ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [searchTerm, data]);

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Pagination logic
  const isAllRecords = !recordsPerPage || recordsPerPage === Infinity;
  const totalPages = isAllRecords ? 1 : Math.ceil(filteredData.length / recordsPerPage);
  const indexOfLastItem = isAllRecords ? filteredData.length : currentPage * recordsPerPage;
  const indexOfFirstItem = isAllRecords ? 0 : indexOfLastItem - recordsPerPage;
  const currentItems = isAllRecords ? filteredData : filteredData.slice(indexOfFirstItem, indexOfLastItem);

  // Add index to each item for display in the table
  const tableData = currentItems.map((item, index) => ({
    ...item,
    index: indexOfFirstItem + index + 1
  }));

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Generate page numbers for pagination
  const pageNumbers = useMemo(() => {
    const maxPageButtons = 5; // Maximum number of page buttons to display
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    
    // Adjust startPage if we're near the end
    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }
    
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }, [currentPage, totalPages]);

  const renderCell = (item, column) => {
    const value = item[column.key];
    
    if (column.render) {
      return column.render(item, value, theme, themeUtils, isDark);
    }
    
    if (column.type === 'index') {
      return (
        <span 
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold"
          style={{ 
            backgroundColor: `${theme.headerBg}20`,
            color: theme.headerBg
          }}
        >
          {item.index}
        </span>
      );
    }
    
    if (column.type === 'actions') {
      // Ensure actions is an array before calling map
      if (!actions || !Array.isArray(actions)) {
        return null;
      }
      
      return (
        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <button
              key={index}
              className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110"
              style={{ 
                backgroundColor: action.color ? `${action.color}15` : `${theme.headerBg}15`,
                color: action.color || theme.headerBg
              }}
              onClick={() => action.onClick && action.onClick(item)}
              title={action.title}
            >
              {action.icon && <action.icon size={12} />}
            </button>
          ))}
        </div>
      );
    }
    
    return <span style={{ color: themeUtils.getTextColor(true) }}>{value}</span>;
  };

  // If loading, show loading state
  if (loading) {
    return (
      <div 
        className="rounded-xl shadow-lg overflow-hidden p-8 text-center"
        style={{ 
          backgroundColor: themeUtils.getBgColor("card"),
          boxShadow: isDark
            ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
            : "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
        }}
      >
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 mr-3" 
               style={{ borderColor: theme.headerBg }}></div>
          <p style={{ color: themeUtils.getTextColor(false) }}>Loading data...</p>
        </div>
      </div>
    );
  }

  // If no data, show empty state
  if (!data || data.length === 0) {
    return (
      <div 
        className="rounded-xl shadow-lg overflow-hidden p-8 text-center"
        style={{ 
          backgroundColor: themeUtils.getBgColor("card"),
          boxShadow: isDark
            ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
            : "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
        }}
      >
        <p style={{ color: themeUtils.getTextColor(false) }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div 
      className="rounded-xl shadow-lg overflow-hidden"
      style={{ 
        backgroundColor: themeUtils.getBgColor("card"),
        boxShadow: isDark
          ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
          : "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
      }}
    >
      <div 
        className="overflow-x-auto scrollbar-hide"
        style={{
          // Hide scrollbar for Chrome, Safari and Opera
          scrollbarWidth: 'none', // For Firefox
          msOverflowStyle: 'none', // For IE and Edge
        }}
      >
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <table className="min-w-full">
          <thead>
            <tr style={theme.headerBg?.includes("gradient") ? { background: theme.headerBg } : { backgroundColor: theme.headerBg || "#3b82f6" }}>
              {columns.map((column, index) => (
                <th 
                  key={index} 
                  className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider cursor-pointer text-white" 
                  style={{ borderColor: `${theme.headerBg}40` }}
                  onClick={() => column.sortable && onSort && onSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    <span>{column.title}</span>
                    {column.sortable && sortField === column.key && (
                      sortOrder === "asc" ? <ChevronLeft size={14} className="text-white" /> : <ChevronRight size={14} className="text-white" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((item, index) => (
              <tr 
                key={index}
                className="transition-all duration-200"
                style={{ 
                  borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${theme.headerBg}08`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {columns.map((column, colIndex) => (
                  <td key={colIndex} className="px-3 py-2 whitespace-nowrap">
                    {renderCell(item, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {showPagination && totalPages > 1 && (
        <div 
          className="px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-4"
          style={{ 
            borderTop: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
            backgroundColor: `${theme.headerBg}05`
          }}
        >
          <div className="text-sm font-medium" style={{ color: themeUtils.getTextColor(false) }}>
            Showing <span style={{ color: theme.headerBg, fontWeight: 'bold' }}>{indexOfFirstItem + 1}</span> to{' '}
            <span style={{ color: theme.headerBg, fontWeight: 'bold' }}>{Math.min(indexOfLastItem, filteredData.length)}</span> of{' '}
            <span style={{ color: theme.headerBg, fontWeight: 'bold' }}>{filteredData.length}</span> entries
          </div>

          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              className="flex items-center gap-2 px-2 py-1 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: currentPage === 1 ? (isDark ? '#1f2937' : '#f3f4f6') : theme.headerBg,
                color: currentPage === 1 ? themeUtils.getTextColor(false) : 'white',
              }}
              disabled={currentPage === 1}
              onClick={handlePrevPage}
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            {/* Page Numbers */}
            {pageNumbers[0] > 1 && (
              <>
                <button
                  className="px-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{ 
                    backgroundColor: `${theme.headerBg}15`,
                    color: theme.headerBg
                  }}
                  onClick={() => handlePageChange(1)}
                >
                  1
                </button>
                {pageNumbers[0] > 2 && (
                  <span style={{ color: themeUtils.getTextColor(false) }}>...</span>
                )}
              </>
            )}
            
            {pageNumbers.map((page) => (
              <button
                key={page}
                className="px-2 py-1 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{ 
                  backgroundColor: currentPage === page ? theme.headerBg : `${theme.headerBg}15`,
                  color: currentPage === page ? 'white' : theme.headerBg
                }}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </button>
            ))}
            
            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span style={{ color: themeUtils.getTextColor(false) }}>...</span>
                )}
                <button
                  className="px-2 py-1 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{ 
                    backgroundColor: `${theme.headerBg}15`,
                    color: theme.headerBg
                  }}
                  onClick={() => handlePageChange(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}

            {/* Next Button */}
            <button
              className="flex items-center gap-2 px-2 py-1 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: currentPage === totalPages ? (isDark ? '#1f2937' : '#f3f4f6') : theme.headerBg,
                color: currentPage === totalPages ? themeUtils.getTextColor(false) : 'white',
              }}
              disabled={currentPage === totalPages}
              onClick={handleNextPage}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomTable;