// components/Common/ThreeDotsMenu.jsx
import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { MoreVertical, Eye, Edit, Trash2, Mail, Download, CheckCircle, XCircle, RefreshCw, UserX } from "lucide-react";
import { useTheme } from "../Settings/themeUtils";

const ThreeDotsMenu = ({
  onView,
  onEdit,
  onDelete,
  onEmail,
  onDownload,
  onApprove,
  onReject,
  onExecute,
  onDisconnect,
  viewTitle = "View",
  editTitle = "Edit",
  deleteTitle = "Delete",
  emailTitle = "Send Email",
  downloadTitle = "Download",
  approveTitle = "Approve",
  rejectTitle = "Reject",
  executeTitle = "Execute",
  disconnectTitle = "Disconnect",
  menuAlignment = "right", // "left" or "right"
  options = [], // New prop for dynamic options
  customActions = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const { theme, themeUtils } = useTheme();

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen(!isOpen);
  };

  const calculatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollX = window.scrollX || document.documentElement.scrollLeft;

      let top = rect.bottom + scrollY + 5; // 5px gap
      let left = rect.left + scrollX;

      // Adjust for right alignment (shifting left by menu width approx 192px)
      if (menuAlignment === "right") {
        // We estimate width as w-48 (12rem = 192px) + padding/borders
        // To be safe and precise, we can allow it to render or just use standard width
        left = (rect.right + scrollX) - 192;
      }

      // Screen edge guard
      if (left < 10) left = 10;

      setPosition({ top, left });
    }
  };

  // Close on window resize or scroll to avoid detached menu
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (isOpen) setIsOpen(false);
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  // Close menu when any action is clicked
  const handleActionClick = (action) => {
    return (e) => {
      e.stopPropagation();
      setIsOpen(false);
      if (action) action();
    };
  };

  // Get icon color based on theme mode
  const getIconColor = () => {
    return theme.mode === "Dark" ? "#E5E7EB" : "#4B5563";
  };

  // Get text color based on theme mode
  const getTextColor = () => {
    return theme.mode === "Dark" ? "#E5E7EB" : "#374151";
  };

  // Get hover background color based on theme mode
  const getHoverBgColor = () => {
    return theme.mode === "Dark" ? "rgba(255, 255, 255, 0.05)" : "#F9FAFB";
  };

  // Portal Content
  const menuContent = (
    <>
      {/* Transparent backdrop for click-outside */}
      <div
        className="fixed inset-0 z-[9998] cursor-default"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(false);
        }}
      />
      {/* Menu Dropdown */}
      <div
        className="absolute z-[9999] w-48 rounded-lg shadow-xl py-2"
        style={{
          top: position.top,
          left: position.left,
          backgroundColor: theme.mode === "Dark" ? "#1F2937" : "#FFFFFF",
          border: `1px solid ${theme.mode === "Dark" ? "#374151" : "#E5E7EB"}`,
          boxShadow: theme.mode === "Dark"
            ? "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)"
            : "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          maxHeight: "300px",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside menu container
      >
        {/* Dynamic Options Mode */}
        {options && options.length > 0 ? (
          options.map((option, idx) => (
            <button
              key={idx}
              onClick={handleActionClick(option.onClick)}
              className="flex items-center w-full px-4 py-2.5 text-sm transition-colors text-left"
              style={{
                color: option.variant === 'danger' ? "#DC2626" :
                  option.variant === 'success' ? "#059669" :
                    theme.mode === "Dark" ? "#F3F4F6" : "#1F2937",
                backgroundColor: "transparent"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = option.variant === 'danger'
                  ? (theme.mode === "Dark" ? "#7F1D1D" : "#FEE2E2")
                  : option.variant === 'success'
                    ? (theme.mode === "Dark" ? "#064E3B" : "#D1FAE5")
                    : theme.mode === "Dark" ? "#374151" : "#F3F4F6";
              }}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              {option.icon ? (
                <option.icon className="w-4 h-4 mr-3" style={{
                  color: option.variant === 'danger' ? "#DC2626" :
                    option.variant === 'success' ? "#059669" :
                      theme.mode === "Dark" ? "#9CA3AF" : "#6B7280"
                }} />
              ) : (
                option.label.toLowerCase().includes('delete') ?
                  <Trash2 className="w-4 h-4 mr-3" style={{ color: "#DC2626" }} /> :
                  option.label.toLowerCase().includes('view') || option.label.toLowerCase().includes('detail') ?
                    <Eye className="w-4 h-4 mr-3" style={{ color: theme.mode === "Dark" ? "#9CA3AF" : "#6B7280" }} /> :
                    option.label.toLowerCase().includes('edit') ?
                      <Edit className="w-4 h-4 mr-3" style={{ color: theme.mode === "Dark" ? "#9CA3AF" : "#6B7280" }} /> :
                      <MoreVertical className="w-4 h-4 mr-3 opacity-0" />
              )}
              {option.label}
            </button>
          ))
        ) : (
          <>
            {/* Legacy Sequential Mode */}
            {/* View option */}
            {onView && (
              <button
                onClick={handleActionClick(onView)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: theme.mode === "Dark" ? "#F3F4F6" : "#1F2937",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#374151" : "#F3F4F6"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <Eye className="w-4 h-4 mr-3" style={{ color: theme.mode === "Dark" ? "#9CA3AF" : "#6B7280" }} />
                {viewTitle}
              </button>
            )}

            {/* Edit option */}
            {onEdit && (
              <button
                onClick={handleActionClick(onEdit)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: theme.mode === "Dark" ? "#F3F4F6" : "#1F2937",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#374151" : "#F3F4F6"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <Edit className="w-4 h-4 mr-3" style={{ color: theme.mode === "Dark" ? "#9CA3AF" : "#6B7280" }} />
                {editTitle}
              </button>
            )}

            {/* Email option */}
            {onEmail && (
              <button
                onClick={handleActionClick(onEmail)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: theme.mode === "Dark" ? "#F3F4F6" : "#1F2937",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#374151" : "#F3F4F6"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <Mail className="w-4 h-4 mr-3" style={{ color: theme.mode === "Dark" ? "#9CA3AF" : "#6B7280" }} />
                {emailTitle}
              </button>
            )}

            {/* Download option */}
            {onDownload && (
              <button
                onClick={handleActionClick(onDownload)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: theme.mode === "Dark" ? "#F3F4F6" : "#1F2937",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#374151" : "#F3F4F6"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <Download className="w-4 h-4 mr-3" style={{ color: theme.mode === "Dark" ? "#9CA3AF" : "#6B7280" }} />
                {downloadTitle}
              </button>
            )}

            {/* Approve option */}
            {onApprove && (
              <button
                onClick={handleActionClick(onApprove)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: "#059669",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#064E3B" : "#D1FAE5"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <CheckCircle className="w-4 h-4 mr-3" style={{ color: "#059669" }} />
                {approveTitle}
              </button>
            )}

            {/* Reject option */}
            {onReject && (
              <button
                onClick={handleActionClick(onReject)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: "#DC2626",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#7F1D1D" : "#FEE2E2"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <XCircle className="w-4 h-4 mr-3" style={{ color: "#DC2626" }} />
                {rejectTitle}
              </button>
            )}

            {/* Execute option */}
            {onExecute && (
              <button
                onClick={handleActionClick(onExecute)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: "#2563EB",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#1E3A8A" : "#DBEAFE"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <RefreshCw className="w-4 h-4 mr-3" style={{ color: "#2563EB" }} />
                {executeTitle}
              </button>
            )}

            {/* Disconnect option */}
            {onDisconnect && (
              <button
                onClick={handleActionClick(onDisconnect)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: "#EF4444",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#7F1D1D" : "#FEE2E2"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <UserX className="w-4 h-4 mr-3" style={{ color: "#EF4444" }} />
                {disconnectTitle}
              </button>
            )}

            {/* Delete option */}
            {/* {onDelete && (
              <button
                onClick={handleActionClick(onDelete)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: "#EF4444",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#7F1D1D" : "#FEE2E2"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <Trash2 className="w-4 h-4 mr-3" style={{ color: "#EF4444" }} />
                {deleteTitle}
              </button>
            )} */}
            {/* Delete option */}
            {onDelete && (
              <button
                onClick={handleActionClick(onDelete)}
                className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                style={{
                  color: "#EF4444",
                  backgroundColor: "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.mode === "Dark" ? "#7F1D1D" : "#FEE2E2"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <Trash2 className="w-4 h-4 mr-3" style={{ color: "#EF4444" }} />
                {deleteTitle}
              </button>
            )}

            {/* ✅ ADD THIS BLOCK BELOW */}
            {customActions?.length > 0 && (
              <>
                <div style={{ borderTop: "1px solid #e5e7eb", margin: "4px 0" }}></div>

                {customActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={handleActionClick(action.onClick)}
                    className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                    style={{
                      color: theme.mode === "Dark" ? "#F3F4F6" : "#1F2937",
                      backgroundColor: "transparent"
                    }}
                    onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      theme.mode === "Dark" ? "#374151" : "#F3F4F6")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    {action.icon && (
                      <action.icon
                        className="w-4 h-4 mr-3"
                        style={{ color: "#6B7280" }}
                      />
                    )}
                    {action.label}
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggleMenu}
        className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          backgroundColor: isOpen ? theme.bgColor : "transparent",
        }}
        title="Actions"
        aria-label="Open action menu"
      >
        <MoreVertical
          className="w-4 h-4"
          style={{ color: getIconColor() }}
        />
      </button>

      {isOpen && ReactDOM.createPortal(menuContent, document.body)}
    </>
  );
};

export default ThreeDotsMenu;