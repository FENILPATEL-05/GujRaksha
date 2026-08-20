import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';

export const MapView = ({ cameras, onCameraSelect }) => {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!leafletMap.current && mapRef.current) {
      leafletMap.current = L.map(mapRef.current, {
        center: [22.2587, 71.1924],
        zoom: 7,
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

      let color = '#fbbf24'; // Police Gold
      if (cam.status === 'OFFLINE') color = '#ef4444';
      if (cam.status === 'MAINTENANCE') color = '#f59e0b';
      if (cam.department_id === 'TRANSPORT') color = '#0284c7';
      if (cam.department_id === 'CIVIL_SUPPLIES') color = '#f59e0b';
      if (cam.department_id === 'PORTS') color = '#06b6d4';

      const isGovLive = cam.stream_url && cam.stream_url.includes('live.sentinelgujarat.in');

      const iconHtml = `
        <div style="
          position: relative;
          width: 32px;
          height: 32px;
          background: ${color};
          border-radius: 50%;
          border: 2px solid #050b14;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(0,0,0,0.5);
          color: #050b14;
          font-size: 14px;
        ">
          <i class="fa-solid fa-camera"></i>
          ${isGovLive ? '<div style="position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background: #ff6b00; border-radius: 50%; border: 1.5px solid #050b14;"></div>' : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([cam.latitude, cam.longitude], { icon: customIcon });

      const popupHtml = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px;">
          <div style="font-size: 0.72rem; font-weight: 800; color: #d97706; margin-bottom: 2px;">${cam.camera_code}</div>
          <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a; margin-bottom: 6px;">${cam.name}</div>
          <div style="font-size: 0.75rem; color: #475569; margin-bottom: 8px;">
            <div><b>Department:</b> ${cam.department_name || cam.department_id}</div>
            <div><b>District:</b> ${cam.district}</div>
            <div><b>SLA Status:</b> <span style="font-weight: 700; color: ${cam.status === 'ACTIVE' ? '#16a34a' : '#dc2626'}">${cam.status}</span></div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        onCameraSelect(cam);
      });

      markersLayer.current.addLayer(marker);
    });

    if (leafletMap.current) leafletMap.current.invalidateSize();
  }, [cameras, onCameraSelect]);

  return (
    <main className="map-container">
      <div id="gis-map" ref={mapRef}></div>

      {/* 3D Map Legend */}
      <div className="map-legend-3d">
        <h4><i className="fa-solid fa-layer-group"></i> GIS State Layers</h4>
        <div className="legend-item"><span className="dot active"></span> Gujarat Police (Active)</div>
        <div className="legend-item"><span class="dot transport"></span> Gujarat RTO / Transport</div>
        <div className="legend-item"><span class="dot supplies"></span> Food & Civil Supplies</div>
        <div className="legend-item"><span class="dot ports"></span> Maritime Board / Ports</div>
        <div className="legend-item"><span class="dot maintenance"></span> Maintenance Flag</div>
        <div className="legend-item"><span class="dot offline"></span> Offline Critical</div>
      </div>
    </main>
  );
};
