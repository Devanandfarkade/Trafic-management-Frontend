import React, { createContext, useState, useEffect, useContext } from "react";
import { Sun, Moon } from "lucide-react"; // ← Added for toggle icons

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

// Default color from index 0 of your palette
const defaultColor = { dark: "#3b82f6", light: "#93c5fd" };

const defaultTheme = {
  mode: "Dark",
  headerBg: defaultColor.dark,
  navbarBg: defaultColor.light,
  mood: "Night",
  activeColorCategory: "primary",
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const saved = localStorage.getItem("Theme");
    if (saved) {
      try {
        setTheme({ ...defaultTheme, ...JSON.parse(saved) });
      } catch {
        setTheme(defaultTheme);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("Theme", JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--header-bg", theme.headerBg);
    root.style.setProperty("--navbar-bg", theme.navbarBg);

    document.body.className = document.body.className
      .replace(/mood-\w+/g, "")
      .replace(/mode-\w+/g, "")
      .replace(/\bdark\b/g, "")
      .trim();
    document.body.classList.add(`mood-${theme.mood.toLowerCase()}`);
    document.body.classList.add(`mode-${theme.mode.toLowerCase()}`);

    if (theme.mode === "Dark" || theme.mood === "Night") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [theme]);

  const updateTheme = (newTheme) => {
    setTheme((prev) => ({ ...prev, ...newTheme }));
  };

  // New: Toggle between Light and Dark mode
  const toggleThemeMode = () => {
    setTheme((prev) => ({
      ...prev,
      mode: prev.mode === "Dark" ? "Light" : "Dark",
      mood: prev.mode === "Dark" ? "Day" : "Night",
    }));
  };

  const getTextColor = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return l > 0.5 ? "#000000" : "#FFFFFF";
  };

  const themeUtils = {
    getTextColor: (isPrimary = true) => {
      return theme.mode === "Dark"
        ? isPrimary
          ? "#FFFFFF"
          : "#E5E7EB"
        : isPrimary
          ? "#1F2937"
          : "#6B7280";
    },
    getBgColor: (variant = "default") => {
      if (variant === "card")
        return theme.mood === "Day" ? "#FFFFFF" : "#111827"; // Dark navy card
      if (variant === "input")
        return theme.mood === "Day" ? "#F9FAFB" : "#1e293b";
      if (variant === "hover")
        return theme.mood === "Day" ? "#F3F4F6" : "#1e293b";
      if (variant === "panel")
        return theme.mood === "Day" ? "#F9FAFB" : "#111827";
      return theme.mood === "Day" ? "#F9FAFB" : "#070b14"; // Deep dark background for main area
    },
    getBorderColor: () => (theme.mood === "Day" ? "#E5E7EB" : "rgba(30, 58, 138, 0.4)"), // Blueish border for dark mode
    getBgGradient: () =>
      theme.mood === "Day"
        ? "bg-gradient-to-br from-blue-50 via-white to-indigo-50"
        : "bg-[#070b14]", // Solid deep background instead of a harsh gradient
  };

  // Professional Theme Toggle Button
  const ThemeToggleButton = () => (
    <button
      onClick={toggleThemeMode}
      className="relative inline-flex items-center pl-0 h-8 w-15 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      style={{
        backgroundColor: theme.mode === "Dark" ? "#D6D3D1" : "#0F172B",
      }}
      aria-label="Toggle dark/light mode"
    >
      <span
        className="inline-block w-6 h-6 transform transition-transform duration-300 ease-in-out rounded-full bg-transparent shadow-lg flex items-center justify-center"
        style={{
          transform:
            theme.mode === "Dark" ? "translateX(30px)" : "translateX(4px)",
        }}
      >
        {theme.mode === "Dark" ? (
          <Moon className="w-4 h-4 mt-1 ml-1 text-gray-800" />
        ) : (
          <Sun className="w-4 h-4 mt-1 ml-1 text-yellow-500" />
        )}
      </span>
    </button>
  );

  return (
    <ThemeContext.Provider
      value={{ theme, updateTheme, themeUtils, ThemeToggleButton }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
