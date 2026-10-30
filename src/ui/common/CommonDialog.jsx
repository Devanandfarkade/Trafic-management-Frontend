import React from "react";
import { Dialog } from "primereact/dialog";
import { useTheme } from "../Settings/themeUtils";
import PropTypes from "prop-types";
import { CardTitle } from "./Card";

// Reusable PrimeReact Dialog with centralized theming
const CommonDialog = ({
    header,
    visible,
    onHide,
    children,
    position = "center",
    style,
    className = "",
    footer,
    draggable = false,
    resizable = false,
    fullHeight = false, // If true, applies side-drawer styling
    width = "50vw", // Default width
    dismissableMask = true, // New prop to control click outside behavior
    closable = true, // Ensure close icon is visible by default
}) => {
    const { themeUtils } = useTheme();

    // Default styles based on "fullHeight" (Side Drawer mode) vs Standard Modal
    const defaultStyle = fullHeight
        ? {
            width: width || "75vw",
            height: "calc(100% - 40px)",
            marginRight: "20px",
            maxHeight: "100%",
            borderRadius: "12px",
            ...style,
        }
        : {
            width: width,
            borderRadius: "12px",
            ...style,
        };

    const defaultBreakpoints = fullHeight
        ? { "960px": "85vw", "641px": "95vw" }
        : { "960px": "75vw", "641px": "95vw" };

    const finalClassName = fullHeight
        ? `p-fluid h-full ${className}`
        : `p-fluid ${className}`;

    const renderHeader = () => {
        if (typeof header === 'string') {
            return <CardTitle>{header}</CardTitle>;
        }
        return header;
    };

    return (
        <Dialog
            header={renderHeader()}
            visible={visible}
            position={position}
            onHide={onHide}
            style={defaultStyle}
            breakpoints={defaultBreakpoints}
            modal={true} // Ensure modal is true for mask to work
            dismissableMask={dismissableMask} // Allows closing when clicking outside
            draggable={draggable}
            resizable={resizable}
            className={finalClassName}
            footer={footer}
            closable={closable} // Controls the close icon visibility
            maskStyle={{
                backdropFilter: "blur(8px)",
                backgroundColor: "rgba(0, 0, 0, 0.4)",
            }}
            contentStyle={{
                backgroundColor: themeUtils.getBgColor("default"),
                color: themeUtils.getTextColor(true),
                padding: "1rem",
                height: fullHeight ? "100%" : "auto",
                borderBottomLeftRadius: "12px",
                borderBottomRightRadius: "12px",
                overflow: "auto",
            }}
            headerStyle={{
                backgroundColor: themeUtils.getBgColor("default"),
                color: themeUtils.getTextColor(true),
                borderBottom: `1px solid ${themeUtils.getBorderColor()}`,
                padding: "1.25rem 1.5rem",
                fontWeight: 600,
                fontSize: "1.125rem",
                borderTopLeftRadius: "12px",
                borderTopRightRadius: "12px",
            }}
        >
            {children}
        </Dialog>
    );
};

CommonDialog.propTypes = {
    header: PropTypes.string,
    visible: PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired,
    children: PropTypes.node,
    position: PropTypes.string,
    style: PropTypes.object,
    className: PropTypes.string,
    footer: PropTypes.node,
    draggable: PropTypes.bool,
    resizable: PropTypes.bool,
    fullHeight: PropTypes.bool,
    width: PropTypes.string,
    dismissableMask: PropTypes.bool, // New prop type
    closable: PropTypes.bool, // New prop type for close icon
};

export default CommonDialog;