import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useTheme } from "../Settings/themeUtils";

// PrimeReact Toast
import { Toast } from "primereact/toast";

// Import PrimeReact CSS for proper styling
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-blue/theme.css";

const SweetAlert = ({
  type = "success",
  title,
  message,
  showConfirm = true,
  confirmText = "OK",
  showCancel = false,
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  onClose,
  autoClose = false,
  autoCloseTime = 3000,
  variant = "modal",
  confirmVariant = "primary",
  cancelVariant = "default",
  id,
}) => {
  const { themeUtils, theme } = useTheme();
  const [isVisible, setIsVisible] = useState(true);
  const toastRef = useRef(null);
  const hasShownToast = useRef(false);

  // Auto-close logic for modal
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  useEffect(() => {
    if (autoClose && isVisible && variant === "modal") {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseTime);
      return () => clearTimeout(timer);
    }
  }, [autoClose, isVisible, autoCloseTime, variant]);

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    handleClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    handleClose();
  };


  // Show PrimeReact toast when in toast mode
  useEffect(() => {
    if (!isVisible || !toastRef.current || hasShownToast.current) return;

    if (variant === "toast") {
      const severityMap = {
        success: "success",
        error: "error",
        warning: "warn",
        info: "info",
      };

      const severity = severityMap[type] || "info";
      
      hasShownToast.current = true;

      // Custom toast content with proper styling
      toastRef.current.show({
        severity,
        summary: title || (type === "success" ? "Success" : 
                          type === "error" ? "Error" : 
                          type === "warning" ? "Warning" : "Info"),
        detail: message,
        life: autoClose ? autoCloseTime : 3000,
        closable: true,
        className: `custom-toast-${type}`,
        content: (
          <div className="flex items-center gap-3 p-2" style={{ minWidth: '300px' }}>
            {type === "success" && <CheckCircle className="w-6 h-6 text-white" />}
            {type === "error" && <XCircle className="w-6 h-6 text-white" />}
            {type === "warning" && <AlertTriangle className="w-6 h-6 text-white" />}
            {type === "info" && <Info className="w-6 h-6 text-white" />}
            <div className="flex flex-col flex-1">
              <span className="font-semibold text-base text-white">
                {title || (type === "success" ? "Success" : 
                          type === "error" ? "Error" : 
                          type === "warning" ? "Warning" : "Info")}
              </span>
              <span className="text-sm text-white opacity-90">{message}</span>
            </div>
          </div>
        )
      });

      if (autoClose) {
        setTimeout(() => {
          handleClose();
        }, autoCloseTime + 400);
      }
    }
  }, [isVisible, variant, type, title, message, autoClose, autoCloseTime]);

  if (!isVisible) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  // TOAST MODE - with centered positioning
  if (variant === "toast") {
    return (
      <>
        <style jsx global>{`
          .p-toast {
            opacity: 1 !important;
            max-width: 400px !important;
            width: auto !important;
          }
          .p-toast .p-toast-message {
            border-radius: 12px !important;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2) !important;
            margin-bottom: 1rem !important;
            border: none !important;
            overflow: hidden !important;
          }
          .p-toast .p-toast-message-content {
            padding: 0 !important;
            align-items: center !important;
            background: transparent !important;
          }
          .p-toast .p-toast-icon-close {
            position: absolute !important;
            top: 12px !important;
            right: 12px !important;
            width: 24px !important;
            height: 24px !important;
            color: white !important;
            opacity: 0.8 !important;
            background: rgba(255, 255, 255, 0.2) !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s ease !important;
          }
          .p-toast .p-toast-icon-close:hover {
            opacity: 1 !important;
            background: rgba(255, 255, 255, 0.3) !important;
          }
          .p-toast .p-toast-icon-close svg {
            width: 16px !important;
            height: 16px !important;
          }
          
          /* Success Toast */
          .p-toast .p-toast-message.p-toast-message-success {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          }
          
          /* Error Toast */
          .p-toast .p-toast-message.p-toast-message-error {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
          }
          
          /* Warning Toast */
          .p-toast .p-toast-message.p-toast-message-warn {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
          }
          
          /* Info Toast */
          .p-toast .p-toast-message.p-toast-message-info {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
          }
          
          .p-toast .p-toast-message .p-toast-message-content .p-toast-detail {
            margin: 0 !important;
            color: white !important;
          }
          .p-toast .p-toast-message .p-toast-message-content .p-toast-summary {
            font-weight: 600 !important;
            color: white !important;
          }
          
          /* Center the toast container */
          .p-toast.p-toast-top-center {
            top: 20px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
          }
          .p-toast.p-toast-top-right {
            top: 20px !important;
            right: 20px !important;
          }
          .p-toast.p-toast-top-left {
            top: 20px !important;
            left: 20px !important;
          }
          .p-toast.p-toast-bottom-center {
            bottom: 20px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
          }
        `}</style>
        <Toast 
          ref={toastRef} 
          position="top-center" 
          className="custom-toast-container"
        />
      </>
    );
  }

  // MODAL MODE
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/30">
      <div
        className="rounded-xl border shadow-2xl max-w-md w-full animate-fade-in"
        style={{
          backgroundColor: themeUtils.getBgColor("card"),
          borderColor: themeUtils.getBorderColor(),
          animation: 'fadeIn 0.3s ease-out'
        }}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0">{icons[type]}</div>
            <div className="flex-1">
              <div className="flex items-start justify-between mb-3">
                <h3
                  className="text-lg font-semibold"
                  style={{ color: themeUtils.getTextColor(true) }}
                >
                  {title}
                </h3>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
                >
                  <X
                    className="w-5 h-5"
                    style={{ color: themeUtils.getTextColor(false) }}
                  />
                </button>
              </div>
              <p
                className="text-sm"
                style={{ color: themeUtils.getTextColor(false) }}
              >
                {message}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            {showCancel && (
              <button
                onClick={handleCancel}
                className="px-5 py-2 rounded-lg font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor:
                    cancelVariant === "danger"
                      ? "#ef4444"
                      : cancelVariant === "success"
                      ? "#10b981"
                      : themeUtils.getBgColor("hover"),
                  color:
                    cancelVariant === "danger" || cancelVariant === "success"
                      ? "#fff"
                      : themeUtils.getTextColor(true),
                }}
              >
                {cancelText}
              </button>
            )}

            {showConfirm && (
              <button
                onClick={handleConfirm}
                className="px-5 py-2 rounded-lg font-medium text-white transition-all hover:opacity-90"
                style={{
                  backgroundColor:
                    confirmVariant === "success" || type === "success"
                      ? "#10b981"
                      : confirmVariant === "danger" || type === "error"
                      ? "#ef4444"
                      : confirmVariant === "warning" || type === "warning"
                      ? "#f59e0b"
                      : "#3b82f6",
                }}
              >
                {confirmText}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Add animation keyframes */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

// Updated hook with unique ID generation
export const useSweetAlert = () => {
  const [alertConfig, setAlertConfig] = useState(null);
  const alertIdRef = useRef(0);

  const showAlert = (config) => {
    const newId = ++alertIdRef.current;
    setAlertConfig({ ...config, id: newId });
  };

  const AlertComponent = () => {
    if (!alertConfig) return null;
    return <SweetAlert key={alertConfig.id} {...alertConfig} onClose={() => setAlertConfig(null)} />;
  };

  return { showAlert, AlertComponent };
};

export default SweetAlert;