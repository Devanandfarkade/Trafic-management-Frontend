import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, ChevronDown, X, Menu, Plus } from "lucide-react";
import * as LucideIcons from "lucide-react";
import Logo from "./Logo";
import { useTheme } from "../Settings/themeUtils";

import { API_BASE_URL } from "../../../config";

const Sidebar = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  sidebarOpen,
  setSidebarOpen,
}) => {
  const location = useLocation();
  const [menuSections, setMenuSections] = useState([]);
  const [expanded, setExpanded] = useState({});
  const { theme, themeUtils } = useTheme();

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/api/sidemenu`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const result = await response.json();
        if (result.success && result.data) {
          setMenuSections(result.data);

          const initial = {};
          result.data.forEach((section) => {
            section.items?.forEach((item) => {
              if (item.type === "group" && item.defaultOpen) {
                initial[item.label] = true;
              }
            });
          });
          setExpanded(initial);
        }
      } catch (error) {
        console.error("Error fetching sidemenu:", error);
      }
    };
    fetchMenu();
  }, []);

  const isDark = theme.mode === "Dark";
  const textPrimary = themeUtils.getTextColor(true);
  const textMuted = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor("card");

  const activeBg = isDark ? `${theme.headerBg}35` : `${theme.headerBg}18`;
  const activeColor = theme.headerBg;

  const getIcon = (iconName) => {
    if (!iconName) return LucideIcons.Circle;
    return LucideIcons[iconName] || LucideIcons.Circle;
  };

  const isActivePath = (path) => {
    if (!path || path === "#") return false;
    const cleanPath = path.split('?')[0].replace(/\/+$/, '');
    const cleanLoc = location.pathname.replace(/\/+$/, '');
    if (!cleanPath) return false;
    return (
      cleanLoc === cleanPath ||
      (cleanPath !== "" && cleanPath !== "/" && cleanLoc.startsWith(cleanPath + "/"))
    );
  };

  const toggleGroup = (label) => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
    setExpanded((prev) => {
      const isCurrentlyOpen = !!prev[label];
      // Accordion behavior: close all other open groups, toggle current group
      return isCurrentlyOpen ? {} : { [label]: true };
    });
  };


  const closeMobile = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);
  const toggleMobileSidebar = () => setSidebarOpen(!sidebarOpen);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarOpen]);

  const groupHasActiveChild = (groupItem) => {
    if (groupItem.path && isActivePath(groupItem.path)) return true;
    return groupItem.children?.some((c) => isActivePath(c.path)) ?? false;
  };

  useEffect(() => {
    menuSections.forEach((section) => {
      section.items?.forEach((item) => {
        if (
          item.type === "group" &&
          groupHasActiveChild(item)
        ) {
          setExpanded((prev) => {
            if (prev[item.label]) return prev;
            return { [item.label]: true };
          });
        }
      });
    });
  }, [location.pathname, menuSections]);

  const renderBadge = (badge) => {
    if (!badge || isSidebarCollapsed) return null;
    const colors =
      badge.variant === "red"
        ? { bg: "#ef4444", text: "#fff" }
        : { bg: "#f97316", text: "#fff" };
    return (
      <span
        className="ml-auto flex-shrink-0 min-w-[18px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
        style={{ backgroundColor: colors.bg, color: colors.text }}
      >
        {badge.count}
      </span>
    );
  };

  const renderNavLink = (path, label, Icon, options = {}) => {
    const { indent = false, badge, isSubItem = false } = options;
    const active = isActivePath(path);

    return (
      <Link
        key={path + label}
        to={path}
        onClick={closeMobile}
        title={isSidebarCollapsed ? label : undefined}
        className={`flex items-center gap-3 w-full rounded-lg transition-all text-xs relative overflow-hidden group ${isSubItem ? "py-2" : "py-2.5"
          } ${indent ? "pl-8 pr-3" : "px-3"} ${active ? "font-semibold shadow-sm" : "font-medium hover:bg-white/5"
          }`}
        style={{
          backgroundColor: active ? activeBg : "transparent",
          color: active ? activeColor : textPrimary,
        }}
      >
        {active && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-current shadow-[0_0_8px_currentColor]"></div>
        )}
        <Icon
          className={`flex-shrink-0 ${isSubItem ? "w-3.5 h-3.5" : "w-4 h-4"}`}
          style={{ color: active ? activeColor : textMuted }}
        />
        {!isSidebarCollapsed && (
          <>
            <span className="truncate flex-1 text-left">{label}</span>
            {renderBadge(badge)}
          </>
        )}
      </Link>
    );
  };

  const renderGroup = (item) => {
    const Icon = getIcon(item.icon);
    const isOpen = expanded[item.label];
    const hasActiveChild = groupHasActiveChild(item);

    return (
      <div key={item.label} className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleGroup(item.label)}
          title={isSidebarCollapsed ? item.label : undefined}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-xs transition-all text-left relative overflow-hidden ${hasActiveChild ? "font-semibold shadow-sm" : "font-medium hover:bg-white/5"
            }`}
          style={{
            backgroundColor: hasActiveChild ? activeBg : "transparent",
            color: hasActiveChild ? activeColor : textPrimary,
          }}
        >
          {hasActiveChild && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-current shadow-[0_0_8px_currentColor]"></div>
          )}
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: hasActiveChild ? activeColor : textMuted }} />
          {!isSidebarCollapsed && (
            <>
              <span className="truncate flex-1">{item.label}</span>
              {isOpen ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: hasActiveChild ? activeColor : textMuted }} />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: hasActiveChild ? activeColor : textMuted }} />
              )}
            </>
          )}
        </button>

        {isOpen && !isSidebarCollapsed && (
          <div className="space-y-1 mt-1 relative before:absolute before:left-[19px] before:top-0 before:bottom-0 before:w-px before:bg-white/10">
            {item.children.map((child) => {
              const ChildIcon = getIcon(child.icon);
              return renderNavLink(child.path, child.label, ChildIcon, {
                indent: true,
                isSubItem: true,
              });
            })}
          </div>
        )}
      </div>
    );
  };

  const renderActionButton = (item) => {
    const Icon = getIcon(item.icon);
    return (
      <Link
        key={item.label}
        to={item.path}
        onClick={closeMobile}
        title={isSidebarCollapsed ? item.label : undefined}
        className={`flex items-center justify-center gap-2 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90 shadow-md ${isSidebarCollapsed ? "p-2 mx-0.5" : "w-full py-2 px-2"
          }`}
        style={{
          backgroundColor: theme.headerBg,
          color: "#ffffff",
        }}
      >
        {isSidebarCollapsed ? (
          <Plus className="w-5 h-5" />
        ) : (
          <>
            <Icon className="w-4 h-4" />
            {item.label}
          </>
        )}
      </Link>
    );
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <button
        onClick={toggleMobileSidebar}
        className="lg:hidden fixed top-2 left-2 z-50 w-8 h-8 flex items-center justify-center rounded-md shadow-md border"
        style={{ backgroundColor: cardBg, borderColor }}
      >
        <Menu className="w-4 h-4" style={{ color: textMuted }} />
      </button>

      <button
        onClick={toggleSidebar}
        className={`hidden lg:flex fixed top-2 z-40 w-8 h-8 items-center justify-center rounded-full shadow-md border transition-all duration-300 ${isSidebarCollapsed ? "left-[0.875rem]" : "left-52"
          }`}
        style={{
          backgroundColor: cardBg,
          borderColor,
          transform: isSidebarCollapsed ? "none" : "translateX(-50%)"
        }}
      >
        <ChevronRight
          className={`w-4 h-4 transition-transform ${isSidebarCollapsed ? "" : "rotate-180"
            }`}
          style={{ color: textPrimary }}
        />
      </button>

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen shadow-lg flex flex-col
          transition-all duration-300 ease-in-out
          ${isSidebarCollapsed ? "w-14" : "w-52"}
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:relative lg:z-auto
          min-w-0 flex-shrink-0
        `}
        style={{ backgroundColor: cardBg }}
      >
        <div
          className="h-12 flex items-center justify-between px-2 border-b flex-shrink-0"
          style={{ borderColor }}
        >
          <Logo isCollapsed={isSidebarCollapsed} />
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-md lg:hidden transition-colors"
            style={{ color: textMuted }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-1.5 py-2 overflow-y-auto hide-scrollbar flex flex-col gap-0.5">
          {menuSections.map((section, sectionIndex) => (
            <div
              key={section.title || `section-${sectionIndex}`}
              className={section.title ? "pt-2 first:pt-0" : ""}
            >
              {section.title && !isSidebarCollapsed && (
                <p
                  className="px-3 mb-2 mt-4 text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: theme.headerBg || "#3b82f6", opacity: 0.9 }}
                >
                  {section.title}
                </p>
              )}
              {section.title && isSidebarCollapsed && sectionIndex > 0 && (
                <div
                  className="mx-2 my-2 border-t"
                  style={{ borderColor }}
                />
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.type === "link") {
                    const Icon = getIcon(item.icon);
                    return renderNavLink(item.path, item.label, Icon, {
                      badge: item.badge,
                    });
                  }
                  if (item.type === "group") {
                    return renderGroup(item);
                  }
                  if (item.type === "action") {
                    return renderActionButton(item);
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
