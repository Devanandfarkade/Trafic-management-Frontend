import React from 'react';
import { useTheme } from '../Settings/themeUtils';

const TransparentPageHeader = ({ title, icon: Icon, description, children }) => {
  const { theme, themeUtils } = useTheme();

  const getHeaderBg = () => {
    if (!theme.headerBg) return "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)";
    if (theme.headerBg === "custom-indigo-sidebar") return "rgba(79, 70, 229, 0.25)";
    return theme.headerBg;
  };

  const headerBg = getHeaderBg();
  const isGradient = typeof headerBg === "string" && headerBg.includes("gradient");
  const isCustomIndigo = theme.headerBg === "custom-indigo-sidebar";

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
      padding: "0 4px",
      flexWrap: "wrap",
      gap: 12,
      animation: "fadeUp 0.45s ease both",
      position: "relative",
      zIndex: 50
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
          {Icon && (
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: headerBg,
              border: isCustomIndigo ? "1px solid rgba(99, 102, 241, 0.3)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isCustomIndigo
                ? "none"
                : isGradient
                  ? (headerBg.includes("6, 182, 212")
                    ? "0 4px 14px rgba(6, 182, 212, 0.35)"
                    : (headerBg.includes("99, 102, 241")
                      ? "0 4px 14px rgba(99, 102, 241, 0.35)"
                      : "0 4px 14px rgba(128, 102, 51, 0.35)"))
                  : `0 4px 14px ${headerBg}59`,
              flexShrink: 0
            }}>
              <Icon size={17} color={isCustomIndigo ? "#6366f1" : "#fff"} strokeWidth={2} />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: themeUtils.getTextColor(), letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {title}
            </h1>
            <p style={{ fontSize: 11, color: themeUtils.getTextColor(false), fontWeight: 500 }}>
              {description || ""}
            </p>
          </div>
        </div>
      </div>

      {children && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default TransparentPageHeader;
