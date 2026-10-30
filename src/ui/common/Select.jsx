import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../Settings/themeUtils';
import { FiChevronDown } from 'react-icons/fi';

export const Select = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder,
  name,
  required,
  className = "" 
}) => {
  const { themeUtils } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder || "Select...";

  const handleSelect = (val) => {
    onChange({ target: { name, value: val } });
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pl-3 pr-8 py-2 text-sm rounded border cursor-pointer flex items-center justify-between transition-colors shadow-sm hover:opacity-90"
        style={{ 
          backgroundColor: themeUtils.getBgColor("default"), 
          borderColor: isOpen ? '#3b82f6' : themeUtils.getBorderColor(), 
          color: themeUtils.getTextColor(true) 
        }}
      >
        <span className="truncate">{displayLabel}</span>
      </div>
      
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
        <FiChevronDown className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} style={{ color: !isOpen ? themeUtils.getTextColor(false) : undefined }} />
      </div>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-1 rounded-md shadow-xl border overflow-hidden backdrop-blur-md"
          style={{ 
            backgroundColor: themeUtils.getBgColor("card"), 
            borderColor: themeUtils.getBorderColor() 
          }}
        >
          <ul className="max-h-60 overflow-auto hide-scrollbar py-1">
            {placeholder && (
              <li 
                onClick={() => handleSelect("")}
                className="px-4 py-2.5 text-sm cursor-pointer hover:bg-blue-500/10 transition-colors"
                style={{ color: themeUtils.getTextColor(false) }}
              >
                {placeholder}
              </li>
            )}
            {options.map((option, index) => (
              <li 
                key={index}
                onClick={() => handleSelect(option.value)}
                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-blue-500/10 ${value === option.value ? 'bg-blue-500/10' : ''}`}
                style={{ 
                  color: value === option.value ? '#3b82f6' : themeUtils.getTextColor(true),
                  fontWeight: value === option.value ? 'bold' : 'normal'
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Select;
