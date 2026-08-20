import React from 'react';

export const ToastContainer = ({ toasts, onDismiss }) => {
  return (
    <div id="toast-container">
      {toasts.map(toast => {
        let icon = 'fa-circle-info';
        if (toast.type === 'success') icon = 'fa-circle-check';
        if (toast.type === 'error') icon = 'fa-triangle-exclamation';
        if (toast.type === 'warning') icon = 'fa-circle-exclamation';

        return (
          <div key={toast.id} className={`toast-item toast-${toast.type} show`}>
            <i className={`fa-solid ${icon} toast-icon`}></i>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => onDismiss(toast.id)}>&times;</button>
          </div>
        );
      })}
    </div>
  );
};
