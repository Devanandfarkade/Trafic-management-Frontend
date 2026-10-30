// Logo.js
import { Layers } from "lucide-react";
import { useTheme } from "../Settings/themeUtils";

const Logo = ({ isCollapsed }) => {
  const { theme, themeUtils } = useTheme();

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center shadow-lg flex-shrink-0"
        style={{ backgroundColor: theme.headerBg }}
      >
        <Layers className="w-6 h-6 text-white" strokeWidth={2.5} />
      </div>
      <span
        className={`text-xl font-bold tracking-tight transition-opacity duration-300 ${
          isCollapsed ? "opacity-0 w-0" : "opacity-100"
        }`}
        style={{ color: themeUtils.getTextColor(true) }}
      >
        RAJYUG
      </span>
    </div>
  );
};

export default Logo;
