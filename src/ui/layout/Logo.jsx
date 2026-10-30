// Logo.jsx
import { useTheme } from "../Settings/themeUtils";

const Logo = ({ isCollapsed }) => {
  const { theme, themeUtils } = useTheme();

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
        <img
          src="/vite.png"
          alt="BICS Logo"
          className="w-full h-full object-contain drop-shadow-sm"
        />
      </div>
      <span
        className={`text-xl font-bold tracking-tight transition-opacity duration-300 ${isCollapsed ? "opacity-0 w-0" : "opacity-100"
          }`}
        style={{ color: themeUtils.getTextColor(true) }}
      >
        BICS
      </span>
    </div>
  );
};

export default Logo;
