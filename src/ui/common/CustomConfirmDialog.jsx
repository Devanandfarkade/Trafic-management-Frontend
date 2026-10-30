import React from 'react';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { useTheme } from "../../ui/Settings/themeUtils";

const CustomConfirmDialog = ({ visible, onHide, message, header, accept, reject, acceptLabel, rejectLabel }) => {
  const { themeUtils } = useTheme();
  const isDarkMode = themeUtils?.isDarkMode?.() || false;
  
  return (
    <ConfirmDialog
      visible={visible}
      onHide={onHide}
      message={message}
      header={header}
      accept={accept}
      reject={reject}
      acceptLabel={acceptLabel}
      rejectLabel={rejectLabel}
      style={{ width: '400px' }}
      contentStyle={{ padding: '0.5rem' }}
      pt={{
        // This creates the glass effect overlay behind the dialog
        mask: {
          style: {
            background: isDarkMode 
              ? 'rgba(0, 0, 0, 0.3)' 
              : 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }
        },
        // The dialog itself has normal theme background
        root: { 
          className: 'p-0',
          style: { 
            background: themeUtils.getBgColor('default'),
            border: `1px solid ${themeUtils.getBorderColor()}`,
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
          }
        },
        header: { 
          className: ' pb-0 border-0',
          style: { background: 'transparent' }
        },
        headerTitle: { 
          className: 'text-base font-semibold ',
          style: { color: themeUtils.getTextColor(true) }
        },
        content: { 
          className: 'p-1 pt-1',
          style: { background: 'transparent' }
        },
        message: { 
          className: 'text-sm  mb-5',
          style: { 
            marginTop: '0.25rem',
            color: themeUtils.getTextColor(false)
          }
        },
        icon: { 
          className: 'text-base mr-1',
          style: { fontSize: '1rem', color: themeUtils.getTextColor(false, true) }
        },
        footer: { 
          className: 'p-1 pt-0 flex justify-end gap-1',
          style: { background: 'transparent' }
        },
        rejectButton: { 
          className: 'p-button-text p-button-sm',
          style: { 
            padding: '0.5rem 1rem',
            background: 'transparent',
            color: themeUtils.getTextColor(true),
            borderColor: themeUtils.getBorderColor()
          }
        },
        acceptButton: { 
          className: 'p-button-sm',
          style: { 
            padding: '0.5rem 1rem',
            background: '#f44336',
            border: 'none',
            color: '#fff'
          }
        }
      }}
    />
  );
};

export default CustomConfirmDialog;