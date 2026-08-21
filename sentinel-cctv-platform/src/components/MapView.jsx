import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import { IncidentRadarPanel } from './IncidentRadarPanel';
import { Plus, Minus, Crosshair, Radio, ShieldAlert } from 'lucide-react';

export const MapView = ({ cameras, onCameraSelect, activeTrackVehicle = null, onClearTrackVehicle }) => {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(null);
  const trajectoryLayer = useRef(null);
  const markersMapRef = useRef({});
  const { theme } = useTheme();

  // Active Real-Time Incidents State (Fed directly from Real-Time AI / Watchlist Engine)
  const [incidents, setIncidents] = useState([]);
  const [trajectoryData, setTrajectoryData] = useState(null);

  // Fetch initial real active alerts from database
  const fetchActiveAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/anpr/alerts');
      const json = await res.json();
      if (json.success && json.data) {
        const formatted = json.data.map(alert => ({
          ...alert,
          timeAgo: formatTimeAgo(alert.createdAt),
          camera: cameras.find(c => c.id === alert.cameraId) || {
            id: alert.cameraId,
            name: alert.cameraName,
            camera_code: alert.cameraCode,
            district: alert.district,
            latitude: alert.latitude,
            longitude: alert.longitude
          }
        }));
        setIncidents(formatted);
      }
    } catch (err) {
      console.error('Error fetching real active alerts:', err);
    }
  }, [cameras]);

  // Connect to Live Server-Sent Events (SSE) Stream for Instant Push Alerts
  useEffect(() => {
    fetchActiveAlerts();

    let eventSource;
    try {
      eventSource = new EventSource('/api/v1/anpr/alerts/live');
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'ANPR_HOTLIST') {
            const cam = cameras.find(c => c.id === data.cameraId) || {
              id: data.cameraId,
              name: data.cameraName,
              camera_code: data.cameraCode,
              district: data.district,
              latitude: data.latitude,
              longitude: data.longitude
            };

            const incomingAlert = {
              ...data,
              timeAgo: 'Just now',
              camera: cam,
              isNew: true
            };

            setIncidents(prev => [incomingAlert, ...prev.filter(a => a.id !== incomingAlert.id)]);

            // Auto-pan to camera location on real incoming alert
            if (leafletMap.current && cam.latitude && cam.longitude) {
              leafletMap.current.flyTo([cam.latitude, cam.longitude], 14, {
                duration: 1.2,
                easeLinearity: 0.25
              });
            }
          }
        } catch (e) {
          // ignore non-json keep-alive
        }
      };

      eventSource.onerror = () => {
        // SSE fallback
      };
    } catch (err) {
      console.error('SSE Error:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [fetchActiveAlerts, cameras]);

  // Helper for human-readable relative time
  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsedSec < 10) return 'Just now';
    if (elapsedSec < 60) return `${elapsedSec}s ago`;
    const mins = Math.floor(elapsedSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  }

  // Periodic relative time updater (every 5 seconds)
  useEffect(() => {
    const timeUpdateTimer = setInterval(() => {
      setIncidents(prev => prev.map(inc => ({
        ...inc,
        timeAgo: formatTimeAgo(inc.createdAt)
      })));
    }, 5000);

    return () => clearInterval(timeUpdateTimer);
  }, []);

  // Locate and Fly to Camera on Map
  const handleLocateIncident = (incident) => {
    const cam = incident.camera || cameras.find(c => c.id === incident.cameraId);
    if (cam && leafletMap.current && cam.latitude && cam.longitude) {
      leafletMap.current.flyTo([cam.latitude, cam.longitude], 15, {
        duration: 1.2,
        easeLinearity: 0.25
      });

      setTimeout(() => {
        const marker = markersMapRef.current[cam.id];
        if (marker) marker.openPopup();
      }, 1250);
    }
  };

  // Open Live Stream for Incident Camera
  const handleOpenStreamIncident = (incident) => {
    const cam = incident.camera || cameras.find(c => c.id === incident.cameraId);
    if (cam) {
      onCameraSelect(cam);
    }
  };

  // Dismiss / Clear Incident
  const handleDismissIncident = (incidentId) => {
    setIncidents(prev => prev.filter(inc => inc.id !== incidentId));
  };

  // Initialize Map
  useEffect(() => {
    if (!leafletMap.current && mapRef.current) {
      const mapBounds = [
        [6.0, 64.5],
        [37.5, 97.5]
      ];

      leafletMap.current = L.map(mapRef.current, {
        center: [22.35, 70.6],
        zoom: 7,
        minZoom: 6,
        maxBounds: mapBounds,
        maxBoundsViscosity: 0.9,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(leafletMap.current);
      markersLayer.current = L.layerGroup().addTo(leafletMap.current);
      trajectoryLayer.current = L.layerGroup().addTo(leafletMap.current);
    }

    // Dynamic Light / Dark Tile Layer Switching
    if (tileLayerRef.current) {
      leafletMap.current.removeLayer(tileLayerRef.current);
    }

    const tileUrl = theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; Government of Gujarat GIS Control Command Center',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap.current);

    setTimeout(() => {
      if (leafletMap.current) leafletMap.current.invalidateSize();
    }, 100);

    const handleResize = () => {
      if (leafletMap.current) leafletMap.current.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [theme]);

  // Render Camera Markers with Dynamic Threat Shockwaves
  useEffect(() => {
    if (!leafletMap.current || !markersLayer.current) return;
    markersLayer.current.clearLayers();
    markersMapRef.current = {};

    cameras.forEach(cam => {
      if (!cam.latitude || !cam.longitude) return;

      const activeThreat = incidents.find(inc => inc.cameraId === cam.id);
      const isAlarmActive = !!activeThreat;

      const isActive = cam.status === 'ACTIVE';
      const isMaint = cam.status === 'MAINTENANCE';
      let statusClass = isActive ? 'active' : 'offline';
      if (isMaint) statusClass = 'maintenance';

      let markerHtml = '';

      if (isAlarmActive) {
        // SLEEK & COMPACT REAL-TIME THREAT PIN (Minimal footprint, zero cluster clutter)
        const severityClass = activeThreat.severity.toLowerCase();
        const badgeLabel = activeThreat.type === 'ANPR_HOTLIST' && activeThreat.vehicleNo
          ? `ANPR Hotlist: ${activeThreat.vehicleNo}`
          : activeThreat.title;

        markerHtml = `
          <div class="cam-pin alarm-active ${severityClass}" title="${badgeLabel} · Click to View Details">
            <div class="alarm-tight-pulse"></div>
            <div class="core alarm-core">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            </div>
            <div class="alarm-pip"></div>
          </div>
        `;
      } else {
        // STANDARD OPERATIONAL CAMERA PIN
        markerHtml = `
          <div class="cam-pin ${statusClass}">
            <div class="ring"></div>
            <div class="core">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
            </div>
          </div>
        `;
      }

      const customIcon = L.divIcon({
        html: markerHtml,
        className: `custom-leaflet-marker ${isAlarmActive ? 'has-alarm' : ''}`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([cam.latitude, cam.longitude], {
        icon: customIcon,
        zIndexOffset: isAlarmActive ? 1000 : 0
      });

      // TACTICAL POPUP WITH INCIDENT DETAILS (IF ALARM ACTIVE)
      let popupHtml = '';

      if (isAlarmActive) {
        popupHtml = `
          <div class="popup-card alarm-popup">
            <div class="alarm-popup-banner">
              <span class="alarm-live-badge">🚨 REAL-TIME AI THREAT ACTIVE</span>
              <span class="threat-severity-badge ${activeThreat.severity.toLowerCase()}">${activeThreat.severity}</span>
            </div>
            <div class="popup-head" style="margin-top: 8px;">
              <div>
                <div class="pname" style="color: #f43f5e;">${activeThreat.title}</div>
                <div class="pid">${cam.camera_code || cam.id} · ${cam.name}</div>
              </div>
            </div>
            ${activeThreat.vehicleNo ? `
              <div class="vehicle-plate-box" style="margin: 8px 0;">
                <span class="plate-flag">IND</span>
                <span class="plate-number">${activeThreat.vehicleNo}</span>
                <span class="plate-badge">ANPR MATCH</span>
              </div>
            ` : ''}
            <div class="popup-grid">
              <div><span>Incident Type</span><b>${activeThreat.type.replace('_', ' ')}</b></div>
              <div><span>District</span><b>${cam.district || '—'}</b></div>
              <div><span>Camera Model</span><b>${cam.camera_type || 'ANPR_SPECIAL'}</b></div>
              <div><span>Detection Time</span><b>${activeThreat.timeAgo}</b></div>
            </div>
            <button class="popup-stream-btn alarm-stream-btn" id="stream-btn-${cam.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg> Intercept & Watch Live Feed
            </button>
          </div>
        `;
      } else {
        popupHtml = `
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
      }

      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`stream-btn-${cam.id}`);
        if (btn) {
          btn.onclick = () => onCameraSelect(cam);
        }
      });

      markersLayer.current.addLayer(marker);
      markersMapRef.current[cam.id] = marker;
    });

    if (leafletMap.current) leafletMap.current.invalidateSize();
  }, [cameras, incidents, onCameraSelect]);

  // Render Vehicle Trajectory Route on GIS Map
  useEffect(() => {
    if (!leafletMap.current || !trajectoryLayer.current) return;
    trajectoryLayer.current.clearLayers();

    if (!activeTrackVehicle) {
      setTrajectoryData(null);
      return;
    }

    const fetchRoute = async () => {
      try {
        const res = await fetch(`/api/v1/anpr/trajectory/${encodeURIComponent(activeTrackVehicle)}`);
        const json = await res.json();
        if (json.success && json.data && json.data.waypoints.length > 0) {
          const data = json.data;
          setTrajectoryData(data);

          const waypoints = data.waypoints;
          const latlngs = waypoints.map(w => [w.latitude, w.longitude]);

          // Draw Glowing Polyline Path
          const routeLine = L.polyline(latlngs, {
            color: '#f43f5e',
            weight: 5,
            dashArray: '10, 8',
            opacity: 0.95,
            lineJoin: 'round'
          }).addTo(trajectoryLayer.current);

          // Draw Numbered Waypoint Pins along the Path
          waypoints.forEach((wp) => {
            const isStart = wp.sequence === 1;
            const isEnd = wp.sequence === waypoints.length;

            const waypointHtml = `
              <div class="cam-pin alarm-active critical" style="width: 32px; height: 32px;" title="Checkpoint #${wp.sequence}: ${wp.camera_name}">
                <div class="alarm-tight-pulse"></div>
                <div class="core alarm-core" style="font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: #fff;">
                  ${wp.sequence}
                </div>
              </div>
            `;

            const icon = L.divIcon({
              html: waypointHtml,
              className: 'custom-leaflet-marker has-alarm',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });

            const marker = L.marker([wp.latitude, wp.longitude], {
              icon,
              zIndexOffset: 2000 + wp.sequence
            });

            const popupContent = `
              <div class="tactical-popup">
                <div class="popup-head" style="border-left: 3px solid #f43f5e;">
                  <h4>Checkpoint #${wp.sequence} — ${wp.camera_name}</h4>
                  <div class="badge-row">
                    <span class="threat-severity-badge critical">SEQUENCE STEP ${wp.sequence}</span>
                  </div>
                </div>
                <div class="popup-grid">
                  <div><span>Tracked Vehicle</span><b>${data.vehicle_plate}</b></div>
                  <div><span>Camera Node</span><b>${wp.camera_code || wp.camera_id}</b></div>
                  <div><span>Timestamp</span><b>${new Date(wp.timestamp).toLocaleTimeString()}</b></div>
                  <div><span>Speed Logged</span><b>${wp.speed_kmh} km/h</b></div>
                </div>
              </div>
            `;

            marker.bindPopup(popupContent);
            trajectoryLayer.current.addLayer(marker);
          });

          // Zoom smoothly to fit entire route
          leafletMap.current.fitBounds(routeLine.getBounds(), {
            padding: [80, 80],
            maxZoom: 15
          });
        }
      } catch (err) {
        console.error('Error fetching vehicle trajectory:', err);
      }
    };

    fetchRoute();
  }, [activeTrackVehicle]);

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

      {/* Floating Active Vehicle Trajectory HUD Banner (Model 2 Test Case) */}
      {trajectoryData && (
        <div
          style={{
            position: 'absolute',
            top: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'var(--panel-bg)',
            border: '1px solid var(--danger)',
            borderRadius: '12px',
            padding: '10px 18px',
            backdropFilter: 'blur(14px)',
            boxShadow: '0 8px 30px rgba(244,63,94,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="alarm-pulse-dot"></span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--danger)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                🚨 ACTIVE VEHICLE ROUTE TRAJECTORY TRACED
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className="plate-number" style={{ background: '#000', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                  {trajectoryData.vehicle_plate}
                </span>
                <span>·</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {trajectoryData.total_spotted} Checkpoint Hits along Gujarat Highway Corridor
                </span>
              </div>
            </div>
          </div>

          <button
            className="btn btn-sm"
            onClick={onClearTrackVehicle}
            style={{ background: 'var(--danger)', color: '#fff', fontSize: '11px', padding: '5px 12px', fontWeight: 700 }}
          >
            ✕ Exit Route Mode
          </button>
        </div>
      )}

      {/* Real-time AI Threat & ANPR Incident Dispatch Radar */}
      <IncidentRadarPanel
        incidents={incidents}
        onLocate={handleLocateIncident}
        onOpenStream={handleOpenStreamIncident}
        onDismiss={handleDismissIncident}
      />

      {/* Map Custom Controls */}
      <div className="map-controls">
        <button onClick={handleZoomIn} title="Zoom in"><Plus size={18} strokeWidth={2.4} /></button>
        <button onClick={handleZoomOut} title="Zoom out"><Minus size={18} strokeWidth={2.4} /></button>
        <button onClick={handleRecenter} title="Recenter to Gujarat"><Crosshair size={18} strokeWidth={2} /></button>
      </div>

      {/* Floating Tactical Map Legend */}
      <div className="floating legend-panel">
        <div className="legend-title">Map Security Matrix</div>
        <div className="legend-row">
          <span className="legend-dot alarm-pulse-dot"></span>
          <b>AI Detection / Alert</b>
        </div>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--success)', boxShadow: '0 0 0 3px var(--success-glow)' }}></span>
          Active Camera
        </div>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--danger)', boxShadow: '0 0 0 3px var(--danger-glow)' }}></span>
          Offline Critical
        </div>
      </div>
    </main>
  );
};
