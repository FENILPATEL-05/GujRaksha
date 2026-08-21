import React, { useState, useEffect } from 'react';
import {
  Radio,
  X,
  Network,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  ZoomIn,
  ZoomOut,
  SquarePen,
  ExternalLink,
  Power
} from 'lucide-react';
import { LiveCCTVFeed } from './LiveCCTVFeed';

export const StreamModal = ({ camera, onClose, onEditCamera }) => {
  const rawStreamUrl = camera ? (camera.stream_url || `http://live.sentinelgujarat.in/stream/${camera.id.replace('gov-feed-', '')}`) : '';

  if (!camera) return null;

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3><Radio size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Live Stream — <span>{camera.name}</span></h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>
        <div className="modal-body">
          <div className="stream-modal-layout">
            {/* Left: Stream Monitor Screen */}
            <div className="stream-screen">
              <LiveCCTVFeed camera={camera} isMuted={true} isDetailed={true} />
            </div>

            {/* Right: Metadata Grid + PTZ Controls */}
            <div>
              <div className="stream-meta-grid">
                <div className="item"><span>District</span><b>{camera.district || '—'}</b></div>
                <div className="item"><span>Department</span><b>{camera.department_name || camera.department_id || '—'}</b></div>
                <div className="item"><span>Resolution</span><b>{camera.resolution || '1080p Full HD'}</b></div>
                <div className="item"><span>VMS Vendor</span><b>{camera.vms_vendor || 'Hikvision Platform'}</b></div>
                <div className="item"><span>Coordinates</span><b>{camera.latitude}, {camera.longitude}</b></div>
                <div className="item"><span>Status</span><b style={{ color: camera.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)' }}>{camera.status}</b></div>
              </div>

              {/* PTZ Panel */}
              <div className="ptz-panel">
                <div>
                  <div className="ptz-dpad">
                    <span></span><button title="Tilt Up"><ChevronUp size={13} strokeWidth={2.4} /></button><span></span>
                    <button title="Pan Left"><ChevronLeft size={13} strokeWidth={2.4} /></button>
                    <button className="center" title="Reset"><Home size={11} strokeWidth={2.2} /></button>
                    <button title="Pan Right"><ChevronRight size={13} strokeWidth={2.4} /></button>
                    <span></span><button title="Tilt Down"><ChevronDown size={13} strokeWidth={2.4} /></button><span></span>
                  </div>
                  <div className="ptz-label">Directional</div>
                </div>

                <div>
                  <div className="ptz-zoom">
                    <button title="Zoom In"><ZoomIn size={13} strokeWidth={2} /></button>
                    <button title="Zoom Out"><ZoomOut size={13} strokeWidth={2} /></button>
                  </div>
                  <div className="ptz-label">Zoom</div>
                </div>

                <div>
                  <div className="ptz-zoom">
                    <button title="Edit Camera" onClick={() => onEditCamera(camera)}><SquarePen size={13} strokeWidth={2} /></button>
                    <a href={rawStreamUrl} target="_blank" rel="noreferrer">
                      <button title="Open Stream Link"><ExternalLink size={13} strokeWidth={2} /></button>
                    </a>
                  </div>
                  <div className="ptz-label">Actions</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-danger-outline" onClick={onClose}><Power size={14} strokeWidth={2} /> Close Session</button>
          <button className="btn btn-primary" onClick={() => window.open(rawStreamUrl, '_blank')}><ExternalLink size={14} strokeWidth={2} /> Full Stream URL</button>
        </div>
      </div>
    </div>
  );
};
