// components/Common/Card.jsx
import React from "react";
import { useTheme } from "../Settings/themeUtils";

const Card = ({
  children,
  className = "",
  padding = "p-2",
  bgColor,
  borderColor,
  shadow = "shadow-sm",
  hover = false,
  loading = false,
  noBorder = false,
  ...rest
}) => {
  const { theme, themeUtils } = useTheme();

  // Use provided colors or fall back to theme defaults
  const cardStyle = {
    backgroundColor: bgColor || themeUtils.getBgColor("card"),
    borderColor: noBorder ? "transparent" : (borderColor || themeUtils.getBorderColor()),
    border: noBorder ? "none" : `1px solid ${borderColor || themeUtils.getBorderColor()}`,
  };

  // Helper for gradient support in loading skeleton
  const getSkeletonColor = () => {
    if (theme.mode === 'Dark') {
      return '#374151';
    }
    return '#e5e7eb';
  };

  if (loading) {
    return (
      <div
        className={`rounded-xl ${noBorder ? "" : "border"} ${padding} ${shadow} ${className}`}
        style={cardStyle}
        {...rest}
      >
        <div className="animate-pulse space-y-2">
          <div 
            className="h-4 rounded w-3/4"
            style={{ backgroundColor: getSkeletonColor() }}
          ></div>
          <div 
            className="h-8 rounded"
            style={{ backgroundColor: getSkeletonColor() }}
          ></div>
          <div 
            className="h-4 rounded w-1/2"
            style={{ backgroundColor: getSkeletonColor() }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl ${noBorder ? "" : "border"} ${padding} ${shadow} ${hover ? "transition-all duration-200 hover:shadow-md" : ""
        } ${className}`}
      style={cardStyle}
      {...rest}
    >
      {children}
    </div>
  );
};

// Card Header Component
export const CardHeader = ({ children, className = "" }) => {
  const { theme, themeUtils } = useTheme();
  return <div className={`mb-1 ${className}`}>{children}</div>;
};

// Card Title Component
export const CardTitle = ({ children, className = "" }) => {
  const { theme, themeUtils } = useTheme();
  
  // Helper for gradient text support
  const getTitleStyle = () => {
    if (theme.headerBg && theme.headerBg.includes('gradient')) {
      return {
        background: theme.headerBg,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    }
    return { color: themeUtils.getTextColor(true) };
  };
  
  return (
    <h3
      className={`text-lg font-semibold ${className}`}
      style={getTitleStyle()}
    >
      {children}
    </h3>
  );
};

// Card Content Component
export const CardContent = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);

// Stats Card variant
export const StatsCard = ({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  value,
  subtitle,
  trendValue,
  trendLabel,
  loading = false,
  size = "default",
  ...props
}) => {
  const { theme, themeUtils } = useTheme();
  const isPositiveTrend = trendValue > 0;
  const trendColor = isPositiveTrend ? "#10b981" : "#ef4444";

  // Helper for icon background
  const getIconBg = () => {
    if (iconBg) return iconBg;
    return theme.headerBg ? `${theme.headerBg}15` : themeUtils.getBgColor("hover");
  };

  // Helper for icon color
  const getIconColor = () => {
    if (iconColor) return iconColor;
    return theme.headerBg || themeUtils.getTextColor(true);
  };

  const isSmall = size === "small";

  return (
    <Card
      bgColor={themeUtils.getBgColor("card")}
      borderColor={themeUtils.getBorderColor()}
      padding={isSmall ? "p-2 sm:p-2.5" : "p-4"}
      hover={true}
      loading={loading}
      {...props}
    >
      {!loading && (
        <>
          {/* Top row */}
          <div className={`flex items-start justify-between ${isSmall ? "mb-1" : "mb-4"}`}>
            {/* Left section: Icon */}
            <div
              className={`${isSmall ? "w-8 h-8 rounded-lg" : "w-12 h-12 rounded-2xl"} flex items-center justify-center shrink-0 shadow-sm`}
              style={{
                backgroundColor: getIconBg(),
              }}
            >
              <Icon
                className={isSmall ? "w-4 h-4" : "w-6 h-6"}
                style={{ color: getIconColor() }}
              />
            </div>

            {/* Right section: Text block (Properly aligned to right) */}
            <div className="flex flex-col text-right min-w-0">
              <p
                className={`${isSmall ? "text-[10px]" : "text-xs"} font-bold uppercase tracking-widest opacity-60 mb-0.5`}
                style={{ color: themeUtils.getTextColor(false) }}
              >
                {title}
              </p>
              <h4
                className={`${isSmall ? "text-lg sm:text-xl font-extrabold" : "text-3xl font-black"} leading-tight tabular-nums`}
                style={{ color: themeUtils.getTextColor(true) }}
              >
                {value}
              </h4>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <p
              className={`${isSmall ? "text-[9px]" : "text-xs"}`}
              style={{ color: themeUtils.getTextColor(false) }}
            >
              {subtitle}
            </p>
            {trendLabel && (
              <p
                className={`${isSmall ? "text-[9px]" : "text-xs"}`}
                style={{ color: themeUtils.getTextColor(false) }}
              >
                {trendLabel}
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
};

// Quick Action Card variant
export const QuickActionCard = ({
  icon: Icon,
  iconColor,
  label,
  description,
  onClick,
}) => {
  const { theme, themeUtils } = useTheme();

  // Helper for icon background
  const getIconBg = () => {
    return `${iconColor || theme.headerBg}15`;
  };

  // Helper for icon color
  const getIconColor = () => {
    return iconColor || theme.headerBg || "#3b82f6";
  };

  return (
    <Card
      bgColor={themeUtils.getBgColor("card")}
      borderColor={themeUtils.getBorderColor()}
      padding="p-3"
      hover={true}
      className="cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: getIconBg() }}
        >
          <Icon
            className="w-5 h-5"
            style={{ color: getIconColor() }}
          />
        </div>

        <div className="flex-1">
          <p
            className="font-medium text-sm mb-1"
            style={{ color: themeUtils.getTextColor(true) }}
          >
            {label}
          </p>
          <p
            className="text-xs"
            style={{ color: themeUtils.getTextColor(false) }}
          >
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default Card;