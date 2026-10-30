import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Palette, Check, Droplet, Settings as SettingsIcon, ArrowLeft } from "lucide-react";
import { useTheme } from "./themeUtils";
import PageHeader from "../common/PageHeader";

const Settings = () => {
  const navigate = useNavigate();
  const { theme, updateTheme, themeUtils, ThemeToggleButton } = useTheme();
  const [isThemeOpen, setIsThemeOpen] = useState(true);
  const [isColorOpen, setIsColorOpen] = useState(true); // Changed to true so it starts open

  // Original color palettes
  const originalColorPalettes = [
    { dark: "#3b82f6", light: "#93c5fd", name: "Blue", category: "primary" },
    { dark: "#8b5cf6", light: "#c4b5fd", name: "Purple", category: "primary" },
    { dark: "#ec4899", light: "#f9a8d4", name: "Pink", category: "primary" },
    { dark: "#f59e0b", light: "#fcd34d", name: "Orange", category: "primary" },
    { dark: "#10b981", light: "#6ee7b7", name: "Green", category: "primary" },
    { dark: "#ef4444", light: "#fca5a5", name: "Red", category: "primary" },
    { dark: "#06b6d4", light: "#67e8f9", name: "Cyan", category: "secondary" },
    {
      dark: "#6366f1",
      light: "#a5b4fc",
      name: "Indigo",
      category: "secondary",
    },
    { dark: "#14b8a6", light: "#5eead4", name: "Teal", category: "secondary" },
    { dark: "#f97316", light: "#fdba74", name: "Amber", category: "secondary" },
    { dark: "#84cc16", light: "#bef264", name: "Lime", category: "secondary" },
    {
      dark: "#a855f7",
      light: "#d8b4fe",
      name: "Violet",
      category: "secondary",
    },
    { dark: "#1f2937", light: "#9ca3af", name: "Gray", category: "neutral" },
    { dark: "#4b5563", light: "#d1d5db", name: "Slate", category: "neutral" },
    { dark: "#374151", light: "#e5e7eb", name: "Zinc", category: "neutral" },
    { dark: "#1e293b", light: "#cbd5e1", name: "Stone", category: "neutral" },
    { dark: "#18181b", light: "#a1a1aa", name: "Neutral", category: "neutral" },
    {
      dark: "#0f172a",
      light: "#e2e8f0",
      name: "Midnight",
      category: "special",
    },
    { dark: "#581c87", light: "#e9d5ff", name: "Royal", category: "special" },
    { dark: "#14532d", light: "#dcfce7", name: "Forest", category: "special" },
    {
      dark: "#7c2d12",
      light: "#fed7aa",
      name: "Terracotta",
      category: "special",
    },
    { dark: "#831843", light: "#fce7f3", name: "Rose", category: "special" },
  ];

  // New requested palettes under "existing" category
  const existingColorPalettes = [
    {
      dark: "#909A89",
      light: "#fff",
      name: "Olive White",
      category: "existing",
    },
    {
      dark: "#3C3C3C",
      light: "#BDA588",
      name: "Charcoal Beige",
      category: "existing",
    },
    {
      dark: "#3F6289",
      light: "#D4E6EF",
      name: "Steel Blue",
      category: "existing",
    },
    {
      dark: "#515358",
      light: "#fff",
      name: "White Slate",
      category: "existing",
    },
    {
      dark: "#1F2A40",
      light: "#F1F5F9",
      name: "Navy Gray",
      category: "existing",
    },
    { dark: "#4B5563", light: "#E5E7EB", name: "Gray", category: "existing" },
    { dark: "#2D3748", light: "#E2E8F0", name: "Slate", category: "existing" },
    {
      dark: "#2563EB",
      light: "#DBEAFE",
      name: "Indigo Blue",
      category: "existing",
    },
    {
      dark: "#1E40AF",
      light: "#E0E7FF",
      name: "Royal Blue",
      category: "existing",
    },
    {
      dark: "#0F172A",
      light: "#F8FAFC",
      name: "Charcoal",
      category: "existing",
    },
    {
      dark: "#111827",
      light: "#F9FAFB",
      name: "Graphite",
      category: "existing",
    },
    {
      dark: "#10B981",
      light: "#D1FAE5",
      name: "Emerald",
      category: "existing",
    },
    { dark: "#F59E0B", light: "#FEF3C7", name: "Amber", category: "existing" },
    { dark: "#EF4444", light: "#FEE2E2", name: "Red", category: "existing" },
    {
      dark: "#6366F1",
      light: "#E0E7FF",
      name: "Periwinkle",
      category: "existing",
    },
    { dark: "#7C3AED", light: "#EDE9FE", name: "Violet", category: "existing" },
    { dark: "#14B8A6", light: "#CCFBF1", name: "Teal", category: "existing" },
    {
      dark: "#6B7280",
      light: "#F3F4F6",
      name: "Cool Gray",
      category: "existing",
    },
    { dark: "#78350F", light: "#FFEDD5", name: "Brown", category: "existing" },
    { dark: "#9D174D", light: "#FCE7F3", name: "Rose", category: "existing" },
    {
      dark: "#164E63",
      light: "#CFFAFE",
      name: "Deep Cyan",
      category: "existing",
    },
    { dark: "#F28B38", light: "#FCE8D5", name: "Orange", category: "existing" },
    { dark: "#F06292", light: "#FAD2E1", name: "Pink", category: "existing" },
    { dark: "#DB0011", light: "#404040", name: "HSBC", category: "existing" },
  ];

  // Combine all palettes
  const colorPalettes = [...originalColorPalettes, ...existingColorPalettes];

  const defaultColor = colorPalettes[0]; // Original default (Blue)

  const handleColorChange = (color) => {
    updateTheme({
      headerBg: color.dark,
      navbarBg: color.light,
    });
  };

  const groupedColors = colorPalettes.reduce((acc, color) => {
    if (!acc[color.category]) acc[color.category] = [];
    acc[color.category].push(color);
    return acc;
  }, {});

  return (
    <div
      className="min-h-screen py-4 px-2 transition-all duration-500"
      style={{ backgroundColor: themeUtils.getBgColor("default") }}
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-4">
        <PageHeader
          title="System Settings"
          subtitle="Customize dashboard theme and preferences"
          icon={SettingsIcon}
          rightContent={
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
              style={{
                borderColor: themeUtils.getBorderColor(),
                color: themeUtils.getTextColor(true),
              }}
              title="Return to Dashboard"
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>
          }
        />
        <div className="space-y-4">
          {/* Text Color Mode Section */}
          <div
            className={`${themeUtils.getBgColor(
              "card"
            )} border ${themeUtils.getBorderColor()} rounded-2xl shadow-lg overflow-hidden transition-all duration-300`}
          >
            <div
              className={`flex items-center justify-between cursor-pointer p-2 hover:bg-opacity-80 transition-colors`}
              style={{ backgroundColor: themeUtils.getBgColor("hover") }}
              onClick={() => setIsThemeOpen(!isThemeOpen)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: theme.headerBg }}
                >
                  <Droplet className="text-white" size={20} />
                </div>
                <h2
                  className="text-lg font-bold"
                  style={{ color: themeUtils.getTextColor(true) }}
                >
                  Text Colour Mode
                </h2>
              </div>
              <ThemeToggleButton
                className={`transition-transform duration-300 ${isThemeOpen ? "rotate-180" : ""
                  }`}
                size={24}
                style={{ color: themeUtils.getTextColor(false) }}
              />
            </div>
            {isThemeOpen && (
              <div
                className="p-0 border-t"
                style={{ borderColor: themeUtils.getBorderColor() }}
              />
            )}
          </div>

          {/* Colour Palette Section - Now independent of category clicks */}
          <div
            className={`${themeUtils.getBgColor(
              "card"
            )} border ${themeUtils.getBorderColor()} rounded-2xl shadow-lg overflow-hidden transition-all duration-300`}
          >
            <div
              className={`flex items-center justify-between cursor-pointer p-2 hover:bg-opacity-80 transition-colors`}
              style={{ backgroundColor: themeUtils.getBgColor("hover") }}
              onClick={() => setIsColorOpen(!isColorOpen)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: theme.headerBg }}
                >
                  <Palette className="text-white" size={20} />
                </div>
                <h2
                  className="text-lg font-bold"
                  style={{ color: themeUtils.getTextColor(true) }}
                >
                  Colour Palette
                </h2>
              </div>
              <ChevronDown
                className={`transition-transform duration-300 ${isColorOpen ? "rotate-180" : ""
                  }`}
                size={24}
                style={{ color: themeUtils.getTextColor(false) }}
              />
            </div>

            {isColorOpen && (
              <div
                className="p-6 border-t"
                style={{ borderColor: themeUtils.getBorderColor() }}
              >
                {/* Category Tabs - Clicking these NO LONGER collapses the section */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 whitespace-nowrap">
                  {Object.keys(groupedColors).map((category) => (
                    <button
                      key={category}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${theme.activeColorCategory === category
                          ? "shadow-md scale-105"
                          : ""
                        }`}
                      style={{
                        backgroundColor:
                          theme.activeColorCategory === category
                            ? theme.headerBg
                            : themeUtils.getBgColor("default"),
                        color:
                          theme.activeColorCategory === category
                            ? "#fff"
                            : themeUtils.getTextColor(false),
                      }}
                      onClick={(e) => {
                        // Prevent click from bubbling up to the parent (which toggles collapse)
                        e.stopPropagation();
                        updateTheme({ activeColorCategory: category });
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* Color Grid */}
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
                  {(
                    groupedColors[theme.activeColorCategory || "primary"] ||
                    groupedColors.primary
                  ).map((color, index) => (
                    <button
                      key={index}
                      className={`relative w-14 h-14 rounded-[50%] cursor-pointer transition-all duration-300 ${theme.headerBg === color.dark
                          ? "ring-4 ring-offset-2 ring-offset-transparent scale-110 shadow-xl"
                          : "hover:scale-105 shadow-md"
                        }`}
                      style={{
                        boxShadow:
                          theme.headerBg === color.dark
                            ? `0 0 0 4px ${theme.headerBg}40`
                            : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                      onClick={() => handleColorChange(color)}
                      title={color.name}
                    >
                      <div className="w-full h-full rounded-[50%] overflow-hidden">
                        <div
                          className="w-full h-1/2"
                          style={{ backgroundColor: color.light }}
                        ></div>
                        <div
                          className="w-full h-1/2"
                          style={{ backgroundColor: color.dark }}
                        ></div>
                      </div>
                      {theme.headerBg === color.dark && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check
                            className="text-white drop-shadow-lg"
                            size={22}
                          />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reset to Default */}
          <div className="mt-8 text-center">
            <button
              className="px-6 py-2 rounded-lg font-semibold text-white transition-all hover:scale-105"
              style={{
                backgroundColor: theme.headerBg,
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor =
                  theme.mode === "Dark"
                    ? `${theme.headerBg}dd`
                    : `${theme.headerBg}cc`;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = theme.headerBg;
              }}
              onClick={() => {
                updateTheme({
                  mode: "Dark",
                  headerBg: defaultColor.dark,
                  navbarBg: defaultColor.light,
                  mood: "Night",
                  activeColorCategory: "primary",
                });
              }}
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
