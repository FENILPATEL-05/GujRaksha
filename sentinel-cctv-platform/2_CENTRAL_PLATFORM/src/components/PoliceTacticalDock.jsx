import React, { useState } from 'react';
import {
  X,
  Maximize2,
  Crosshair,
  Copy,
  Check
} from 'lucide-react';
import { LiveCCTVFeed } from './LiveCCTVFeed';

export const PoliceTacticalDock = ({
  camera,
  onClose,
  onOpenFullScreen,
  onFocusMap
}) => {
  const [copied, setCopied] = useState(false);

  if (!camera) return null;

  const handleCopyGps = () => {
    const text = `${camera.latitude}, ${camera.longitude}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="police-tactical-dock">
      {/* 1. Sleek Top Header */}
      <div className="dock-header">
        <div className="dock-cam-name" title={camera.name}>
          <span className="live-rec-dot"></span>
          <b>{camera.camera_code || camera.id}</b>
          <span className="cam-sep">·</span>
          <span className="cam-subname">{camera.name}</span>
        </div>

        <div className="dock-header-actions">
          <button
            className="dock-tool-btn"
            title="Open Fullscreen Feed"
            onClick={() => onOpenFullScreen && onOpenFullScreen(camera)}
          >
            <Maximize2 size={13} />
          </button>
          <button
            className="dock-tool-btn dock-close-btn"
            title="Close Monitor"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 2. Pure Unobstructed Video Player (Zero Overlapping Text) */}
      <div className="dock-video-container">
        <LiveCCTVFeed camera={camera} isMuted={true} isDetailed={false} />
      </div>

      {/* 3. Camera Details & Controls BELOW the Stream */}
      <div className="dock-bottom-details">
        {/* Action Buttons Row */}
        <div className="dock-quick-actions-row">
          <button
            className="btn btn-sm btn-primary dock-action-btn"
            onClick={() => onOpenFullScreen && onOpenFullScreen(camera)}
            title="Open in Full Control Room Modal"
          >
            <Maximize2 size={12} />
            <span>Full Intercept</span>
          </button>

          <button
            className="btn btn-sm dock-action-btn"
            onClick={handleCopyGps}
            title="Copy GPS Coordinates"
          >
            {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'GPS'}</span>
          </button>

          <button
            className="btn btn-sm dock-action-btn"
            onClick={() => onFocusMap && onFocusMap(camera)}
            title="Recenter Map on Camera"
          >
            <Crosshair size={12} />
            <span>Focus Map</span>
          </button>
        </div>

        {/* 2x2 Telemetry Info Grid */}
        <div className="dock-meta-footer">
          <div className="dock-meta-item">
            <span className="lbl">Department</span>
            <span className="val" title={camera.department_name || camera.department_id || 'Home Department / Gujarat Police'}>
              {camera.department_name || camera.department_id || 'Gujarat Police'}
            </span>
          </div>
          <div className="dock-meta-item">
            <span className="lbl">District / Sector</span>
            <span className="val" title={camera.district || 'Gujarat'}>
              {camera.district || 'Gujarat'}
            </span>
          </div>
          <div className="dock-meta-item">
            <span className="lbl">AI Inference Mode</span>
            <span className="val ai-mode" title={camera.detection_mode}>
              {camera.detection_mode === 'ANPR_DETECTION' ? 'ANPR Plate Track' : (camera.detection_mode || 'Surveillance')}
            </span>
          </div>
          <div className="dock-meta-item">
            <span className="lbl">Network SLA</span>
            <span className={`status-pill ${camera.status === 'ACTIVE' ? 'online' : 'offline'}`}>
              {camera.status === 'ACTIVE' ? '● ONLINE' : '● OFFLINE'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
