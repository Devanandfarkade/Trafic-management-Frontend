import React from "react";
import { useTheme } from "../Settings/themeUtils"; // ✅ adjust path if needed

const Pagination = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = "",
}) => {
  const { themeUtils } = useTheme(); // ✅ FIX: get themeUtils here

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (!totalPages || isNaN(totalPages) || totalPages <= 1 || !isFinite(totalPages)) return null;

  return (
    <div
      className={`flex items-center justify-between mt-4 py-3 border-t gap-4 ${className}`}
      style={{ borderColor: themeUtils?.getBorderColor?.() + "40" }}
    >
      {/* Page info */}
      <div
        className="text-[10px] font-bold uppercase tracking-widest opacity-50"
        style={{ color: themeUtils?.getTextColor?.(false) }}
      >
        Showing page <span className="text-secondary" style={{ color: themeUtils?.getSecondaryColor?.() }}>{currentPage}</span> of {totalPages}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="h-8 px-3 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all disabled:opacity-20 disabled:cursor-not-allowed border hover:shadow-lg active:scale-95"
          style={{
            backgroundColor: themeUtils?.getBgColor?.("card"),
            borderColor: themeUtils?.getBorderColor?.(),
            color: themeUtils?.getTextColor?.(true),
          }}
        >
          Previous
        </button>

        <div className="flex gap-1 mx-1">
          {[...Array(totalPages)].map((_, i) => {
            const pageNum = i + 1;
            // Only show current, first, last, and neighbors
            if (
              pageNum === 1 || 
              pageNum === totalPages || 
              (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
            ) {
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 rounded-md text-[10px] font-black transition-all border ${
                    currentPage === pageNum ? "shadow-md" : "opacity-40 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: currentPage === pageNum ? themeUtils?.getSecondaryColor?.() : "transparent",
                    borderColor: currentPage === pageNum ? themeUtils?.getSecondaryColor?.() : themeUtils?.getBorderColor?.(),
                    color: currentPage === pageNum ? "#000" : themeUtils?.getTextColor?.(true),
                  }}
                >
                  {pageNum}
                </button>
              );
            }
            if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
              return <span key={pageNum} className="px-1 opacity-30 text-[10px]">...</span>;
            }
            return null;
          })}
        </div>

        <button
          onClick={() =>
            onPageChange(Math.min(currentPage + 1, totalPages))
          }
          disabled={currentPage === totalPages}
          className="h-8 px-3 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all disabled:opacity-20 disabled:cursor-not-allowed border hover:shadow-lg active:scale-95"
          style={{
            backgroundColor: themeUtils?.getBgColor?.("card"),
            borderColor: themeUtils?.getBorderColor?.(),
            color: themeUtils?.getTextColor?.(true),
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;