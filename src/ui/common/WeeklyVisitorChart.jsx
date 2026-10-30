// components/visitors/dashboard/WeeklyVisitorChart.jsx
import React, { useRef, useEffect, useMemo } from "react";
import { Activity } from "lucide-react";

const PURPOSE_COLORS = [
  { bg: "rgba(99,102,241,0.85)", border: "#6366f1" },
  { bg: "rgba(16,185,129,0.85)", border: "#10b981" },
  { bg: "rgba(245,158,11,0.85)", border: "#f59e0b" },
  { bg: "rgba(239,68,68,0.85)", border: "#ef4444" },
  { bg: "rgba(139,92,246,0.85)", border: "#8b5cf6" },
  { bg: "rgba(6,182,212,0.85)", border: "#06b6d4" },
];

// Helper function to get past 5 days data - moved outside component to prevent recreation
const getPast5DaysData = (weeklyData) => {
  if (!weeklyData || weeklyData.length === 0) return [];
  
  // Get current date
  const today = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fullDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  // Create a map of day names to visitor counts from weeklyData
  const dataMap = new Map();
  weeklyData.forEach(item => {
    const dayIndex = dayNames.findIndex(d => d.toLowerCase() === item.day?.toLowerCase());
    const fullDayIndex = fullDayNames.findIndex(d => d.toLowerCase() === item.day?.toLowerCase());
    const index = dayIndex !== -1 ? dayIndex : fullDayIndex;
    if (index !== -1) {
      dataMap.set(index, item.count || item.visitors || 0);
    }
  });
  
  // Get past 5 days including today
  const past5Days = [];
  for (let i = 4; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dayIndex = date.getDay();
    const dayName = dayNames[dayIndex];
    const fullDayName = fullDayNames[dayIndex];
    const visitorCount = dataMap.get(dayIndex) || 0;
    
    // Format date for display
    const formattedDate = date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
    
    past5Days.push({
      day: dayName,
      fullDay: fullDayName,
      visitors: visitorCount,
      isToday: i === 0,
      date: date,
      formattedDate: formattedDate,
      originalDay: dayName,
      // Add a unique key for React
      key: `${dayName}_${date.getTime()}`
    });
  }
  
  return past5Days;
};

const WeeklyVisitorChart = ({ weeklyData, purposeStats, themeUtils, loading }) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isChartCreatedRef = useRef(false);

  // Memoize the past 5 days data to prevent recalculation on every render
  const past5DaysData = useMemo(() => {
    return getPast5DaysData(weeklyData);
  }, [weeklyData]); // Only recalculate when weeklyData changes

  // Memoize purpose names and percentages
  const purposeNames = useMemo(() => 
    purposeStats.length > 0
      ? purposeStats.map((p) => p.name)
      : ["Meeting", "Delivery", "Interview", "Other"],
    [purposeStats]
  );
  
  const purposePercentages = useMemo(() => 
    purposeStats.length > 0
      ? purposeStats.map((p) => p.percentage / 100)
      : [0.45, 0.25, 0.20, 0.10],
    [purposeStats]
  );

  // Calculate stats for display (memoized)
  const stats = useMemo(() => {
    const totalVisitors = past5DaysData.reduce((s, d) => s + (d.visitors || 0), 0);
    const peakDay = past5DaysData.reduce(
      (max, d) => (d.visitors > (max?.visitors || 0) ? d : max),
      null
    );
    const todayData = past5DaysData.find(d => d.isToday);
    const averageVisitors = past5DaysData.length > 0 ? Math.round(totalVisitors / past5DaysData.length) : 0;
    
    return { totalVisitors, peakDay, todayData, averageVisitors };
  }, [past5DaysData]);

  // Create chart - separated from render to prevent flickering
  const createChart = () => {
    if (!canvasRef.current || past5DaysData.length === 0 || !window.Chart) return;
    
    // Destroy existing chart if it exists
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
      isChartCreatedRef.current = false;
    }

    // Create labels with day name and date
    const labels = past5DaysData.map((d) => {
      return [d.day.toUpperCase(), d.formattedDate];
    });

    const totals = past5DaysData.map((d) => d.visitors || 0);

    // Create stacked datasets for each purpose
    const stackedDatasets = purposeNames.map((name, idx) => ({
      type: "bar",
      label: name,
      data: totals.map((total) =>
        Math.round(total * (purposePercentages[idx] || 0))
      ),
      backgroundColor: PURPOSE_COLORS[idx % PURPOSE_COLORS.length].bg,
      borderColor: PURPOSE_COLORS[idx % PURPOSE_COLORS.length].border,
      borderWidth: 0,
      borderRadius: idx === purposeNames.length - 1
        ? { topLeft: 6, topRight: 6 }
        : 0,
      borderSkipped: false,
      stack: "visitors",
      order: 2,
    }));

    // Create trend line dataset
    const trendDataset = {
      type: "line",
      label: "Total Trend",
      data: totals,
      borderColor: themeUtils.getTextColor(true),
      borderWidth: 2.5,
      pointBackgroundColor: past5DaysData.map((d) => 
        d.isToday ? "#4f46e5" : themeUtils.getTextColor(true)
      ),
      pointBorderColor: "#6366f1",
      pointBorderWidth: 2.5,
      pointRadius: past5DaysData.map((d) => d.isToday ? 7 : 5),
      pointHoverRadius: 8,
      pointHoverBackgroundColor: "#6366f1",
      pointHoverBorderColor: themeUtils.getTextColor(true),
      pointHoverBorderWidth: 2,
      fill: false,
      tension: 0.42,
      order: 1,
      yAxisID: "y",
    };

    const ctx = canvasRef.current.getContext("2d");

    chartRef.current = new window.Chart(ctx, {
      data: {
        labels,
        datasets: [...stackedDatasets, trendDataset],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500, // Smooth but not too slow
          easing: 'easeInOutQuart'
        },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: themeUtils.getBgColor("card") === "#FFFFFF" ? "rgba(17,24,39,0.95)" : "#1F2937",
            titleColor: themeUtils.getTextColor(true),
            bodyColor: themeUtils.getTextColor(false),
            borderColor: themeUtils.getBorderColor?.(),
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            titleFont: { size: 13, weight: "600" },
            bodyFont: { size: 12 },
            callbacks: {
              title: (items) => {
                const label = items[0]?.label;
                return Array.isArray(label) ? label.join(" · ") : label;
              },
              label: (ctx) => {
                if (ctx.dataset.type === "line") {
                  return `  Total: ${ctx.parsed.y} visitors`;
                }
                return `  ${ctx.dataset.label}: ${ctx.parsed.y}`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: (context) => {
                const index = context.index;
                return past5DaysData[index]?.isToday ? "#4f46e5" : themeUtils.getTextColor(false);
              },
              font: {
                size: 11,
                weight: (context) => {
                  const index = context.index;
                  return past5DaysData[index]?.isToday ? "bold" : "600";
                }
              },
              autoSkip: false,
              maxRotation: 0,
            },
          },
          y: {
            stacked: true,
            grid: { color: themeUtils.getBorderColor?.() + "44" || "rgba(156,163,175,0.12)" },
            border: { display: false, dash: [4, 4] },
            ticks: {
              color: themeUtils.getTextColor(false),
              font: { size: 11 },
              maxTicksLimit: 6,
              padding: 8,
              callback: (v) => (Number.isInteger(v) ? v : ""),
            },
            beginAtZero: true,
          },
        },
      },
    });
    
    isChartCreatedRef.current = true;
  };

  // Effect to create/destroy chart
  useEffect(() => {
    if (loading) return;
    if (!past5DaysData.length) return;
    if (!window.Chart) return;

    // Small delay to ensure canvas is ready
    const timer = setTimeout(() => {
      createChart();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
        isChartCreatedRef.current = false;
      }
    };
  }, [loading, past5DaysData, purposeNames, purposePercentages, themeUtils]);

  // Separate effect for resize handling
  useEffect(() => {
    const handleResize = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        if (chartRef.current) {
          chartRef.current.resize();
        }
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (past5DaysData.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        No data available for the past 5 days
      </div>
    );
  }

  const { totalVisitors, peakDay, todayData, averageVisitors } = stats;

  return (
    <div className="flex flex-col w-full gap-3">
      <div className="flex gap-3 flex-wrap">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: "rgba(99,102,241,0.10)", color: "#6366f1" }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "#6366f1" }}
          />
          {totalVisitors} visitors (last 5 days)
        </div>
        {peakDay && peakDay.visitors > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: "rgba(16,185,129,0.10)", color: "#10b981" }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#10b981" }}
            />
            Peak: {peakDay.day} ({peakDay.visitors})
          </div>
        )}
        {todayData && todayData.visitors > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: "rgba(245,158,11,0.10)", color: "#f59e0b" }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#f59e0b" }}
            />
            Today: {todayData.visitors} visitors
          </div>
        )}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: "rgba(139,92,246,0.10)", color: "#8b5cf6" }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "#8b5cf6" }}
          />
          Avg: {averageVisitors}/day
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", height: "220px" }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Stacked bar chart showing daily visitor counts for past 5 days by purpose with trend line overlay"
        >
          Weekly visitor activity chart (Past 5 days)
        </canvas>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: themeUtils.getTextColor(false) }}>
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#4f46e5" }} />
          Today's bar highlighted
        </div>
        {purposeNames.map((name, idx) => (
          <span
            key={name}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: themeUtils.getTextColor(false) }}
          >
            <span
              className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{
                background: PURPOSE_COLORS[idx % PURPOSE_COLORS.length].bg,
              }}
            />
            {name}
          </span>
        ))}
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{ color: themeUtils.getTextColor(false) }}
        >
          <span
            className="inline-block flex-shrink-0"
            style={{
              width: 20,
              height: 2,
              background: themeUtils.getTextColor(true),
              border: `1px solid ${themeUtils.getTextColor(true)}`,
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          Trend
        </span>
      </div>
    </div>
  );
};

export default WeeklyVisitorChart;