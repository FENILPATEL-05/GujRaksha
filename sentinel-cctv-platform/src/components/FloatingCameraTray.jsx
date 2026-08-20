import React, { useState } from 'react';

export const FloatingCameraTray = ({ cameras, onCameraSelect, onEditCamera }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="floating-camera-tray" style={{ height: isOpen ? '360px' : '44px' }}>
      <div className="tray-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="tray-title">
          <i className="fa-solid fa-layer-group"></i> Camera Registry ({cameras.length})
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {isOpen ? <i className="fa-solid fa-chevron-down"></i> : <i className="fa-solid fa-chevron-up"></i>}
        </div>
      </div>

      {isOpen && (
        <div className="tray-body">
          {cameras.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '16px' }}>
              No cameras match filters.
            </div>
          ) : (
            cameras.map(cam => {
              const isLive = cam.stream_url && cam.stream_url.includes('live.sentinelgujarat.in');

              return (
                <div
                  key={cam.id}
                  className="tray-card"
                  onClick={() => onCameraSelect(cam)}
                >
                  <div className="tray-card-info">
                    <div className="tray-card-name">
                      {cam.name}
                    </div>
                    <div className="tray-card-sub">
                      {cam.camera_code} • {cam.district} • {cam.department_name || cam.department_id}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isLive && (
                      <span style={{ color: 'var(--accent-gold)', fontSize: '0.7rem', fontWeight: 800 }}>
                        LIVE
                      </span>
                    )}
                    <button
                      className="btn-clean btn-clean-outline"
                      style={{ padding: '3px 6px', fontSize: '0.72rem' }}
                      title="Edit Camera"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCamera(cam);
                      }}
                    >
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
