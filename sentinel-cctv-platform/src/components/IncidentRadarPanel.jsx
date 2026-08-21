import React, { useState } from 'react';
import {
  ShieldAlert,
  Car,
  AlertTriangle,
  Flame,
  Users,
  LocateFixed,
  Video,
  X,
  Zap,
  Radio,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export const IncidentRadarPanel = ({
  incidents,
  onLocate,
  onOpenStream,
  onDismiss
}) => {
  // Default is Closed as requested
  const [isOpen, setIsOpen] = useState(false);

  const getIncidentIcon = (type) => {
    switch (type) {
      case 'ANPR_HOTLIST':
        return <Car size={16} strokeWidth={2.2} />;
      case 'PERIMETER_BREACH':
        return <ShieldAlert size={16} strokeWidth={2.2} />;
      case 'TRAFFIC_VIOLATION':
        return <AlertTriangle size={16} strokeWidth={2.2} />;
      case 'SMOKE_FIRE':
        return <Flame size={16} strokeWidth={2.2} />;
      case 'CROWD_ANOMALY':
        return <Users size={16} strokeWidth={2.2} />;
      default:
        return <AlertTriangle size={16} strokeWidth={2.2} />;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="threat-severity-badge critical">CRITICAL</span>;
      case 'HIGH':
        return <span className="threat-severity-badge high">HIGH</span>;
      default:
        return <span className="threat-severity-badge warning">WARN</span>;
    }
  };

  return (
    <>
      {/* 1. Closed State: Floating Right-Edge Red Alert Trigger Tab */}
      {!isOpen && (
        <button
          className={`ai-threat-toggle-tab ${incidents.length > 0 ? 'has-threats' : ''}`}
          onClick={() => setIsOpen(true)}
          title="Open AI Threat & ANPR Live Radar Sidebar"
        >
          <div className="tab-beacon-core">
            <span className="tab-pulse-ring"></span>
            <Radio size={15} strokeWidth={2.4} />
          </div>
          <span className="tab-title">AI Threat Radar</span>
          {incidents.length > 0 ? (
            <span className="tab-count-badge">{incidents.length} Alert{incidents.length > 1 ? 's' : ''}</span>
          ) : (
            <span className="tab-status-ok">Normal</span>
          )}
        </button>
      )}

      {/* 2. Open State: Professional Right-Side Security Dispatch Drawer */}
      <aside className={`ai-threat-sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* Sidebar Header */}
        <div className="threat-sidebar-header">
          <div className="threat-header-left">
            <div className="threat-radar-badge">
              <Radio size={16} strokeWidth={2.4} />
              <span className="beacon-pulse-ring"></span>
            </div>
            <div>
              <div className="threat-sidebar-title">AI Threat Radar</div>
              <div className="threat-sidebar-sub">
                {incidents.length > 0 ? (
                  <span className="live-alert-count">
                    <span className="live-count-dot"></span> {incidents.length} Active Real-Time {incidents.length === 1 ? 'Threat' : 'Threats'}
                  </span>
                ) : (
                  <span className="all-clear-text">✓ All Systems Monitored & Normal</span>
                )}
              </div>
            </div>
          </div>

          <div className="threat-header-actions">
            <button
              className="btn-close-sidebar"
              onClick={() => setIsOpen(false)}
              title="Close Threat Sidebar"
            >
              <ChevronRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="threat-sidebar-body">
          {incidents.length === 0 ? (
            <div className="incident-empty-state">
              <div className="empty-radar-scan">
                <ShieldCheck size={32} strokeWidth={1.8} style={{ color: 'var(--success)' }} />
              </div>
              <div className="empty-title">Perimeter Secure</div>
              <p>No active security anomalies or ANPR hotlist hits detected on statewide GIS feeds.</p>
            </div>
          ) : (
            <div className="incident-cards-list">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className={`incident-alert-card ${incident.severity.toLowerCase()} ${incident.isNew ? 'flash-new' : ''}`}
                >
                  <div className="incident-card-top">
                    <div className="incident-type-icon-box">
                      {getIncidentIcon(incident.type)}
                    </div>
                    <div className="incident-title-area">
                      <div className="incident-card-title">{incident.title}</div>
                      <div className="incident-meta-time">
                        {incident.timeAgo || 'Just now'} · {incident.district}
                      </div>
                    </div>
                    {getSeverityBadge(incident.severity)}
                    <button
                      className="btn-dismiss-alert"
                      onClick={() => onDismiss(incident.id)}
                      title="Acknowledge & Dismiss"
                    >
                      <X size={14} strokeWidth={2.2} />
                    </button>
                  </div>

                  {incident.vehicleNo && (
                    <div className="vehicle-plate-box">
                      <span className="plate-flag">IND</span>
                      <span className="plate-number">{incident.vehicleNo}</span>
                      <span className="plate-badge">ANPR HIT</span>
                    </div>
                  )}

                  <div className="incident-card-desc">
                    <span className="incident-loc-pin">📍</span> <b>{incident.cameraName}</b> ({incident.cameraCode}) — {incident.description}
                  </div>

                  <div className="incident-card-actions">
                    <button
                      className="btn-action-track"
                      onClick={() => onLocate(incident)}
                    >
                      <LocateFixed size={13} strokeWidth={2.2} /> Locate & Track
                    </button>
                    <button
                      className="btn-action-feed"
                      onClick={() => onOpenStream(incident)}
                    >
                      <Video size={13} strokeWidth={2.2} /> Watch Feed
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
