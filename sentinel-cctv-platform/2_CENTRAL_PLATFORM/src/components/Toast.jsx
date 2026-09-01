import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer = ({ toasts, onDismiss }) => {
  return (
    <div id="toast-container">
      {toasts.map(toast => {
        let IconComponent = Info;
        if (toast.type === 'success') IconComponent = CheckCircle2;
        if (toast.type === 'error') IconComponent = AlertTriangle;
        if (toast.type === 'warning') IconComponent = AlertCircle;

        return (
          <div key={toast.id} className={`toast-item toast-${toast.type} show`}>
            <IconComponent size={18} strokeWidth={2.2} className="toast-icon" />
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => onDismiss(toast.id)}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
