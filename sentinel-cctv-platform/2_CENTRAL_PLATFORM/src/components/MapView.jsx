import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import { IncidentRadarPanel } from './IncidentRadarPanel';
import { PoliceTacticalDock } from './PoliceTacticalDock';
import { Plus, Minus, Crosshair, Radio, ShieldAlert, Layers, Eye, MapPin, Shield, X, AlertTriangle } from 'lucide-react';



const GUJARAT_DISTRICT_COORDS = {
  'Ahmedabad': [23.0225, 72.5714],
  'Surat': [21.1702, 72.8311],
  'Vadodara': [22.3072, 73.1812],
  'Rajkot': [22.3039, 70.8022],
  'Gandhinagar': [23.2156, 72.6369],
  'Bhavnagar': [21.7645, 72.1519],
  'Jamnagar': [22.4707, 70.0577],
  'Junagadh': [21.5222, 70.4579],
  'Kutch': [23.242, 69.6669],
  'Bharuch': [21.7051, 72.9959],
  'Navsari': [20.9467, 72.952],
  'Valsad': [20.5992, 72.9342],
  'Anand': [22.5645, 72.9289],
  'Kheda': [22.7533, 72.6844],
  'Mehsana': [23.588, 72.3693],
  'Banaskantha': [24.1724, 72.4346],
  'Sabarkantha': [23.5977, 73.0645],
  'Aravalli': [23.4608, 73.3235],
  'Patan': [23.8493, 72.1266],
  'Surendranagar': [22.7275, 71.6375],
  'Morbi': [22.812, 70.8385],
  'Porbandar': [21.6417, 69.6293],
  'Devbhoomi Dwarka': [22.2442, 68.9685],
  'Gir Somnath': [20.9042, 70.3667],
  'Amreli': [21.6032, 71.2221],
  'Botad': [22.1704, 71.6664],
  'Panchmahal': [22.7756, 73.6149],
  'Dahod': [22.8398, 74.2546],
  'Mahisagar': [23.1432, 73.6166],
  'Narmada': [21.8711, 73.5042],
  'Chhota Udaipur': [22.3081, 74.0125],
  'Tapi': [21.2562, 73.3986],
  'Dang': [20.7533, 73.7027]
};

// Helper to play synthesized emergency siren tone for watchlist alerts
const playEmergencySiren = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.25);
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.5);
    osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.75);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.95);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.0);
  } catch (e) {
    // Autoplay restrictions or unsupported audio context
  }
};

// Robust Camera-to-Alert matching helper (matches by ID, camera_code, or numeric index)
const isIncidentForCam = (inc, cam) => {
  if (!inc || !cam) return false;
  const incCamId = String(inc.cameraId || '').toLowerCase().trim();
  const incCamCode = String(inc.cameraCode || '').toLowerCase().trim();
  const cId = String(cam.id || '').toLowerCase().trim();
  const cCode = String(cam.camera_code || '').toLowerCase().trim();

  if (incCamId && (incCamId === cId || incCamId === cCode)) return true;
  if (incCamCode && (incCamCode === cId || incCamCode === cCode)) return true;

  // Compare trailing numeric identifiers (e.g. '100' in 'gj-gov-100' or 'gov-feed-100' or 'CAM100')
  const incNum = (incCamId + ' ' + incCamCode).match(/\d+/)?.[0];
  const camNum = (cId + ' ' + cCode).match(/\d+/)?.[0];
  if (incNum && camNum && parseInt(incNum, 10) === parseInt(camNum, 10)) return true;

  return false;
};

export const MapView = ({ 
  cameras, 
  filters = {}, 
  onCameraSelect, 
  activeTrackVehicle = null, 
  onClearTrackVehicle,
  addToast
}) => {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(null);
  const trajectoryLayer = useRef(null);
  const markersMapRef = useRef({});
  const { theme } = useTheme();

  // Active Real-Time Incidents State (Fed directly from Real-Time AI / Watchlist Engine)
  const [incidents, setIncidents] = useState([]);
  const [latestLiveHit, setLatestLiveHit] = useState(null);
  const [trajectoryData, setTrajectoryData] = useState(null);
  const [spatialData, setSpatialData] = useState(null);
  const [isSpatialLoading, setIsSpatialLoading] = useState(false);
  const spatialAbortRef = useRef(null);

  // Police Command HUD & Tactical Dock State
  const [selectedDockCamera, setSelectedDockCamera] = useState(null);
  const [mapLayerMode, setMapLayerMode] = useState(() => {
    const saved = localStorage.getItem('gujraksha_map_layer');
    if (saved) return saved;
    return theme === 'dark' ? 'dark' : 'street';
  });

  useEffect(() => {
    const isCustomized = localStorage.getItem('gujraksha_map_layer_customized');
    if (!isCustomized) {
      setMapLayerMode(theme === 'dark' ? 'dark' : 'street');
    }
  }, [theme]);

  const camerasRef = useRef(cameras);
  useEffect(() => {
    camerasRef.current = cameras;
  }, [cameras]);

  // Auto-dismiss floating emergency banner after 15s
  useEffect(() => {
    if (latestLiveHit) {
      const timer = setTimeout(() => {
        setLatestLiveHit(null);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [latestLiveHit]);

  // Fetch initial real active alerts from database
  const fetchActiveAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/anpr/alerts');
      const json = await res.json();
      if (json.success && json.data) {
        const formatted = json.data.map(alert => ({
          ...alert,
          timeAgo: formatTimeAgo(alert.createdAt),
          camera: (camerasRef.current || []).find(c => isIncidentForCam(alert, c)) || {
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
  }, []);

  // Connect to Live Server-Sent Events (SSE) Stream for Instant Push Alerts
  useEffect(() => {
    fetchActiveAlerts();

    let eventSource;
    try {
      eventSource = new EventSource('/api/v1/anpr/alerts/live');
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && (data.type === 'ANPR_HOTLIST' || data.is_watchlist_hit)) {
            const cam = (camerasRef.current || []).find(c => isIncidentForCam(data, c)) || {
              id: data.cameraId || data.cameraCode || 'gov-feed-1',
              name: data.cameraName || data.cameraCode || 'CCTV Surveillance Node',
              camera_code: data.cameraCode || data.cameraId || 'GJ-GOV-001',
              district: data.district || 'Ahmedabad',
              latitude: parseFloat(data.latitude) || 23.0225,
              longitude: parseFloat(data.longitude) || 72.5714
            };

            const incomingAlert = {
              ...data,
              timeAgo: 'Just now',
              camera: cam,
              isNew: true
            };

            setIncidents(prev => [incomingAlert, ...prev.filter(a => a.id !== incomingAlert.id)]);
            setLatestLiveHit(incomingAlert);

            // Play emergency siren tone
            playEmergencySiren();

            // Display Toast notification
            if (typeof addToast === 'function') {
              addToast(
                `POLICE WATCHLIST HIT: ${data.vehicleNo || data.vehicle_plate} spotted at ${cam.name} (${cam.district || 'Gujarat'})`,
                'error',
                'CRITICAL SECURITY THREAT'
              );
            }


            // Auto-pan to camera location on real incoming alert
            if (leafletMap.current && cam.latitude && cam.longitude) {
              leafletMap.current.flyTo([cam.latitude, cam.longitude], 15, {
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
  }, [fetchActiveAlerts, addToast]);

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
      setSelectedDockCamera(cam);
      leafletMap.current.flyTo([cam.latitude, cam.longitude], 15, {
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  };

  // Open Live Stream for Incident Camera & Dismiss in Database
  const handleOpenStreamIncident = async (incident) => {
    setIncidents(prev => prev.filter(inc => inc.id !== incident.id));
    const cam = incident.camera || cameras.find(c => c.id === incident.cameraId);
    if (cam) {
      setSelectedDockCamera(cam);
    }
    try {
      await fetch(`/api/v1/anpr/alerts/${encodeURIComponent(incident.id)}/dismiss`, {
        method: 'PATCH'
      });
    } catch (err) {
      console.error('Error updating dismissed alert in database:', err);
    }
  };

  // Dismiss / Clear Incident Permanently in Database
  const handleDismissIncident = async (incidentId) => {
    setIncidents(prev => prev.filter(inc => inc.id !== incidentId));
    try {
      await fetch(`/api/v1/anpr/alerts/${encodeURIComponent(incidentId)}/dismiss`, {
        method: 'PATCH'
      });
    } catch (err) {
      console.error('Error updating dismissed alert in database:', err);
    }
  };

  // Dismiss / Clear All Incidents in Database (Atomic Operation)
  const handleDismissAllIncidents = async () => {
    setIncidents([]);
    try {
      await fetch('/api/v1/anpr/alerts/dismiss-all', {
        method: 'POST'
      });
    } catch (err) {
      console.error('Error updating dismiss-all in database:', err);
    }
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
        maxZoom: 20,
        maxBounds: mapBounds,
        maxBoundsViscosity: 0.9,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(leafletMap.current);
      markersLayer.current = L.layerGroup().addTo(leafletMap.current);
      trajectoryLayer.current = L.layerGroup().addTo(leafletMap.current);
    }

    // Dynamic Police Layer (Night Ops Dark / Satellite Hybrid / Street GIS)
    if (tileLayerRef.current) {
      leafletMap.current.removeLayer(tileLayerRef.current);
    }

    let tileUrl;
    let tileAttribution = '&copy; Gujarat Police Netram GIS CCC';
    let tileSubdomains = 'abcd';
    let maxNativeZoom = 16;

    if (mapLayerMode === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      tileAttribution += ' &copy; Esri World Imagery';
      tileSubdomains = '';
      maxNativeZoom = 18;
    } else if (mapLayerMode === 'street') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      tileAttribution += ' &copy; OpenStreetMap';
      tileSubdomains = 'abc';
      maxNativeZoom = 19;
    } else {
      // Default: High-tech Police Night Ops Dark Mode
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      tileAttribution += ' &copy; Esri Dark Canvas';
      tileSubdomains = '';
      maxNativeZoom = 16;
    }

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: tileAttribution,
      subdomains: tileSubdomains || 'abcd',
      maxZoom: 20,
      maxNativeZoom: maxNativeZoom
    }).addTo(leafletMap.current);

    setTimeout(() => {
      if (leafletMap.current) leafletMap.current.invalidateSize();
    }, 100);

    const handleResize = () => {
      if (leafletMap.current) leafletMap.current.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [theme, mapLayerMode]);

  // Helper for short camera number / ID (e.g. 1, 2, 3, 4, 31)
  const getShortCamId = (cam) => {
    if (!cam) return '1';
    if (cam.number !== undefined && cam.number !== null) return String(cam.number);
    const code = String(cam.camera_code || '');
    if (code.startsWith('GJ-GOV-')) {
      const num = parseInt(code.replace('GJ-GOV-', ''), 10);
      if (!isNaN(num)) return String(num);
    }
    const idStr = String(cam.id || '');
    const cleaned = idStr.replace('gov-feed-', '').replace('cam-', '').replace('cam', '').trim();
    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed)) return String(parsed);
    return cleaned || '1';
  };

  // Render Single Camera Popup Template
  const renderSingleCameraPopup = (cam, activeThreat, shortId) => {
    const isAlarmActive = !!activeThreat;
    const isActive = cam.status === 'ACTIVE';

    if (isAlarmActive) {
      return `
        <div class="popup-card alarm-popup">
          <div class="alarm-popup-banner">
            <span class="alarm-live-badge">REAL-TIME AI THREAT ACTIVE</span>
            <span class="threat-severity-badge ${(activeThreat.severity || 'HIGH').toLowerCase()}">${activeThreat.severity || 'HIGH'}</span>
          </div>
          <div class="popup-head" style="margin-top: 8px;">
            <div>
              <div class="pname" style="color: #f43f5e;">${activeThreat.title || 'Security Incident'}</div>
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
            <div><span>Incident Type</span><b>${(activeThreat.type || 'THREAT').replace('_', ' ')}</b></div>
            <div><span>District</span><b>${cam.district || '—'}</b></div>
            <div><span>Camera Model</span><b>${cam.camera_type || 'ANPR_SPECIAL'}</b></div>
            <div><span>Detection Time</span><b>${activeThreat.timeAgo || 'Just now'}</b></div>
          </div>
          <button class="popup-stream-btn alarm-stream-btn" id="stream-btn-${cam.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg> Intercept & Watch Live Feed
          </button>
        </div>
      `;
    }

    return `
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
  };

  // Render Multi-Camera Cluster Popup Template
  const renderClusterPopup = (clusterCameras, alarmCameras) => {
    const count = clusterCameras.length;
    const hasAlarm = alarmCameras.length > 0;

    return `
      <div class="popup-card cluster-popup-card">
        <div class="popup-head" style="border-bottom: 1px solid var(--panel-border-strong); padding-bottom: 8px; margin-bottom: 8px;">
          <div>
            <div class="pname" style="display: flex; align-items: center; gap: 6px;">
              <span>${count} Cameras Grouped</span>
            </div>
            <div class="pid">${clusterCameras[0]?.district || 'Gujarat'} Area · Co-located Cameras</div>
          </div>
          ${hasAlarm ? `<span class="status-chip offline">ALERT (${alarmCameras.length})</span>` : `<span class="status-chip active">${count} Cams</span>`}
        </div>
        <div class="cluster-cam-list" style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;">
          ${clusterCameras.map(cam => {
            const sId = getShortCamId(cam);
            const isAlarm = alarmCameras.some(a => a.id === cam.id);
            return `
              <div class="cluster-cam-item ${isAlarm ? 'alarm-item' : ''}" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,0.05); font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                  <span style="font-weight: 800; background: ${isAlarm ? '#f43f5e' : 'var(--accent, #22d3ee)'}; color: #000; border-radius: 4px; padding: 2px 6px; font-size: 11.5px;">#${sId}</span>
                  <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; color: var(--text-primary); font-weight: 600;">${cam.name}</span>
                </div>
                <button class="popup-stream-mini-btn" id="cluster-stream-btn-${cam.id}" style="padding: 4px 10px; border-radius: 6px; background: ${isAlarm ? '#e11d48' : '#0284c7'}; color: #fff; font-size: 11px; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg> Watch
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  // High-Scale Viewport-Aware Camera Fetcher (/api/v1/cameras/spatial)
  const fetchSpatialCameras = useCallback(async () => {
    if (!leafletMap.current) return;
    const map = leafletMap.current;
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const bbox = [
      bounds.getWest().toFixed(4),
      bounds.getSouth().toFixed(4),
      bounds.getEast().toFixed(4),
      bounds.getNorth().toFixed(4)
    ].join(',');

    const params = new URLSearchParams();
    params.set('bbox', bbox);
    params.set('zoom', zoom);
    if (filters.department && filters.department !== 'ALL') params.set('department', filters.department);
    if (filters.district && filters.district !== 'ALL') params.set('district', filters.district);
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.search && filters.search.trim() !== '') params.set('search', filters.search.trim());

    if (spatialAbortRef.current) {
      spatialAbortRef.current.abort();
    }
    spatialAbortRef.current = new AbortController();

    setIsSpatialLoading(true);
    try {
      const res = await fetch(`/api/v1/cameras/spatial?${params.toString()}`, {
        signal: spatialAbortRef.current.signal
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSpatialData(json.data);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // silent fallback to prop cameras
      }
    } finally {
      setIsSpatialLoading(false);
    }
  }, [filters]);

  // Hook live spatial querying on pan, zoom, and filter changes
  useEffect(() => {
    if (!leafletMap.current) return;
    const map = leafletMap.current;
    let timer = setTimeout(fetchSpatialCameras, 100);

    const handleMove = () => {
      clearTimeout(timer);
      timer = setTimeout(fetchSpatialCameras, 200);
    };

    map.on('moveend zoomend', handleMove);
    return () => {
      clearTimeout(timer);
      map.off('moveend zoomend', handleMove);
      if (spatialAbortRef.current) spatialAbortRef.current.abort();
    };
  }, [fetchSpatialCameras]);

  // Smooth Auto-Focus Pan when user selects a specific district filter
  useEffect(() => {
    if (!leafletMap.current) return;
    if (filters.district && filters.district !== 'ALL') {
      const coords = GUJARAT_DISTRICT_COORDS[filters.district];
      if (coords) {
        leafletMap.current.flyTo(coords, 12, { duration: 0.9 });
      }
    } else if (filters.district === 'ALL' && filters.department === 'ALL' && (!filters.search || filters.search.trim() === '')) {
      // Zoom out to statewide view
      if (leafletMap.current.getZoom() > 8) {
        leafletMap.current.flyTo([22.35, 70.6], 7, { duration: 0.9 });
      }
    }
  }, [filters.district]);

  // Helper for human-readable cluster camera count badges
  const formatClusterCount = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'k';
    return String(num);
  };

  // Render Clustered / Individual Markers on Map (Ultra-Fast O(N) Spatial Grid Clustering for 80,000+ scale)
  const renderClusteredMarkers = useCallback(() => {
    if (!leafletMap.current || !markersLayer.current) return;
    const map = leafletMap.current;
    markersLayer.current.clearLayers();
    markersMapRef.current = {};

    const zoom = map.getZoom();

    // 1. Statewide District Hubs (when zoom < 10)
    if (spatialData && spatialData.clustered && Array.isArray(spatialData.clusters) && spatialData.clusters.length > 0) {
      spatialData.clusters.forEach(cl => {
        const count = cl.count;
        const sizeClass = count >= 500 ? 'large' : count >= 50 ? 'medium' : 'small';
        const sizePx = count >= 500 ? 54 : count >= 50 ? 46 : 40;

        const clusterHtml = `
          <div class="cctv-cluster-pin ${sizeClass}" title="${count} Cameras in ${cl.district} · Click to Zoom in & Explore">
            <div class="cluster-halo"></div>
            <div class="cluster-core">
              <svg width="${sizePx >= 50 ? 22 : 18}" height="${sizePx >= 50 ? 22 : 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cluster-multi-cam-svg">
                <!-- Back Camera -->
                <rect x="7" y="3" width="11" height="9" rx="2" stroke="currentColor" opacity="0.65" fill="rgba(255,255,255,0.18)"/>
                <path d="m18 5.5 4-2.5v6l-4-2.5" stroke="currentColor" opacity="0.65" fill="rgba(255,255,255,0.25)"/>
                <!-- Front Camera -->
                <rect x="2" y="9" width="12" height="10" rx="2" fill="#091322" stroke="currentColor" stroke-width="2.2"/>
                <path d="m14 11.5 5-3v7l-5-3" fill="currentColor"/>
              </svg>
              <span class="cluster-tag-sub">${cl.district}</span>
            </div>
          </div>
        `;

        const icon = L.divIcon({
          html: clusterHtml,
          className: 'custom-leaflet-cluster',
          iconSize: [sizePx, sizePx],
          iconAnchor: [sizePx / 2, sizePx / 2]
        });

        const clusterMarker = L.marker([cl.latitude, cl.longitude], { icon, zIndexOffset: 50 });
        clusterMarker.on('click', () => {
          map.flyTo([cl.latitude, cl.longitude], 12, { duration: 0.85, easeLinearity: 0.25 });
        });
        markersLayer.current.addLayer(clusterMarker);
      });

      if (leafletMap.current) leafletMap.current.invalidateSize();
      return;
    }

    // 2. Adaptive Viewport Clustering with STRICT MAX 100 MARKERS LIMIT
    const activeCameras = (spatialData && Array.isArray(spatialData.cameras)) ? spatialData.cameras : (zoom >= 10 ? cameras : []);
    const mapBounds = map.getBounds().pad(0.08);

    const visibleCameras = [];
    for (let i = 0; i < activeCameras.length; i++) {
      const cam = activeCameras[i];
      if (cam.latitude && cam.longitude && mapBounds.contains([cam.latitude, cam.longitude])) {
        visibleCameras.push(cam);
      }
    }

    // Base initial clustering radius by zoom
    let clusterRadiusPx = zoom >= 17 ? 4 : zoom === 16 ? 10 : zoom === 15 ? 18 : zoom === 14 ? 30 : zoom === 13 ? 45 : zoom === 12 ? 65 : zoom === 11 ? 90 : 120;

    // Dynamically expand cluster radius if total marker count would exceed MAX_VIEW_LIMIT (100)
    const MAX_VIEW_LIMIT = 100;
    let clusters = [];
    let attempts = 0;

    while (attempts < 12) {
      const grid = new Map();
      for (let i = 0; i < visibleCameras.length; i++) {
        const cam = visibleCameras[i];
        const pt = map.latLngToLayerPoint([cam.latitude, cam.longitude]);
        const cellX = Math.floor(pt.x / clusterRadiusPx);
        const cellY = Math.floor(pt.y / clusterRadiusPx);
        const cellKey = `${cellX}_${cellY}`;

        const existing = grid.get(cellKey);
        if (existing) {
          existing.cameras.push(cam);
          const n = existing.cameras.length;
          existing.centerLat = (existing.centerLat * (n - 1) + cam.latitude) / n;
          existing.centerLng = (existing.centerLng * (n - 1) + cam.longitude) / n;
        } else {
          grid.set(cellKey, {
            centerLat: cam.latitude,
            centerLng: cam.longitude,
            cameras: [cam]
          });
        }
      }

      clusters = Array.from(grid.values());
      if (clusters.length <= MAX_VIEW_LIMIT || visibleCameras.length <= MAX_VIEW_LIMIT) {
        break;
      }

      // If over 100 markers, increase radius proportionally to fuse nearby cameras into groups
      clusterRadiusPx = Math.ceil(clusterRadiusPx * 1.3);
      attempts++;
    }

    // Spiderify: at high zoom, separate co-located cameras (same/near-identical coords) into individual pins
    if (zoom >= 16) {
      const spideredClusters = [];
      clusters.forEach(cl => {
        if (cl.cameras.length > 1 && cl.cameras.length <= 12) {
          // Check if cameras are co-located (all within ~0.00005 degrees ≈ 5m)
          const baseLat = cl.cameras[0].latitude;
          const baseLng = cl.cameras[0].longitude;
          const coLocated = cl.cameras.every(c =>
            Math.abs(c.latitude - baseLat) < 0.00008 && Math.abs(c.longitude - baseLng) < 0.00008
          );
          if (coLocated) {
            // Arrange cameras in a circle around the center
            const offsetDeg = zoom >= 18 ? 0.00015 : zoom >= 17 ? 0.0003 : 0.0006;
            cl.cameras.forEach((cam, idx) => {
              const angle = (2 * Math.PI * idx) / cl.cameras.length;
              spideredClusters.push({
                centerLat: baseLat + offsetDeg * Math.cos(angle),
                centerLng: baseLng + offsetDeg * Math.sin(angle),
                cameras: [cam]
              });
            });
            return; // skip adding original cluster
          }
        }
        spideredClusters.push(cl);
      });
      clusters = spideredClusters;
    }

    clusters.forEach(cl => {
      if (cl.cameras.length === 1) {
        // Individual Camera Pin (Single Camera displayed directly when separated)
        const cam = cl.cameras[0];
        const activeThreat = incidents.find(inc => isIncidentForCam(inc, cam));
        const isAlarmActive = !!activeThreat;
        const isActive = cam.status === 'ACTIVE';
        const isMaint = cam.status === 'MAINTENANCE';
        let statusClass = isActive ? 'active' : 'offline';
        if (isMaint) statusClass = 'maintenance';

        let markerHtml = '';
        if (isAlarmActive) {
          const severityClass = (activeThreat.severity || 'high').toLowerCase();
          markerHtml = `
            <div class="cam-pin cam-badge-pin alarm-active ${severityClass}" title="${cam.name} (${cam.camera_code || cam.id}) · Real-Time Threat Active">
              <div class="alarm-tight-pulse"></div>
              <div class="cam-badge-core alarm-core">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
              </div>
              <div class="alarm-pip"></div>
            </div>
          `;
        } else {

          markerHtml = `
            <div class="cam-pin cam-badge-pin ${statusClass}" title="${cam.name} (${cam.camera_code || cam.id})">
              <div class="ring"></div>
              <div class="cam-badge-core">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
              </div>
            </div>
          `;
        }

        const customIcon = L.divIcon({
          html: markerHtml,
          className: `custom-leaflet-marker ${isAlarmActive ? 'has-alarm' : ''}`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const marker = L.marker([cam.latitude, cam.longitude], {
          icon: customIcon,
          zIndexOffset: isAlarmActive ? 1000 : 100
        });

        marker.on('click', async () => {
          setSelectedDockCamera(cam);
          try {
            const res = await fetch(`/api/v1/cameras/${cam.id}`);
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                setSelectedDockCamera(json.data);
              }
            }
          } catch (e) {}
        });

        markersLayer.current.addLayer(marker);
        markersMapRef.current[cam.id] = marker;
      } else {
        // Multi-Camera Merged Cluster Badge with Multi-Camera Icon (No Text Tag) & Click-to-Zoom Expansion
        const count = cl.cameras.length;
        const alarmCameras = cl.cameras.filter(c => incidents.some(inc => isIncidentForCam(inc, c)));
        const hasAlarm = alarmCameras.length > 0;

        const sizeClass = count >= 50 ? 'large' : count >= 10 ? 'medium' : 'small';
        const sizePx = count >= 50 ? 52 : count >= 10 ? 44 : 38;

        const clusterHtml = `
          <div class="cctv-cluster-pin ${sizeClass} ${hasAlarm ? 'has-alarm' : ''}" title="${count} Cameras merged · Click to zoom in & separate">
            <div class="cluster-halo"></div>
            <div class="cluster-core">
              <svg width="${sizePx >= 48 ? 22 : 18}" height="${sizePx >= 48 ? 22 : 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cluster-multi-cam-svg">
                <!-- Back Camera -->
                <rect x="7" y="3" width="11" height="9" rx="2" stroke="currentColor" opacity="0.65" fill="rgba(255,255,255,0.18)"/>
                <path d="m18 5.5 4-2.5v6l-4-2.5" stroke="currentColor" opacity="0.65" fill="rgba(255,255,255,0.25)"/>
                <!-- Front Camera -->
                <rect x="2" y="9" width="12" height="10" rx="2" fill="${hasAlarm ? '#4c0519' : '#091322'}" stroke="currentColor" stroke-width="2.2"/>
                <path d="m14 11.5 5-3v7l-5-3" fill="currentColor"/>
              </svg>
            </div>
            ${hasAlarm ? '<span class="cluster-alert-dot"></span>' : ''}
          </div>
        `;

        const clusterIcon = L.divIcon({
          html: clusterHtml,
          className: `custom-leaflet-cluster ${hasAlarm ? 'has-alarm' : ''}`,
          iconSize: [sizePx, sizePx],
          iconAnchor: [sizePx / 2, sizePx / 2]
        });

        const clusterMarker = L.marker([cl.centerLat, cl.centerLng], {
          icon: clusterIcon,
          zIndexOffset: hasAlarm ? 900 : 50
        });

        clusterMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const latLngs = cl.cameras.map(c => [c.latitude, c.longitude]);
          const bounds = L.latLngBounds(latLngs);

          const isCoLocated = bounds.getNorthEast().equals(bounds.getSouthWest());
          if (isCoLocated || map.getZoom() >= 18) {
            clusterMarker.openPopup();
          } else {
            map.flyToBounds(bounds.pad(0.35), {
              duration: 0.85,
              easeLinearity: 0.25,
              maxZoom: 19
            });
          }
        });

        clusterMarker.bindPopup(renderClusterPopup(cl.cameras, alarmCameras));
        clusterMarker.on('popupopen', () => {
          cl.cameras.forEach(c => {
            const btn = document.getElementById(`cluster-stream-btn-${c.id}`);
            if (btn) btn.onclick = () => {
              setSelectedDockCamera(c);
              onCameraSelect(c);
            };
          });
        });

        markersLayer.current.addLayer(clusterMarker);
        cl.cameras.forEach(c => {
          markersMapRef.current[c.id] = clusterMarker;
        });
      }
    });

    if (leafletMap.current) leafletMap.current.invalidateSize();
  }, [cameras, spatialData, incidents, onCameraSelect]);

  // Hook clustering to cameras, incidents, and map zoom/move events
  useEffect(() => {
    if (!leafletMap.current) return;
    renderClusteredMarkers();

    const map = leafletMap.current;
    map.on('zoomend moveend', renderClusteredMarkers);

    return () => {
      map.off('zoomend moveend', renderClusteredMarkers);
    };
  }, [renderClusteredMarkers]);

  // Focus and Center Camera on Map
  const handleFocusCam = (cam) => {
    if (leafletMap.current && cam && cam.latitude && cam.longitude) {
      leafletMap.current.flyTo([cam.latitude, cam.longitude], 16, {
        duration: 0.9,
        easeLinearity: 0.25
      });
    }
  };

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
                  <div><span>Timestamp (IST)</span><b>${new Date(wp.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</b></div>
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

  const handleToggleMapLayer = () => {
    setMapLayerMode(prev => {
      let next;
      if (prev === 'street') next = 'satellite';
      else if (prev === 'satellite') next = 'dark';
      else next = 'street';
      localStorage.setItem('gujraksha_map_layer', next);
      localStorage.setItem('gujraksha_map_layer_customized', 'true');
      return next;
    });
  };

  return (
    <main className="map-hero-workspace">
      <div id="gis-map" ref={mapRef}></div>

      {/* Real-time High-Tech Grid Scanning Indicator */}
      {isSpatialLoading && (
        <div className="spatial-scanning-badge">
          <Radio size={13} className="animate-pulse" style={{ color: 'var(--accent)' }} />
          <span>Scanning Gujarat GIS Grid...</span>
        </div>
      )}

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
                ACTIVE VEHICLE ROUTE TRAJECTORY TRACED
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
            style={{ background: 'var(--danger)', color: '#fff', fontSize: '11px', padding: '5px 12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={12} /> Exit Route Mode
          </button>
        </div>
      )}

      {/* Real-Time Emergency Live Watchlist Hit Floating Alert Banner */}
      {latestLiveHit && (
        <div
          className="emergency-hit-banner"
          style={{
            position: 'absolute',
            top: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.96), rgba(159, 18, 57, 0.98))',
            color: '#fff',
            borderRadius: '12px',
            padding: '10px 18px',
            boxShadow: '0 12px 35px rgba(225, 29, 72, 0.65), 0 0 0 2px rgba(255, 255, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            animation: 'pulse 1.2s infinite ease-in-out',
            maxWidth: '92vw'
          }}
        >
          <div style={{ background: '#fff', color: '#e11d48', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <ShieldAlert size={20} color="#e11d48" strokeWidth={2.4} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '0.5px' }}>
                WATCHLIST TARGET DETECTED: {latestLiveHit.vehicleNo || latestLiveHit.vehicle_plate}
              </span>
              <span style={{ background: '#000', color: '#fbbf24', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(251, 191, 36, 0.4)' }}>
                {latestLiveHit.watchlist_category || 'STOLEN VEHICLE'}
              </span>
            </div>
            <div style={{ fontSize: '11px', opacity: 0.95, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={11} style={{ flexShrink: 0 }} />
              <span>Spotted at <b>{latestLiveHit.camera?.name || latestLiveHit.cameraName || 'Gujarat CCTV Node'}</b> [{latestLiveHit.camera?.camera_code || latestLiveHit.cameraCode || 'GJ-GOV'}] ({latestLiveHit.district || 'Gujarat'})</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <button
              className="btn btn-sm"
              onClick={() => {
                handleLocateIncident(latestLiveHit);
                onCameraSelect(latestLiveHit.camera || { id: latestLiveHit.cameraId, name: latestLiveHit.cameraName, camera_code: latestLiveHit.cameraCode, stream_url: latestLiveHit.stream_url });
                setLatestLiveHit(null);
              }}
              style={{ background: '#fff', color: '#e11d48', fontWeight: 800, fontSize: '11.5px', padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            >
              <Video size={13} /> Intercept & Watch Live
            </button>
            <button
              onClick={() => setLatestLiveHit(null)}
              style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: '#fff', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer' }}
              title="Dismiss Banner"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Real-time AI Threat & ANPR Incident Dispatch Radar */}
      <IncidentRadarPanel
        incidents={incidents}
        onLocate={handleLocateIncident}
        onOpenStream={handleOpenStreamIncident}
        onDismiss={handleDismissIncident}
        onDismissAll={handleDismissAllIncidents}
      />

      {/* Police Tactical CCTV Intercept Dock (Slide-out Monitor HUD on Bottom-Right) */}
      <PoliceTacticalDock
        camera={selectedDockCamera}
        onClose={() => setSelectedDockCamera(null)}
        onOpenFullScreen={(cam) => onCameraSelect(cam)}
        onFocusMap={handleFocusCam}
      />

      {/* Map Custom Controls with Police Layer Switcher */}
      <div className="map-controls">
        <button 
          onClick={handleToggleMapLayer} 
          title={`Switch Map Layer (Current: ${mapLayerMode.toUpperCase()} Mode)`}
          style={{ 
            color: mapLayerMode === 'satellite' ? '#38bdf8' : mapLayerMode === 'street' ? '#fbbf24' : 'var(--accent)',
            borderColor: mapLayerMode === 'satellite' ? '#38bdf8' : 'var(--panel-border)'
          }}
        >
          {mapLayerMode === 'satellite' ? <Layers size={17} /> : mapLayerMode === 'street' ? <MapPin size={17} /> : <Eye size={17} />}
        </button>
        <button onClick={handleZoomIn} title="Zoom in"><Plus size={18} strokeWidth={2.4} /></button>
        <button onClick={handleZoomOut} title="Zoom out"><Minus size={18} strokeWidth={2.4} /></button>
        <button onClick={handleRecenter} title="Reset to Gujarat State View"><Crosshair size={18} strokeWidth={2} /></button>
      </div>

      {/* Floating Tactical Map Legend */}
      <div className="floating legend-panel">
        <div className="legend-title">
          <Shield size={12} style={{ color: 'var(--accent)' }} />
          <span>Security Matrix</span>
        </div>
        <div className="legend-row">
          <span className="legend-dot alarm-pulse-dot"></span>
          <b>Real-time AI Threat</b>
        </div>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--success)', boxShadow: '0 0 0 3px var(--success-glow)' }}></span>
          Active CCTV Node
        </div>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--danger)', boxShadow: '0 0 0 3px var(--danger-glow)' }}></span>
          Offline Critical
        </div>
      </div>
    </main>
  );
};
