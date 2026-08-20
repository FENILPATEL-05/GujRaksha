import React, { useState } from 'react';
import { Video, ChevronDown, ChevronUp, SquarePen } from 'lucide-react';

export const FloatingCameraTray = ({ cameras, onCameraSelect, onEditCamera }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={`floating camera-list-panel ${!isOpen ? 'collapsed' : ''}`} style={{ maxHeight: isOpen ? '420px' : '48px' }}>
      <div className="panel-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="htitle">
          <Video size={15} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Camera Feed List <span className="count-pill">{cameras.length}</span>
        </div>
        {isOpen ? <ChevronDown size={16} strokeWidth={2} /> : <ChevronUp size={16} strokeWidth={2} />}
      </div>

      {isOpen && (
        <div className="camera-list-body">
          {cameras.length === 0 ? (
            <div className="empty-note">
              No cameras match filters.
            </div>
          ) : (
            cameras.map(cam => {
              const isActive = cam.status === 'ACTIVE';

              return (
                <div
                  key={cam.id}
                  className="cam-row"
                  onClick={() => onCameraSelect(cam)}
                >
                  <span className={`dot ${isActive ? 'active' : 'offline'}`}></span>
                  <div className="meta">
                    <div className="name">{cam.name}</div>
                    <div className="sub">{cam.camera_code} · {cam.district} · {cam.department_name || cam.department_id}</div>
                  </div>
                  <button
                    className="cam-edit-btn"
                    title="Edit Camera"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCamera(cam);
                    }}
                  >
                    <SquarePen size={13} strokeWidth={2.2} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
