
import React, { createContext, useContext, useRef } from 'react';
import { Toast } from 'primereact/toast';


import 'primereact/resources/primereact.min.css';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primeicons/primeicons.css';

const TOAST_STYLES = `
  /* Position container */
  .rj-toast-wrap {
    z-index: 99999 !important;
  }

  /* Card shape & shadow */
  .rj-toast-wrap .p-toast-message {
    border-radius: 10px !important;
    box-shadow: 0 6px 32px rgba(0,0,0,0.13), 0 1.5px 6px rgba(0,0,0,0.07) !important;
    margin-bottom: 10px !important;
    min-width: 320px !important;
    max-width: 400px !important;
    animation: rjSlideIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) !important;
  }

  @keyframes rjSlideIn {
    from { opacity: 0; transform: translateX(52px) scale(0.96); }
    to   { opacity: 1; transform: translateX(0)   scale(1);    }
  }

  /* Content padding */
  .rj-toast-wrap .p-toast-message-content {
    padding: 14px 16px !important;
    gap: 12px !important;
    align-items: flex-start !important;
  }

  /* Summary (title) */
  .rj-toast-wrap .p-toast-summary {
    font-size: 0.9rem !important;
    font-weight: 700 !important;
    line-height: 1.35 !important;
    margin-bottom: 3px !important;
  }

  /* Detail (message) */
  .rj-toast-wrap .p-toast-detail {
    font-size: 0.82rem !important;
    line-height: 1.5 !important;
    margin: 0 !important;
    opacity: 0.88 !important;
  }

  /* Icon size */
  .rj-toast-wrap .p-toast-message-icon {
    font-size: 1.25rem !important;
    margin-top: 2px !important;
  }

  /* Close button */
  .rj-toast-wrap .p-toast-icon-close {
    width: 24px !important;
    height: 24px !important;
    border-radius: 50% !important;
    transition: background 0.15s !important;
    margin-top: -2px !important;
  }
  .rj-toast-wrap .p-toast-icon-close:hover {
    background: rgba(0,0,0,0.07) !important;
  }
  .rj-toast-wrap .p-toast-icon-close .p-icon {
    width: 13px !important;
    height: 13px !important;
  }

  /* Severity specific backgrounds */
  /* SUCCESS - ADD (GREEN) */
  .rj-toast-wrap .p-toast-message-success {
    background-color: #f0fdf4 !important;
    border-left: 6px solid #22c55e !important;
    color: #15803d !important;
  }
  .rj-toast-wrap .p-toast-message-success .p-toast-summary { color: #15803d !important; }
  .rj-toast-wrap .p-toast-message-success .p-toast-detail { color: #166534 !important; }
  .rj-toast-wrap .p-toast-message-success .p-toast-message-icon { color: #22c55e !important; }

  /* WARN - UPDATE (LIGHT YELLOW) */
  .rj-toast-wrap .p-toast-message-warn {
    background-color: #fffbeb !important;
    border-left: 6px solid #f59e0b !important;
    color: #92400e !important;
  }
  .rj-toast-wrap .p-toast-message-warn .p-toast-summary { color: #92400e !important; }
  .rj-toast-wrap .p-toast-message-warn .p-toast-detail { color: #a16207 !important; }
  .rj-toast-wrap .p-toast-message-warn .p-toast-message-icon { color: #f59e0b !important; }

  /* ERROR - DELETE (RED) */
  .rj-toast-wrap .p-toast-message-error {
    background-color: #fef2f2 !important;
    border-left: 6px solid #ef4444 !important;
    color: #b91c1c !important;
  }
  .rj-toast-wrap .p-toast-message-error .p-toast-summary { color: #b91c1c !important; }
  .rj-toast-wrap .p-toast-message-error .p-toast-detail { color: #991b1b !important; }
  .rj-toast-wrap .p-toast-message-error .p-toast-message-icon { color: #ef4444 !important; }
`;

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const toastRef = useRef(null);

    React.useEffect(() => {
        if (document.getElementById('rj-toast-styles')) return;
        const el = document.createElement('style');
        el.id = 'rj-toast-styles';
        el.textContent = TOAST_STYLES;
        document.head.appendChild(el);
        return () => el.remove();
    }, []);

    const show = (severity, summary, detail = '', life = 3000) => {
        toastRef.current?.show({ severity, summary, detail, life });
    };

    const api = {
        success: (summary, detail, life) => show('success', summary, detail, life),
        info: (summary, detail, life) => show('info', summary, detail, life),
        warn: (summary, detail, life) => show('warn', summary, detail, life),
        error: (summary, detail, life) => show('error', summary, detail, life),
        secondary: (summary, detail, life) => show('secondary', summary, detail, life),
        contrast: (summary, detail, life) => show('contrast', summary, detail, life),
        raw: (opts) => toastRef.current?.show(opts),
        clear: () => toastRef.current?.clear(),
    };

    return (
        <ToastContext.Provider value={api}>
            {children}
            <Toast
                ref={toastRef}
                position="top-center"
                className="rj-toast-wrap"
                style={{ zIndex: 99999 }}
            />
        </ToastContext.Provider>
    );
};


export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used inside <ToastProvider>. Check that your App.jsx wraps everything with it.');
    }
    return ctx;
};

export default ToastProvider;
