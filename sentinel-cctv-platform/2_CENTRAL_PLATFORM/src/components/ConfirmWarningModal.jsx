import React from 'react';
import { AlertTriangle, AlertCircle, Trash2, X, RefreshCw } from 'lucide-react';

export const ConfirmWarningModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Warning',
  message = 'Are you sure you want to proceed with this action?',
  submessage,
  confirmText = 'Confirm & Proceed',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'warning' | 'info'
  isLoading = false
}) => {
  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const isWarning = type === 'warning';

  const themeColors = {
    bg: isDanger ? 'rgba(239, 68, 68, 0.14)' : isWarning ? 'rgba(245, 158, 11, 0.14)' : 'rgba(34, 211, 238, 0.14)',
    border: isDanger ? 'rgba(239, 68, 68, 0.4)' : isWarning ? 'rgba(245, 158, 11, 0.4)' : 'rgba(34, 211, 238, 0.4)',
    color: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#22d3ee',
    btnClass: isDanger ? 'btn btn-danger' : isWarning ? 'btn btn-warning' : 'btn btn-primary'
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div
        className="modal modal-sm"
        style={{
          maxWidth: '440px',
          width: '92%',
          background: 'var(--panel-bg)',
          border: `1px solid ${themeColors.border}`,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)'
        }}
      >
        <div className="modal-head" style={{ borderBottom: '1px solid var(--panel-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: themeColors.bg,
                border: `1px solid ${themeColors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: themeColors.color,
                flexShrink: 0
              }}
            >
              {isDanger ? (
                <Trash2 size={16} strokeWidth={2.4} />
              ) : (
                <AlertTriangle size={16} strokeWidth={2.4} />
              )}
            </div>
            <h3 style={{ margin: 0, fontSize: '14.5px', color: 'var(--text-primary)' }}>{title}</h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={isLoading}>
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 22px' }}>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              wordBreak: 'break-word'
            }}
          >
            {message}
          </div>

          {submessage && (
            <div
              style={{
                marginTop: '12px',
                fontSize: '11.5px',
                color: 'var(--text-dim)',
                background: 'var(--input-bg)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--panel-border)',
                lineHeight: 1.4
              }}
            >
              {submessage}
            </div>
          )}
        </div>

        <div
          className="modal-foot"
          style={{
            padding: '12px 22px',
            background: 'var(--input-bg)',
            borderTop: '1px solid var(--panel-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={isLoading}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={themeColors.btnClass}
            onClick={() => {
              if (onConfirm) onConfirm();
            }}
            disabled={isLoading}
            style={{
              fontSize: '12px',
              padding: '6px 16px',
              fontWeight: 700,
              gap: '6px'
            }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={13} className="spin-animation" /> Processing...
              </>
            ) : (
              <>
                {isDanger && <Trash2 size={13} strokeWidth={2.2} />}
                {isWarning && <AlertTriangle size={13} strokeWidth={2.2} />}
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
