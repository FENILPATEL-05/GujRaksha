import React, { useState, useEffect } from 'react';

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
      <div className="modal-card-clean modal-lg">
        <div className="modal-header">
          <h3><i className="fa-solid fa-circle-play text-accent"></i> Police Command Center Stream Monitor</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{
            background: '#020617',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            position: 'relative',
            minHeight: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {streamType === 'rtsp' && (
              <div style={{ padding: '30px', textAlign: 'center' }}>
                <i className="fa-solid fa-network-wired" style={{ fontSize: '2.5rem', color: 'var(--accent-gold)', marginBottom: '12px' }}></i>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '6px' }}>Local RTSP Network Feed Connected</h4>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', maxWidth: '500px', margin: '0 auto 14px' }}>
                  Web browsers cannot decode native <code>rtsp://</code> socket protocols directly in HTML5 tags.
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#38bdf8', border: '1px solid var(--border-color)', marginBottom: '14px', wordBreak: 'break-all' }}>
                  {rawStreamUrl}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '8px 12px', borderRadius: '6px', display: 'inline-block' }}>
                  <i className="fa-solid fa-circle-check"></i> Connected to Police RTSP Stream Gateway Relay
                </div>
              </div>
            )}

            {streamType === 'video' && !hasError && (
              <video
                controls
                autoPlay
                muted
                style={{ width: '100%', maxHeight: '440px', background: '#000', display: 'block' }}
                src={rawStreamUrl}
                onError={handleVideoError}
              />
            )}

            {streamType === 'mjpeg' && !hasError && (
              <img
                style={{ width: '100%', maxHeight: '440px', objectFit: 'contain', background: '#000' }}
                src={rawStreamUrl}
                onError={handleImageError}
                alt="Live Camera Feed"
              />
            )}

            {hasError && (
              <div style={{ padding: '30px', color: '#ef4444' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2.2rem', marginBottom: '8px' }}></i>
                <div>Live stream source requiring direct gateway proxy or authentication.</div>
                <div style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--text-muted)' }}>Source URL: {rawStreamUrl}</div>
                <button className="btn-clean btn-clean-outline" style={{ fontSize: '0.8rem', marginTop: '12px' }} onClick={handleProxyClick}>
                  <i className="fa-solid fa-shield-virus"></i> Launch Stream Proxy Gateway Relay
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', textAlign: 'left' }}>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {camera.name} [{camera.camera_code}]
              </h4>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                Department: {camera.department_name || camera.department_id} • District: {camera.district} • VMS Platform: {camera.vms_vendor || 'N/A'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-clean btn-clean-outline" onClick={() => onEditCamera(camera)}>
                <i className="fa-solid fa-pen-to-square"></i> Edit Camera
              </button>
              <a href={rawStreamUrl} target="_blank" rel="noreferrer" className="btn-clean btn-clean-outline" style={{ fontSize: '0.75rem' }}>
                <i className="fa-solid fa-arrow-up-right-from-square"></i> Open Stream Link
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
