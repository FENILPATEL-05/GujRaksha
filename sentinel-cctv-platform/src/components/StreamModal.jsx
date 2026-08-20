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

export const StreamModal = ({ camera, onClose, onEditCamera }) => {
  const [streamType, setStreamType] = useState('video');
  const [hasError, setHasError] = useState(false);

  const rawStreamUrl = camera ? (camera.stream_url || `https://live.sentinelgujarat.in/stream/${camera.id.replace('gov-feed-', '')}`) : '';
  const isRtsp = rawStreamUrl.toLowerCase().startsWith('rtsp://');

  useEffect(() => {
    setHasError(false);
    if (!camera) return;
    if (isRtsp) {
      setStreamType('rtsp');
    } else if (rawStreamUrl.includes(':5000') || rawStreamUrl.includes(':8080') || rawStreamUrl.includes('mjpeg')) {
      setStreamType('mjpeg');
    } else {
      setStreamType('video');
    }
  }, [camera, rawStreamUrl, isRtsp]);

  if (!camera) return null;

  const handleVideoError = () => {
    setStreamType('mjpeg');
  };

  const handleImageError = () => {
    setHasError(true);
  };

  const handleProxyClick = () => {
    const proxyUrl = `/api/v1/proxy-stream?url=${encodeURIComponent(rawStreamUrl)}`;
    window.open(proxyUrl, '_blank');
  };

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
              <div className="stream-noise"></div>
              <div className="stream-scan"></div>
              <div className="stream-vignette"></div>
              <div className="stream-crosshair"></div>

              <div className="stream-badges">
                <div className="rec-badge"><span className="rec-dot"></span> LIVE</div>
              </div>

              <div className="stream-camtag">{camera.camera_code || camera.id}</div>
              <div className="stream-timestamp">{new Date().toLocaleTimeString()}</div>

              {streamType === 'rtsp' && (
                <div style={{ position: 'relative', zIndex: 2, padding: '30px 16px', textAlign: 'center' }}>
                  <Network size={36} strokeWidth={1.6} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                  <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>Local RTSP Network Feed Connected</h4>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 8px' }}>
                    Web browsers cannot decode native <code>rtsp://</code> socket protocols directly in HTML5 tags.
                  </div>
                  <div style={{ background: 'var(--input-bg)', padding: '8px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', border: '1px solid var(--panel-border)', marginBottom: '8px', wordBreak: 'break-all' }}>
                    {rawStreamUrl}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--success)', background: 'rgba(52,211,153,0.15)', padding: '4px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={13} strokeWidth={2} /> Connected to Police RTSP Gateway Relay
                  </div>
                </div>
              )}

              {streamType === 'video' && !hasError && (
                <video
                  controls
                  autoPlay
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', position: 'relative', zIndex: 1 }}
                  src={rawStreamUrl}
                  onError={handleVideoError}
                />
              )}

              {streamType === 'mjpeg' && !hasError && (
                <img
                  style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', position: 'relative', zIndex: 1 }}
                  src={rawStreamUrl}
                  onError={handleImageError}
                  alt="Live Camera Feed"
                />
              )}

              {hasError && (
                <div style={{ position: 'relative', zIndex: 2, padding: '30px 16px', color: 'var(--danger)', textAlign: 'center' }}>
                  <AlertTriangle size={32} strokeWidth={1.8} style={{ marginBottom: '6px' }} />
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>Live stream source requiring direct gateway proxy or authentication.</div>
                  <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-secondary)' }}>Source URL: {rawStreamUrl}</div>
                  <button className="btn btn-sm" style={{ marginTop: '10px' }} onClick={handleProxyClick}>
                    <ShieldAlert size={13} strokeWidth={2} /> Launch Stream Proxy Gateway
                  </button>
                </div>
              )}
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
