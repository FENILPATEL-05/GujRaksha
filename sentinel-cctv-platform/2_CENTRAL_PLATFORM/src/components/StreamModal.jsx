import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
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
  Power
} from 'lucide-react';
import { LiveCCTVFeed } from './LiveCCTVFeed';

const DISTRICT_FALLBACK = {
  'Ahmedabad': [23.0225, 72.5714], 'Surat': [21.1702, 72.8311], 'Vadodara': [22.3072, 73.1812],
  'Rajkot': [22.3039, 70.8022], 'Gandhinagar': [23.2156, 72.6369], 'Bhavnagar': [21.7645, 72.1519],
  'Jamnagar': [22.4707, 70.0577], 'Junagadh': [21.5222, 70.4579], 'Kutch': [23.242, 69.6669],
};

const MiniMap = ({ lat, lng, label }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      boxZoom: true,
      keyboard: false
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 18
    }).addTo(map);

    // Glowing cyan marker
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#22d3ee;border:2px solid #fff;box-shadow:0 0 10px #22d3ee,0 0 20px rgba(34,211,238,0.4);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    L.marker([lat, lng], { icon }).addTo(map);

    if (label) {
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="white-space:nowrap;font-size:10px;font-weight:700;color:#22d3ee;text-shadow:0 1px 4px #000;padding:2px 6px;background:rgba(0,0,0,0.6);border-radius:4px;transform:translateX(-50%);margin-top:4px;">${label}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, -12]
        })
      }).addTo(map);
    }

    mapInstance.current = map;

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [lat, lng, label]);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '160px',
        borderRadius: '8px',
        border: '1px solid var(--panel-border)',
        overflow: 'hidden'
      }}
    />
  );
};

export const StreamModal = ({ camera, onClose, onEditCamera }) => {
  if (!camera) return null;

  const isPTZ = (camera.camera_type || '').toUpperCase() === 'PTZ';

  // Resolve camera location
  let lat = parseFloat(camera.latitude);
  let lng = parseFloat(camera.longitude);
  if (isNaN(lat) || isNaN(lng)) {
    const fallback = DISTRICT_FALLBACK[camera.district];
    if (fallback) { lat = fallback[0]; lng = fallback[1]; }
  }
  const hasLocation = !isNaN(lat) && !isNaN(lng);

  return (
    <div className="modal-overlay">
      <div className="modal modal-xl">
        <div className="modal-head">
          <h3>
            <Radio size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Live Feed — <span>{camera.name}</span>
          </h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>
        <div className="modal-body">
          <div className="stream-modal-layout">
            {/* Left: Stream Monitor Screen */}
            <div className="stream-screen">
              <LiveCCTVFeed camera={camera} isMuted={true} isDetailed={true} showAiVision={false} />
            </div>

            {/* Right: Compact Info + Mini Map + PTZ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="stream-meta-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="item">
                  <span>Status</span>
                  <b style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: camera.status === 'ACTIVE' ? '#22c55e' : '#ef4444',
                      display: 'inline-block',
                      boxShadow: camera.status === 'ACTIVE' ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
                      flexShrink: 0
                    }} />
                    {camera.status}
                  </b>
                </div>
                <div className="item"><span>District</span><b>{camera.district || '—'}</b></div>
                <div className="item"><span>Department</span><b>{camera.department_name || camera.department_id || '—'}</b></div>
              </div>

              {/* Mini GIS Map */}
              {hasLocation && (
                <div>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-dim)', marginBottom: '5px', fontWeight: 600 }}>
                    Camera Location
                  </div>
                  <MiniMap lat={lat} lng={lng} label={camera.name} />
                </div>
              )}

              {/* PTZ Panel — only for PTZ cameras */}
              {isPTZ && (
                <div className="ptz-panel" style={{ marginTop: '4px' }}>
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
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-danger-outline" onClick={onClose}><Power size={14} strokeWidth={2} /> Close Session</button>
        </div>
      </div>
    </div>
  );
};
