import React from "react";
import { Sidebar } from "primereact/sidebar";
import { useTheme } from "../Settings/themeUtils";

export const RightSideDialog = ({ 
  visible, 
  onHide, 
  header, 
  children,
  className = "",
  width = "w-full md:w-[30rem] lg:w-[40rem]"
}) => {
  const { themeUtils } = useTheme();

  return (
    <>
      <style>{`
        .custom-right-dialog.p-sidebar {
          width: max-content !important;
          max-width: 100vw !important;
        }
      `}</style>
      <Sidebar 
        visible={visible} 
        position="right" 
        onHide={onHide}
        header={<h2 className="text-xl font-bold">{header}</h2>}
        className={`custom-right-dialog !m-4 !h-[calc(100vh-2rem)] rounded-2xl shadow-2xl overflow-hidden ${className}`}
        pt={{
        mask: {
          className: "backdrop-blur-sm bg-black/30"
        },
        root: {
          style: {
            backgroundColor: themeUtils.getBgColor("default"),
            color: themeUtils.getTextColor(true),
            borderColor: themeUtils.getBorderColor(),
            borderWidth: "1px"
          }
        },
        header: {
          className: "px-8 py-4 border-b",
          style: {
            borderColor: themeUtils.getBorderColor(),
            backgroundColor: themeUtils.getBgColor("card"),
            color: themeUtils.getTextColor(true)
          }
        },
        content: {
          className: "px-8 py-8 hide-scrollbar",
          style: {
            backgroundColor: themeUtils.getBgColor("default"),
            color: themeUtils.getTextColor(true)
          }
        },
        closeIcon: {
          style: {
            color: themeUtils.getTextColor(false)
          }
        }
      }}
    >
      <div className={`${width} h-full`}>
        {children}
      </div>
    </Sidebar>
    </>
  );
};

export default RightSideDialog;
