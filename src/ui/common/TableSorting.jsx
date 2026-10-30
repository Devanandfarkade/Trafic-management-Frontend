import React, { useState, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useTheme } from "../Settings/themeUtils";
import {
  FaSort,
  FaSortUp,
  FaSortDown,
} from "react-icons/fa";
import "../../index.css";

const Table = ({
  headers = [],
  data = [],
  renderRow,
  emptyMessage = "No data found",
  className = "",
  loading = false,
  hover = true,
  sortable = true,
  headerStyle = {},
  rowStyle = {},
}) => {
  const { theme, themeUtils } = useTheme();
  const containerRef = useRef(null);

  const handleMouseDown = (e) => {
    const container = containerRef.current;
    if (!container) return;
    
    // Only drag with left click
    if (e.button !== 0) return;

    // Don't drag if clicking buttons, inputs, or selects
    if (e.target.closest("button, input, select, a, svg")) return;

    container.style.cursor = "grabbing";
    container.style.userSelect = "none";

    const startX = e.pageX - container.offsetLeft;
    const scrollLeft = container.scrollLeft;

    const handleMouseMove = (moveEvent) => {
      const x = moveEvent.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5; // Scroll speed
      container.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
      container.style.cursor = "default";
      container.style.removeProperty("user-select");
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const [sortConfig, setSortConfig] =
    useState({
      key: null,
      direction: "asc",
    });

  // Handle Sorting
  const handleSort = (index) => {
    if (!sortable) return;

    const header = headers[index];

    const headerTitle =
      typeof header === "object"
        ? header.title
        : header;

    // Skip non-sortable columns
    if (
      header?.sortable === false ||
      headerTitle === "Action" ||
      headerTitle === "Actions"
    ) {
      return;
    }

    setSortConfig((prev) => {
      if (prev.key === index) {
        return {
          key: index,
          direction:
            prev.direction === "asc"
              ? "desc"
              : "asc",
        };
      }

      return {
        key: index,
        direction: "asc",
      };
    });
  };

  // Sorting Logic
  const sortedData = useMemo(() => {
    if (sortConfig.key === null)
      return data;

    const sorted = [...data].sort(
      (a, b) => {
        const header =
          headers[sortConfig.key];

        // NEW METHOD (header key)
        const fieldKey =
          typeof header === "object"
            ? header.key
            : null;

        let valueA;
        let valueB;

        // If header key exists
        if (fieldKey) {
          valueA = a[fieldKey];
          valueB = b[fieldKey];
        } else {
          // OLD METHOD fallback
          const getValueFromRenderRow = (
            item,
          ) => {
            const cells =
              React.Children.toArray(
                renderRow(item, -1),
              );

            const cell =
              cells[sortConfig.key];

            if (!cell) return "";

            const extractText = (
              value,
            ) => {
              if (
                typeof value ===
                  "string" ||
                typeof value ===
                  "number"
              ) {
                return value;
              }

              if (
                Array.isArray(value)
              ) {
                return value
                  .map(extractText)
                  .join("");
              }

              if (
                React.isValidElement(
                  value,
                ) &&
                value.props?.children
              ) {
                return extractText(
                  value.props.children,
                );
              }

              return "";
            };

            if (
              React.isValidElement(cell)
            ) {
              return extractText(
                cell.props.children,
              );
            }

            return extractText(cell);
          };

          valueA =
            getValueFromRenderRow(a);

          valueB =
            getValueFromRenderRow(b);
        }

        // Handle undefined/null
        valueA =
          valueA === null ||
          valueA === undefined
            ? ""
            : valueA;

        valueB =
          valueB === null ||
          valueB === undefined
            ? ""
            : valueB;

        // Number Sorting
        if (
          !isNaN(valueA) &&
          !isNaN(valueB) &&
          valueA !== "" &&
          valueB !== ""
        ) {
          return sortConfig.direction ===
            "asc"
            ? Number(valueA) -
                Number(valueB)
            : Number(valueB) -
                Number(valueA);
        }

        // Date Sorting
        const dateA = new Date(
          valueA,
        );

        const dateB = new Date(
          valueB,
        );

        if (
          !isNaN(dateA.getTime()) &&
          !isNaN(dateB.getTime())
        ) {
          return sortConfig.direction ===
            "asc"
            ? dateA - dateB
            : dateB - dateA;
        }

        // String Sorting
        return sortConfig.direction ===
          "asc"
          ? String(valueA).localeCompare(
              String(valueB),
            )
          : String(valueB).localeCompare(
              String(valueA),
            );
      },
    );

    return sorted;
  }, [
    data,
    sortConfig,
    headers,
    renderRow,
  ]);

  // Header Background Style
  const getHeaderBgStyle = () => {
    if (
      theme.headerBg &&
      theme.headerBg.includes(
        "gradient",
      )
    ) {
      return {
        background:
          theme.headerBg,
      };
    }

    return {
      backgroundColor:
        theme.headerBg || "#3b82f6",
    };
  };

  // Loading State
  if (loading) {
    return (
      <div
        className={`rounded-xl border overflow-hidden ${className}`}
        style={{
          backgroundColor:
            themeUtils.getBgColor(
              "card",
            ),
          borderColor:
            themeUtils.getBorderColor(),
        }}
      >
        <div className="p-12 flex flex-col items-center gap-4">
          <Loader2
            className="h-10 w-10 animate-spin"
            style={{
              color:
                theme.headerBg ||
                "#d4af37",
            }}
          />

          <span
            style={{
              color:
                themeUtils.getTextColor(
                  false,
                ),
              fontSize: "12px",
            }}
          >
            Loading...
          </span>
        </div>
      </div>
    );
  }

  // Empty State
  if (sortedData.length === 0) {
    return (
      <div
        className={`rounded-xl border p-8 text-center ${className}`}
        style={{
          backgroundColor:
            themeUtils.getBgColor(
              "card",
            ),
          borderColor:
            themeUtils.getBorderColor(),
        }}
      >
        <p
          style={{
            color:
              themeUtils.getTextColor(
                false,
              ),
            fontSize: "12px",
          }}
        >
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`border shadow-2xl overflow-hidden rounded-md bg-clip-border ${className}`}
      style={{
        backgroundColor:
          themeUtils.getBgColor(
            "card",
          ),
        borderColor: `${themeUtils.getBorderColor()}80`,
      }}
    >
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="overflow-x-auto hide-scrollbar cursor-grab"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <table className="w-full border-separate border-spacing-0 table-auto">
          {/* Header */}
          <thead>
            <tr
              style={{
                ...getHeaderBgStyle(),
                ...headerStyle,
              }}
            >
              {headers.map(
                (header, index) => {
                  const headerTitle =
                    typeof header ===
                    "object"
                      ? header.title
                      : header;

                  const headerAlign =
                    typeof header ===
                    "object"
                      ? header.align ||
                        "left"
                      : "left";

                  const isActive =
                    sortConfig.key ===
                    index;

                  return (
                    <th
                      key={index}
                      onClick={() =>
                        handleSort(
                          index,
                        )
                      }
                      className="px-3 py-3 text-[11px] font-semibold border-b cursor-pointer select-none whitespace-nowrap"
                      style={{
                        color: "#ffffff",
                        borderColor: `${themeUtils.getBorderColor()}40`,
                        textAlign:
                          headerAlign,
                      }}
                    >
                      <div
                        className={`flex items-center gap-2 ${
                          headerAlign ===
                          "center"
                            ? "justify-center"
                            : ""
                        }`}
                      >
                        {headerTitle}

                        {sortable &&
                          header?.sortable !==
                            false &&
                          headerTitle !==
                            "Action" &&
                          headerTitle !==
                            "Actions" && (
                            <>
                              {!isActive && (
                                <FaSort className="text-[10px] opacity-40" />
                              )}

                              {isActive &&
                                sortConfig.direction ===
                                  "asc" && (
                                  <FaSortUp className="text-[10px]" />
                                )}

                              {isActive &&
                                sortConfig.direction ===
                                  "desc" && (
                                  <FaSortDown className="text-[10px]" />
                                )}
                            </>
                          )}
                      </div>
                    </th>
                  );
                },
              )}
            </tr>
          </thead>

          {/* Body */}
          <tbody
            className="divide-y"
            style={{
              borderColor: `${themeUtils.getBorderColor()}20`,
            }}
          >
            {sortedData.map(
              (item, index) => {
                const isEven =
                  index % 2 === 0;

                const rowBg = isEven
                  ? "transparent"
                  : theme.mode ===
                    "Dark"
                  ? "rgba(255,255,255,0.02)"
                  : "rgba(0,0,0,0.02)";

                return (
                  <tr
                    key={`${
                      item.id ||
                      "row"
                    }-${index}`}
                    className="transition-all duration-200"
                    style={{
                      backgroundColor:
                        rowBg,
                      borderColor: `${themeUtils.getBorderColor()}20`,
                      ...rowStyle,
                    }}
                    onMouseEnter={(
                      e,
                    ) => {
                      if (hover) {
                        e.currentTarget.style.backgroundColor =
                          theme.mode ===
                          "Dark"
                            ? "rgba(212,175,55,0.08)"
                            : "rgba(0,0,0,0.04)";
                      }
                    }}
                    onMouseLeave={(
                      e,
                    ) => {
                      e.currentTarget.style.backgroundColor =
                        rowBg;
                    }}
                  >
                    {renderRow(
                      item,
                      index,
                    )}
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Table;