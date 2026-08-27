import React, { useState } from 'react';
import {
  ShieldAlert,
  Video,
  LocateFixed,
  X,
  Radio,
  ChevronRight,
  ShieldCheck,
  Trash2,
  Car,
  AlertTriangle
} from 'lucide-react';

export const IncidentRadarPanel = ({
  incidents = [],
  onLocate,
  onOpenStream,
  onDismiss
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = incidents.length;

  const handleDismissAll = () => {
    incidents.forEach(inc => onDismiss(inc.id));
  };

  return (
    <>
      {/* 1. Right-Edge Floating Trigger Tab */}
      <button
        className={`ai-threat-toggle-tab ${activeCount > 0 ? 'has-threats' : 'all-clear'}`}
        onClick={() => setIsOpen(!isOpen)}
        title={activeCount > 0 ? `${activeCount} Active AI Alerts` : 'All Security Feeds Normal'}
      >
        <div className="tab-beacon-core">
          {activeCount > 0 && <span className="tab-pulse-ring"></span>}
          <Radio size={14} strokeWidth={2.4} />
        </div>
        <span className="tab-title">AI Alerts</span>
        {activeCount > 0 ? (
          <span className="tab-count-badge">{activeCount}</span>
        ) : (
          <span className="tab-status-ok">0</span>
        )}
      </button>

      {/* 2. Slide-out Right Sidebar Drawer */}
      <aside className={`ai-threat-sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* Sidebar Header */}
        <div className="threat-sidebar-header">
          <div className="threat-header-left">
            <div className="threat-radar-badge">
              <ShieldAlert size={16} strokeWidth={2.4} />
            </div>
            <div>
              <div className="threat-sidebar-title">AI Threat Alerts</div>
              <div className="threat-sidebar-sub">
                {activeCount > 0 ? `${activeCount} Unread Security Alerts` : 'No active alerts'}
              </div>
            </div>
          </div>

          <div className="threat-header-actions">
            {activeCount > 0 && (
              <button
                className="btn-clear-all-alerts"
                onClick={handleDismissAll}
                title="Dismiss and mark all alerts as read"
              >
                Clear All
              </button>
            )}
            <button
              className="btn-close-sidebar"
              onClick={() => setIsOpen(false)}
              title="Close Alerts Drawer"
            >
              <ChevronRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Sidebar Content Body */}
        <div className="threat-sidebar-body">
          {activeCount === 0 ? (
            <div className="incident-empty-state">
              <div className="empty-radar-scan">
                <ShieldCheck size={36} strokeWidth={1.8} style={{ color: '#10b981' }} />
              </div>
              <div className="empty-title">All Systems Normal</div>
              <p>No unread AI security alerts or hotlist hits on Gujarat surveillance network.</p>
            </div>
          ) : (
            <div className="incident-cards-list">
              {incidents.map((incident) => (
                <div key={incident.id} className="easy-sidebar-alert-card">
                  {/* Card Top Title & Dismiss */}
                  <div className="card-top-row">
                    <div className="card-alert-title-wrap">
                      <span className="alarm-pulse-dot"></span>
                      <span className="card-alert-title">{incident.title || 'Security Threat Alert'}</span>
                    </div>
                    <button
                      className="btn-card-dismiss"
                      onClick={() => onDismiss(incident.id)}
                      title="Mark as read & dismiss (will not reappear on reload)"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* License Plate Banner (if ANPR) */}
                  {incident.vehicleNo && (
                    <div className="card-plate-section">
                      <div className="card-plate-box">
                        <span className="card-plate-ind">IND</span>
                        <span className="card-plate-num">{incident.vehicleNo}</span>
                      </div>
                      {incident.vehicle_type && (
                        <span className="card-vehicle-tag">{incident.vehicle_type}</span>
                      )}
                      {incident.vehicle_color && (
                        <span className="card-vehicle-tag">{incident.vehicle_color}</span>
                      )}
                    </div>
                  )}

                  {/* Camera & Location Info */}
                  <div className="card-location-info">
                    <span>📍 <b>{incident.cameraName || incident.cameraCode}</b></span>
                    <span>·</span>
                    <span>{incident.district || 'Gujarat'}</span>
                    <span>·</span>
                    <span className="card-time-ago">{incident.timeAgo || 'Just now'}</span>
                  </div>

                  {incident.description && (
                    <div className="card-description">
                      {incident.description}
                    </div>
                  )}

                  {/* Simple 1-Click Action Buttons */}
                  <div className="card-action-buttons">
                    <button
                      className="btn btn-sm btn-primary card-btn-stream"
                      onClick={() => onOpenStream(incident)}
                      title="Watch live stream in tactical dock"
                    >
                      <Video size={12} strokeWidth={2.4} />
                      <span>View Stream</span>
                    </button>

                    <button
                      className="btn btn-sm card-btn-locate"
                      onClick={() => onLocate(incident)}
                      title="Focus on map location"
                    >
                      <LocateFixed size={12} />
                      <span>Locate Map</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
