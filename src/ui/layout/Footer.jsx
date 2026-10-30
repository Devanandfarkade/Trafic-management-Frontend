// Footer.js
import React from 'react';
import { useTheme } from '../Settings/themeUtils';

const Footer = () => {
  const { themeUtils } = useTheme();

  return (
    <footer 
      className="border-t py-1.5 mt-auto"
      style={{ 
        backgroundColor: themeUtils.getBgColor('card'),
        borderColor: themeUtils.getBorderColor()
      }}
    >
      <div className="max-w-7xl mx-auto h-full flex items-center justify-center px-2">
        <p className="text-sm" style={{ color: themeUtils.getTextColor(false) }}>
          &copy; {new Date().getFullYear()} RajYug IT Solutions Pvt.Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;