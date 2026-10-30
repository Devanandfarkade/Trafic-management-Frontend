// components/visitors/dashboard/InteractivePieChart.jsx
import React, { useState } from "react";
import { PieChart } from "lucide-react";

const InteractivePieChart = ({ data, themeUtils, loading, customSize = 200, layout = "vertical" }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0 });

  const size = customSize;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.375; // 75 for size 200
  const innerRadius = size * 0.21; // 42 for size 200

  const total = data.reduce((sum, d) => sum + d.count, 0);

  const slices = [];
  let startAngle = -Math.PI / 2;

  data.forEach((item, i) => {
    const sliceAngle = total > 0 ? (item.count / total) * 2 * Math.PI : 0;
    const endAngle = startAngle + sliceAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const ix1 = cx + innerRadius * Math.cos(startAngle);
    const iy1 = cy + innerRadius * Math.sin(startAngle);
    const ix2 = cx + innerRadius * Math.cos(endAngle);
    const iy2 = cy + innerRadius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const path =
      sliceAngle === 0
        ? ""
        : [
            `M ${ix1} ${iy1}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${ix2} ${iy2}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
            "Z",
          ].join(" ");

    const midAngle = startAngle + sliceAngle / 2;

    slices.push({
      path,
      color: item.color,
      name: item.name,
      count: item.count,
      percentage: item.percentage,
      midAngle,
      startAngle,
      endAngle,
    });

    startAngle = endAngle;
  });

  const handleMouseEnter = (e, index) => {
    const svgRect = e.currentTarget.closest("svg").getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;
    setHoveredIndex(index);
    setTooltip({ visible: true, x: mouseX, y: mouseY });
  };

  const handleMouseMove = (e) => {
    const svgRect = e.currentTarget.closest("svg").getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;
    setTooltip((prev) => ({ ...prev, x: mouseX, y: mouseY }));
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTooltip({ visible: false, x: 0, y: 0 });
  };

  const hovered = hoveredIndex !== null ? slices[hoveredIndex] : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex justify-center items-center h-full w-full">
        <p style={{ color: themeUtils?.getTextColor?.(false) || '#9ca3af' }} className="text-sm">
          No data available
        </p>
      </div>
    );
  }

  const displayName = hovered ? hovered.name : "Total";
  const nameWords = displayName.trim().split(" ");
  const isMultiLine = nameWords.length > 1 && displayName.length > 8;

  const renderSvgChart = () => (
    <div className="relative shrink-0 flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: "visible" }}
      >
        {slices.map((slice, i) => {
          const isHovered = hoveredIndex === i;
          const offset = isHovered ? 6 : 0;
          const midAngle = slice.midAngle;
          const tx = Math.cos(midAngle) * offset;
          const ty = Math.sin(midAngle) * offset;

          return (
            <path
              key={i}
              d={slice.path}
              fill={slice.color}
              stroke={themeUtils?.getBorderColor?.() || "white"}
              strokeWidth={2}
              transform={`translate(${tx}, ${ty})`}
              style={{
                cursor: "pointer",
                transition: "transform 0.2s ease, filter 0.2s ease",
                filter: isHovered
                  ? `drop-shadow(0 4px 8px ${slice.color}88)`
                  : "none",
                opacity: hoveredIndex !== null && !isHovered ? 0.65 : 1,
              }}
              onMouseEnter={(e) => handleMouseEnter(e, i)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
          );
        })}

        {/* Total / Count Number */}
        <text
          x={cx}
          y={isMultiLine ? cy - size * 0.07 : cy - size * 0.04}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: `${size * 0.1}px`,
            fontWeight: "700",
            fill: hovered ? hovered.color : (themeUtils?.getTextColor?.(true) || '#ffffff'),
            transition: "fill 0.2s ease",
          }}
        >
          {hovered ? hovered.count : total}
        </text>

        {/* Name Label (Multi-line or Single-line) */}
        {isMultiLine ? (
          <>
            <text
              x={cx}
              y={cy + size * 0.04}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: `${Math.max(7, size * 0.038)}px`,
                fontWeight: "600",
                fill: themeUtils?.getTextColor?.(false) || '#9ca3af',
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {nameWords[0]}
            </text>
            <text
              x={cx}
              y={cy + size * 0.10}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: `${Math.max(7, size * 0.038)}px`,
                fontWeight: "600",
                fill: themeUtils?.getTextColor?.(false) || '#9ca3af',
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {nameWords.slice(1).join(" ")}
            </text>
          </>
        ) : (
          <text
            x={cx}
            y={cy + size * 0.06}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: `${Math.max(8, size * 0.045)}px`,
              fontWeight: "600",
              fill: themeUtils?.getTextColor?.(false) || '#9ca3af',
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {displayName}
          </text>
        )}

        {/* Hover Tooltip */}
        {tooltip.visible && hovered && (
          <g>
            <rect
              x={tooltip.x + 10}
              y={tooltip.y - 38}
              width={130}
              height={52}
              rx={8}
              fill={themeUtils?.getBgColor?.("card") === "#FFFFFF" ? "#1f2937" : "#111827"}
              opacity={0.95}
            />
            <circle
              cx={tooltip.x + 22}
              cy={tooltip.y - 18}
              r={5}
              fill={hovered.color}
            />
            <text
              x={tooltip.x + 32}
              y={tooltip.y - 14}
              style={{ fontSize: "11px", fontWeight: "600", fill: "#f9fafb" }}
            >
              {hovered.name}
            </text>
            <text
              x={tooltip.x + 22}
              y={tooltip.y + 4}
              style={{ fontSize: "10px", fill: "#d1d5db" }}
            >
              {hovered.count} ({hovered.percentage}%)
            </text>
          </g>
        )}
      </svg>
    </div>
  );

  const renderLegendList = () => (
    <div className={layout === "horizontal" ? "flex-1 flex flex-col gap-1.5 overflow-y-auto hide-scrollbar max-h-full pr-1" : "mt-2 w-full space-y-2"}>
      {data.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between cursor-pointer rounded-lg px-2 py-1 transition-all"
          style={{
            backgroundColor:
              hoveredIndex === i ? `${item.color}18` : "transparent",
          }}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div className="flex items-center gap-1.5 min-w-0 pr-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span
              className="text-xs font-medium truncate"
              title={item.name}
              style={{
                color: themeUtils?.getTextColor?.(true) || '#ffffff',
                opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {item.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="text-xs font-bold"
              style={{ color: item.color }}
            >
              {item.count}
            </span>
            <span
              className="text-[10px]"
              style={{
                color: themeUtils?.getTextColor?.(false) || '#9ca3af',
              }}
            >
              ({item.percentage}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  if (layout === "horizontal") {
    return (
      <div className="flex flex-row items-center justify-between w-full h-full gap-3 p-1">
        {renderSvgChart()}
        {renderLegendList()}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {renderSvgChart()}
      {renderLegendList()}
    </div>
  );
};

export default InteractivePieChart;