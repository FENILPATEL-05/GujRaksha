import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import { IncidentRadarPanel } from './IncidentRadarPanel';
import { Plus, Minus, Crosshair, Radio, ShieldAlert } from 'lucide-react';

const VEHICLE_PLATES = [
  'GJ-01-ER-9821',
  'GJ-05-BX-4412',
  'GJ-03-KM-7719',
  'GJ-27-AA-1008',
  'GJ-06-TR-5531',
  'GJ-18-BB-9901',
  'GJ-10-DF-3342',
  'GJ-12-AZ-8810',
  'GJ-02-PQ-6504',
  'GJ-21-LM-4478'
];

const INCIDENT_TEMPLATES = [
  {
    type: 'ANPR_HOTLIST',
    title: 'Hotlisted Vehicle Detected',
    descFn: (plate) => `${plate} (Black Scorpio) · Suspected Stolen Vehicle (FIR #284/2026)`,
    severity: 'CRITICAL'
  },
  {
    type: 'ANPR_HOTLIST',
    title: 'Commercial Overload Violation',
    descFn: (plate) => `${plate} (Freight Logistics) · Weighbridge bypass trigger`,
    severity: 'HIGH'
  },
  {
    type: 'ANPR_HOTLIST',
    title: 'Stolen Two-Wheeler Tracked',
    descFn: (plate) => `${plate} (Pulsar 220) · Police Cordon ANPR Match (99.1%)`,
    severity: 'HIGH'
  },
  {
    type: 'PERIMETER_BREACH',
    title: 'Perimeter Intrusion Detected',
    descFn: () => 'Restricted industrial security zone boundary crossed',
    severity: 'CRITICAL'
  },
  {
    type: 'TRAFFIC_VIOLATION',
    title: 'Wrong-Way Speeding Anomaly',
    descFn: (plate) => `${plate} driving against traffic flow at 85+ km/h`,
    severity: 'HIGH'
  },
  {
    type: 'CROWD_ANOMALY',
    title: 'Dense Crowd Surge Detected',
    descFn: () => 'Abnormal crowd density spike near public transit gate',
    severity: 'WARNING'
  },
  {
    type: 'SMOKE_FIRE',
    title: 'Thermal Sensor Early Warning',
    descFn: () => 'Thermal anomaly threshold crossed in industrial sector',
    severity: 'CRITICAL'
  }
];

export const MapView = ({ cameras, onCameraSelect }) => {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(null);
  const markersMapRef = useRef({});
  const { theme } = useTheme();

  // Active Real-Time Incidents State
  const [incidents, setIncidents] = useState([]);

  // Create a new realistic alert for a random camera
  const createRandomAlert = useCallback((targetCam = null) => {
    if (!cameras || cameras.length === 0) return null;

    const cam = targetCam || cameras[Math.floor(Math.random() * cameras.length)];
    const tpl = INCIDENT_TEMPLATES[Math.floor(Math.random() * INCIDENT_TEMPLATES.length)];
    const plate = VEHICLE_PLATES[Math.floor(Math.random() * VEHICLE_PLATES.length)];

    return {
      id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: tpl.type,
      title: tpl.title,
      vehicleNo: tpl.type === 'ANPR_HOTLIST' || tpl.type === 'TRAFFIC_VIOLATION' ? plate : null,
      description: tpl.descFn(plate),
      severity: tpl.severity,
      cameraId: cam.id,
      cameraCode: cam.camera_code,
      cameraName: cam.name,
      district: cam.district || 'Gujarat',
      createdAt: Date.now(),
      timeAgo: 'Just now',
      isNew: true,
      camera: cam
    };
  }, [cameras]);

  // Initial demo alerts setup
  useEffect(() => {
    if (cameras.length > 0 && incidents.length === 0) {
      const cam1 = cameras.find(c => (c.district || '').toLowerCase().includes('ahmedabad')) || cameras[0];
      const cam2 = cameras.find(c => (c.district || '').toLowerCase().includes('gandhinagar')) || cameras[1] || cameras[0];

      const initialAlerts = [];
      const alert1 = createRandomAlert(cam1);
      if (alert1) initialAlerts.push(alert1);

      if (cam2 && cam2.id !== cam1.id) {
        const alert2 = createRandomAlert(cam2);
        if (alert2) {
          alert2.timeAgo = '24s ago';
          alert2.createdAt = Date.now() - 24000;
          alert2.isNew = false;
          initialAlerts.push(alert2);
        }
      }

      setIncidents(initialAlerts);
    }
  }, [cameras, createRandomAlert]);

  // Dynamic Periodic Alert Engine (Cycles & Rotates alerts across Gujarat every 14 seconds)
  useEffect(() => {
    if (!cameras || cameras.length === 0) return;

    const rotationTimer = setInterval(() => {
      setIncidents(prev => {
        // Drop oldest if we have 3 or more active alerts
        const currentList = prev.length >= 3 ? prev.slice(0, 2) : prev;
        
        // Pick a camera not already in active alerts
        const activeCamIds = new Set(currentList.map(a => a.cameraId));
        const availableCams = cameras.filter(c => !activeCamIds.has(c.id));
        const chosenCam = availableCams.length > 0
          ? availableCams[Math.floor(Math.random() * availableCams.length)]
          : cameras[Math.floor(Math.random() * cameras.length)];

        const newAlert = createRandomAlert(chosenCam);
        if (!newAlert) return prev;

        return [newAlert, ...currentList.map(a => ({ ...a, isNew: false }))];
      });
    }, 14000);

    // Update relative time strings every 4 seconds
    const timeUpdateTimer = setInterval(() => {
      setIncidents(prev => prev.map(inc => {
        const elapsedSec = Math.floor((Date.now() - inc.createdAt) / 1000);
        let timeAgoStr = 'Just now';
        if (elapsedSec >= 60) {
          timeAgoStr = `${Math.floor(elapsedSec / 60)}m ago`;
        } else if (elapsedSec > 5) {
          timeAgoStr = `${elapsedSec}s ago`;
        }
        return { ...inc, timeAgo: timeAgoStr };
      }));
    }, 4000);

    return () => {
      clearInterval(rotationTimer);
      clearInterval(timeUpdateTimer);
    };
  }, [cameras, createRandomAlert]);

  // Trigger manual simulated detection incident
  const handleTriggerDemoIncident = useCallback(() => {
    if (!cameras || cameras.length === 0) return;

    const randomCam = cameras[Math.floor(Math.random() * cameras.length)];
    const newAlert = createRandomAlert(randomCam);
    if (!newAlert) return;

    setIncidents(prev => [newAlert, ...prev.slice(0, 2)]);

    // Auto-fly to camera location on manual simulate click
    if (leafletMap.current && randomCam.latitude && randomCam.longitude) {
      leafletMap.current.flyTo([randomCam.latitude, randomCam.longitude], 14, {
        duration: 1.3,
        easeLinearity: 0.25
      });

      setTimeout(() => {
        const marker = markersMapRef.current[randomCam.id];
        if (marker) marker.openPopup();
      }, 1350);
    }
  }, [cameras, createRandomAlert]);

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

      {/* Real-time AI Threat & ANPR Incident Dispatch Radar */}
      <IncidentRadarPanel
        incidents={incidents}
        onLocate={handleLocateIncident}
        onOpenStream={handleOpenStreamIncident}
        onDismiss={handleDismissIncident}
        onTriggerDemo={handleTriggerDemoIncident}
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
