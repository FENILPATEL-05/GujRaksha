import React, { useState } from 'react';
import {
  Radio,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  ZoomIn,
  ZoomOut,
  SquarePen,
  ExternalLink,
  Power,
  Copy,
  Check,
  Zap
} from 'lucide-react';
import { LiveCCTVFeed } from './LiveCCTVFeed';

export const StreamModal = ({ camera, onClose, onEditCamera }) => {
  const [copied, setCopied] = useState(false);

  if (!camera) return null;

  const resolveWhepUrl = (cam) => {
    if (!cam) return '';
    if (cam.whep_url && cam.whep_url.trim()) return cam.whep_url.trim();
    if (cam.urls && cam.urls.whep && cam.urls.whep.trim()) return cam.urls.whep.trim();
    if (cam.stream_url && (cam.stream_url.endsWith('/whep') || cam.stream_url.includes(':8889/'))) {
      return cam.stream_url.trim();
    }
    if (cam.rtsp_url && (cam.rtsp_url.includes(':8554/') || cam.rtsp_url.includes('/stream/'))) {
      const match = cam.rtsp_url.match(/rtsp:\/\/(?:[^@]+@)?([^:/]+):?(\d*)\/(.+)/);
      if (match) {
        return `http://${match[1]}:8889/${match[3]}/whep`;
      }
    }
    const currentHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
    const cleanId = String(cam.number || (cam.id || '').replace('gov-feed-', '').replace('cam-', '') || '1');
    return `http://${currentHost}:8889/stream/${cleanId}/whep`;
  };

  const whepUrl = resolveWhepUrl(camera);
  const rtspUrl = camera.rtsp_url || (camera.urls && camera.urls.rtsp) || camera.stream_url || '';

  const handleCopyWhep = () => {
    navigator.clipboard.writeText(whepUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3>
            <Radio size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Live Surveillance Feed — <span>{camera.name}</span>
          </h3>
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
                <div className="item"><span>Protocol / SLA</span><b style={{ color: 'var(--success)' }}>WHEP WebRTC (Ultra Low Latency)</b></div>
                <div className="item"><span>Codec & Res</span><b>{camera.codec || camera.stream_properties?.codec || 'H.264'} · {camera.stream_properties?.resolution || camera.resolution || '1080p FHD'}</b></div>
                <div className="item"><span>VMS Vendor</span><b>{camera.vms_vendor || 'Live Sentinel Feeder'}</b></div>
                <div className="item"><span>Status</span><b style={{ color: camera.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)' }}>{camera.status}</b></div>
                
                {/* WHEP Endpoint URL */}
                <div className="item" style={{ gridColumn: '1 / -1', background: 'rgba(34, 211, 238, 0.06)', border: '1px solid rgba(34, 211, 238, 0.2)', padding: '8px 10px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>WHEP URL</span>
                    <button
                      className="btn btn-sm"
                      onClick={handleCopyWhep}
                      style={{ fontSize: '10px', padding: '1px 6px', gap: '3px' }}
                    >
                      {copied ? <Check size={10} style={{ color: 'var(--success)' }} /> : <Copy size={10} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all', marginTop: '2px' }}>
                    {whepUrl}
                  </div>
                </div>
              </div>

              {/* PTZ Panel */}
              <div className="ptz-panel" style={{ marginTop: '12px' }}>
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
                    <a href={whepUrl} target="_blank" rel="noreferrer">
                      <button title="Open WHEP Link in Browser"><ExternalLink size={13} strokeWidth={2} /></button>
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={handleCopyWhep}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'WHEP Copied!' : 'Copy WHEP URL'}
            </button>
            <button className="btn btn-primary" onClick={() => window.open(whepUrl, '_blank')}>
              <ExternalLink size={14} strokeWidth={2} /> Open WHEP Endpoint
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

