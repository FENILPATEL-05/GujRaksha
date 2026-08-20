import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import { Plus, Minus, Crosshair } from 'lucide-react';

export const MapView = ({ cameras, onCameraSelect }) => {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!leafletMap.current && mapRef.current) {
      // Bounding Box (expanded on the West/Left to include Arabian Sea coast comfortably)
      const mapBounds = [
        [6.0, 64.5],   // South-West coordinates (extended West for Gujarat coastline)
        [37.5, 97.5]   // North-East coordinates
      ];

      leafletMap.current = L.map(mapRef.current, {
        center: [22.35, 70.6], // Balanced center keeping Gujarat prominently in view
        zoom: 7,
        minZoom: 6,
        maxBounds: mapBounds,
        maxBoundsViscosity: 0.9,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(leafletMap.current);
      markersLayer.current = L.layerGroup().addTo(leafletMap.current);
    }

    // Dynamic Light / Dark Tile Layer Switching
    if (tileLayerRef.current) {
      leafletMap.current.removeLayer(tileLayerRef.current);
    }

    const tileUrl = theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; Government of Gujarat GIS',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap.current);

    // Invalidate map size so Leaflet fills full 100% container height
    setTimeout(() => {
      if (leafletMap.current) leafletMap.current.invalidateSize();
    }, 100);

    const handleResize = () => {
      if (leafletMap.current) leafletMap.current.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);

  }, [theme]);

  // Render Camera Markers
  useEffect(() => {
    if (!leafletMap.current || !markersLayer.current) return;
    markersLayer.current.clearLayers();

    cameras.forEach(cam => {
      if (!cam.latitude || !cam.longitude) return;

      const isActive = cam.status === 'ACTIVE';
      const isMaint = cam.status === 'MAINTENANCE';
      let statusClass = isActive ? 'active' : 'offline';
      if (isMaint) statusClass = 'maintenance';

      const iconHtml = `
        <div class="cam-pin ${statusClass}">
          <div class="ring"></div>
          <div class="core">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([cam.latitude, cam.longitude], { icon: customIcon });

      const popupHtml = `
        <div class="popup-card">
          <div class="popup-head">
            <div>
              <div class="pname">${cam.name}</div>
              <div class="pid">${cam.camera_code || cam.id}</div>
            </div>
            <span class="status-chip ${isActive ? 'active' : 'offline'}">${cam.status}</span>
          </div>
          <div class="popup-grid">
            <div><span>District</span><b>${cam.district || '—'}</b></div>
            <div><span>Department</span><b>${cam.department_name || cam.department_id || '—'}</b></div>
            <div><span>Type</span><b>${cam.camera_type || 'ANPR_SPECIAL'}</b></div>
            <div><span>Vendor</span><b>${cam.vms_vendor || 'Hikvision'}</b></div>
          </div>
          <button class="popup-stream-btn" id="stream-btn-${cam.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg> Watch Live Stream
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`stream-btn-${cam.id}`);
        if (btn) {
          btn.onclick = () => onCameraSelect(cam);
        }
      });

      markersLayer.current.addLayer(marker);
    });

    if (leafletMap.current) leafletMap.current.invalidateSize();
  }, [cameras, onCameraSelect]);

  const handleZoomIn = () => {
    if (leafletMap.current) leafletMap.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (leafletMap.current) leafletMap.current.zoomOut();
  };

  const handleRecenter = () => {
    if (leafletMap.current) {
      leafletMap.current.setView([22.35, 70.6], 7);
    }
  };

  return (
    <main className="map-hero-workspace">
      <div id="gis-map" ref={mapRef}></div>

      {/* Map Controls */}
      <div className="map-controls">
        <button onClick={handleZoomIn} title="Zoom in"><Plus size={18} strokeWidth={2.4} /></button>
        <button onClick={handleZoomOut} title="Zoom out"><Minus size={18} strokeWidth={2.4} /></button>
        <button onClick={handleRecenter} title="Recenter to Gujarat"><Crosshair size={18} strokeWidth={2} /></button>
      </div>

      {/* Floating Map Legend */}
      <div className="floating legend-panel">
        <div className="legend-title">Map Legend</div>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--success)', boxShadow: '0 0 0 3px var(--success-glow)' }}></span>
          Active Camera
        </div>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--danger)', boxShadow: '0 0 0 3px var(--danger-glow)' }}></span>
          Offline Critical
        </div>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--accent)' }}></span>
          Selected Node
        </div>
      </div>
    </main>
  );
};
