import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { useTheme } from '../Settings/themeUtils';

export const Modal = ({ visible, onHide, header, children, width = 'w-[90%] md:w-[25rem]' }) => {
  const { themeUtils } = useTheme();

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onHide();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onHide]);

  // Prevent scrolling when open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onHide}
      />
      
      {/* Modal Content */}
      <div 
        className={`relative flex flex-col rounded-xl shadow-2xl overflow-hidden animate-fade-in ${width}`}
        style={{ 
          backgroundColor: themeUtils.getBgColor('card'),
          borderColor: themeUtils.getBorderColor(),
          borderWidth: '1px'
        }}
      >
        {/* Header */}
        <div 
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: themeUtils.getBorderColor() }}
        >
          <h3 className="text-lg font-semibold" style={{ color: themeUtils.getTextColor(true) }}>
            {header}
          </h3>
          <button 
            onClick={onHide}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FiX className="text-xl" style={{ color: themeUtils.getTextColor(false) }} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};
