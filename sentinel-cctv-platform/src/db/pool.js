import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mediamtxService from '../services/mediamtxService.js';
import pgClient from './pgClient.js';
import { initialCameras } from './seeds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const CAMERAS_FILE = path.join(DATA_DIR, 'cameras.json');

class CameraDataStore {
  constructor() {
    this.cameras = [];
    this.cameraMap = new Map();
    this.spatialGrid = new Map();
    this.gridResolution = 0.1; // ~10km cell resolution

    this.cameras = this.loadFromFile();
    this.rebuildIndexes();

    // Listen for PostgreSQL readiness to sync persisted data
    pgClient.on('ready', () => {
      this.loadFromDatabase();
    });

    if (pgClient.isConnected()) {
      this.loadFromDatabase();
    }
  }

  rebuildIndexes() {
    this.cameraMap.clear();
    this.spatialGrid.clear();

    const len = this.cameras.length;
    for (let i = 0; i < len; i++) {
      const c = this.cameras[i];
      if (!c) continue;

      // 1. O(1) ID & Camera Code Map
      if (c.id) this.cameraMap.set(String(c.id).toLowerCase(), c);
      if (c.camera_code) this.cameraMap.set(String(c.camera_code).toLowerCase(), c);

      // 2. Pre-computed normalized lowercase fields for zero-allocation instant filtering
      c._norm_dept = ((c.department_id || '') + ' ' + (c.department_name || '')).toLowerCase();
      c._norm_dist = ((c.district || '') + ' ' + (c.taluka || '')).toLowerCase();
      c._norm_status = String(c.status || '').toLowerCase().trim();
      c._norm_ownership = String(c.ownership_type || '').toLowerCase().trim();
      c._norm_search = (
        (c.camera_code || '') + ' ' +
        (c.name || '') + ' ' +
        (c.district || '') + ' ' +
        (c.taluka || '') + ' ' +
        (c.address || '') + ' ' +
        (c.department_name || '') + ' ' +
        (c.department_id || '') + ' ' +
        (c.vms_vendor || '') + ' ' +
        (c.id || '')
      ).toLowerCase();

      // 3. 2D Spatial Grid Bucket Indexing (for 100,000+ camera scale)
      const lat = typeof c.latitude === 'number' ? c.latitude : parseFloat(c.latitude);
      const lng = typeof c.longitude === 'number' ? c.longitude : parseFloat(c.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        c.latitude = lat;
        c.longitude = lng;
        const cellX = Math.floor(lng / this.gridResolution);
        const cellY = Math.floor(lat / this.gridResolution);
        const key = `${cellX}_${cellY}`;
        let bucket = this.spatialGrid.get(key);
        if (!bucket) {
          bucket = [];
          this.spatialGrid.set(key, bucket);
        }
        bucket.push(c);
      }
    }
  }

  loadFromFile() {
    try {
      if (fs.existsSync(CAMERAS_FILE)) {
        const raw = fs.readFileSync(CAMERAS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('⚠️ [DataStore] Could not read cameras.json fallback:', e.message);
    }
    
    // First run fallback: seed default cameras and persist to disk
    this.saveToFile([...initialCameras]);
    return [...initialCameras];
  }

  saveToFile(data = this.cameras) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CAMERAS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn('⚠️ [DataStore] Could not write cameras.json:', e.message);
    }
  }

  async loadFromDatabase() {
    try {
      if (pgClient.isConnected()) {
        const res = await pgClient.query('SELECT * FROM cameras ORDER BY created_at DESC');
        if (res && res.rows) {
          this.cameras = res.rows.map(r => ({
            ...r,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
            retention_days: parseInt(r.retention_days || 15, 10),
            stream_properties: typeof r.stream_properties === 'string' ? JSON.parse(r.stream_properties) : (r.stream_properties || {}),
            urls: typeof r.urls === 'string' ? JSON.parse(r.urls) : (r.urls || {})
          }));
          this.rebuildIndexes();
          this.saveToFile(this.cameras);
        }
      }
    } catch (err) {
      console.error('Error loading camera data store from database:', err.message);
    }
  }

  async init() {
    await this.loadFromDatabase();
  }

  getAll(filters = {}) {
    let candidateList = this.cameras;
    let hasBbox = false;
    let minLng = 0, minLat = 0, maxLng = 0, maxLat = 0;

    // 1. Spatial Grid Index Retrieval (O(K) lookup instead of scanning 100k records)
    if (filters.bbox) {
      const parts = String(filters.bbox).split(',').map(Number);
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        [minLng, minLat, maxLng, maxLat] = parts;
        hasBbox = true;

        const minCellX = Math.floor(minLng / this.gridResolution);
        const maxCellX = Math.floor(maxLng / this.gridResolution);
        const minCellY = Math.floor(minLat / this.gridResolution);
        const maxCellY = Math.floor(maxLat / this.gridResolution);

        candidateList = [];
        for (let x = minCellX; x <= maxCellX; x++) {
          for (let y = minCellY; y <= maxCellY; y++) {
            const bucket = this.spatialGrid.get(`${x}_${y}`);
            if (bucket && bucket.length > 0) {
              for (let b = 0; b < bucket.length; b++) {
                candidateList.push(bucket[b]);
              }
            }
          }
        }
      }
    }

    // 2. Normalize filter conditions once
    const hasDept = Boolean(filters.department && filters.department !== 'ALL');
    const deptQuery = hasDept ? filters.department.toLowerCase().trim() : '';

    const hasDist = Boolean(filters.district && filters.district !== 'ALL');
    const distQuery = hasDist ? filters.district.toLowerCase().trim() : '';

    const hasStatus = Boolean(filters.status && filters.status !== 'ALL');
    const statusQuery = hasStatus ? filters.status.toLowerCase().trim() : '';

    const hasOwnership = Boolean(filters.ownership && filters.ownership !== 'ALL');
    const ownershipQuery = hasOwnership ? filters.ownership.toLowerCase().trim() : '';

    const hasSearch = Boolean(filters.search && filters.search.trim() !== '');
    const searchQuery = hasSearch ? filters.search.toLowerCase().trim() : '';

    // Fast-path: When no filters applied
    if (!hasBbox && !hasDept && !hasDist && !hasStatus && !hasOwnership && !hasSearch) {
      if (filters.page && filters.limit) {
        const page = Math.max(1, parseInt(filters.page, 10) || 1);
        const limit = Math.max(1, Math.min(5000, parseInt(filters.limit, 10) || 50));
        const offset = (page - 1) * limit;
        return this.cameras.slice(offset, offset + limit);
      }
      return this.cameras;
    }

    // 3. Ultra-Fast Single-Pass Loop with Short-Circuiting
    const result = [];
    const totalCandidates = candidateList.length;

    for (let i = 0; i < totalCandidates; i++) {
      const c = candidateList[i];
      if (!c) continue;

      if (hasBbox && (c.longitude < minLng || c.longitude > maxLng || c.latitude < minLat || c.latitude > maxLat)) {
        continue;
      }
      if (hasDept && !c._norm_dept.includes(deptQuery)) {
        if (!(deptQuery === 'home' && c._norm_dept.includes('police'))) {
          continue;
        }
      }
      if (hasDist && !c._norm_dist.includes(distQuery)) {
        continue;
      }
      if (hasStatus && c._norm_status !== statusQuery) {
        continue;
      }
      if (hasOwnership && c._norm_ownership !== ownershipQuery) {
        continue;
      }
      if (hasSearch && !c._norm_search.includes(searchQuery)) {
        continue;
      }

      result.push(c);
    }

    // 4. Optional Pagination
    if (filters.page && filters.limit) {
      const page = Math.max(1, parseInt(filters.page, 10) || 1);
      const limit = Math.max(1, Math.min(5000, parseInt(filters.limit, 10) || 50));
      const offset = (page - 1) * limit;
      return result.slice(offset, offset + limit);
    } else if (filters.limit && !isNaN(parseInt(filters.limit, 10))) {
      const limit = Math.max(1, parseInt(filters.limit, 10));
      return result.slice(0, limit);
    }

    // 5. Lightweight Projections
    if (filters.format === 'compact') {
      return result.map(c => [
        c.id,
        c.camera_code,
        c.name,
        c.latitude,
        c.longitude,
        c.status === 'ACTIVE' ? 1 : (c.status === 'MAINTENANCE' ? 2 : 0),
        c.department_id,
        c.district,
        c.camera_type,
        c.detection_mode
      ]);
    } else if (filters.format === 'lightweight') {
      return result.map(c => ({
        id: c.id,
        camera_code: c.camera_code,
        name: c.name,
        latitude: c.latitude,
        longitude: c.longitude,
        status: c.status,
        department_id: c.department_id,
        department_name: c.department_name,
        district: c.district,
        camera_type: c.camera_type,
        detection_mode: c.detection_mode
      }));
    }

    return result;
  }

  getSpatialCameras(options = {}) {
    const zoom = options.zoom ? parseInt(options.zoom, 10) : 7;
    const allFiltered = this.getAll({
      ...options,
      page: undefined,
      limit: undefined,
      format: undefined
    });

    const total = allFiltered.length;

    // 1. Statewide / District Aggregation when zoom < 10 (State / District Overview)
    if (zoom < 10) {
      const districtMap = new Map();
      const count = allFiltered.length;

      for (let i = 0; i < count; i++) {
        const c = allFiltered[i];
        const distKey = c.district || 'Gujarat';
        let cluster = districtMap.get(distKey);
        if (!cluster) {
          cluster = {
            id: `dist-${distKey.toLowerCase().replace(/\s+/g, '-')}`,
            district: distKey,
            count: 0,
            activeCount: 0,
            offlineCount: 0,
            sumLat: 0,
            sumLng: 0
          };
          districtMap.set(distKey, cluster);
        }
        cluster.count++;
        if (c.status === 'ACTIVE') cluster.activeCount++;
        else if (c.status === 'OFFLINE') cluster.offlineCount++;
        cluster.sumLat += c.latitude;
        cluster.sumLng += c.longitude;
      }

      const clusters = [];
      for (const cl of districtMap.values()) {
        clusters.push({
          id: cl.id,
          district: cl.district,
          count: cl.count,
          active: cl.activeCount,
          offline: cl.offlineCount,
          latitude: cl.sumLat / cl.count,
          longitude: cl.sumLng / cl.count
        });
      }

      return {
        clustered: true,
        cluster_level: 'DISTRICT',
        zoom,
        total_cameras: total,
        cluster_count: clusters.length,
        clusters: clusters
      };
    }

    // 2. City, Area & Street View (zoom >= 10): Return viewport camera points
    const maxPoints = Math.min(allFiltered.length, 5000);
    const points = new Array(maxPoints);
    for (let i = 0; i < maxPoints; i++) {
      const c = allFiltered[i];
      points[i] = {
        id: c.id,
        camera_code: c.camera_code,
        name: c.name,
        district: c.district,
        department_id: c.department_id,
        camera_type: c.camera_type,
        detection_mode: c.detection_mode,
        status: c.status,
        latitude: c.latitude,
        longitude: c.longitude
      };
    }

    return {
      clustered: false,
      zoom,
      total_cameras: total,
      returned_cameras: points.length,
      cameras: points
    };
  }

  getById(id) {
    if (!id) return null;
    const key = String(id).toLowerCase().trim();
    return this.cameraMap.get(key) || this.cameras.find(c => c.id === id || c.camera_code === id);
  }

  getNextCameraIdentifiers() {
    let maxNum = 0;
    this.cameras.forEach(c => {
      if (c.id && c.id.startsWith('gov-feed-')) {
        const numPart = parseInt(c.id.replace('gov-feed-', ''), 10);
        if (!isNaN(numPart) && numPart < 1000000 && numPart > maxNum) {
          maxNum = numPart;
        }
      }
      if (c.camera_code && c.camera_code.startsWith('GJ-GOV-')) {
        const codeNum = parseInt(c.camera_code.replace('GJ-GOV-', ''), 10);
        if (!isNaN(codeNum) && codeNum < 1000000 && codeNum > maxNum) {
          maxNum = codeNum;
        }
      }
    });
    const nextNum = maxNum + 1;
    return {
      id: `gov-feed-${nextNum}`,
      camera_code: `GJ-GOV-${String(nextNum).padStart(3, '0')}`,
      nextNum
    };
  }

  normalizeStreamData(cameraData, fallbackId) {
    const cleanId = String(cameraData.id || fallbackId || '').replace('gov-feed-', '') || Date.now().toString().slice(-4);
    
    let streamUrl = cameraData.stream_url || '';
    let rtspUrl = cameraData.rtsp_url || (cameraData.urls && cameraData.urls.rtsp) || '';
    let whepUrl = cameraData.whep_url || (cameraData.urls && cameraData.urls.whep) || '';
    let hlsUrl = cameraData.hls_url || (cameraData.urls && cameraData.urls.hls) || '';

    if (streamUrl && streamUrl.startsWith('rtsp://') && !rtspUrl) {
      rtspUrl = streamUrl;
    }
    if (streamUrl && (streamUrl.endsWith('/whep') || streamUrl.includes(':8889/')) && !whepUrl) {
      whepUrl = streamUrl;
    }
    if (streamUrl && (streamUrl.includes('.m3u8') || streamUrl.includes('/live/')) && !hlsUrl) {
      hlsUrl = streamUrl;
    }

    if (rtspUrl && !whepUrl) {
      if (rtspUrl.includes('live.corp8.cloud')) {
        whepUrl = `http://live.corp8.cloud:8889/stream/${cleanId}/whep`;
        if (!hlsUrl) hlsUrl = `https://live.corp8.cloud/live/stream/${cleanId}/index.m3u8`;
      } else {
        whepUrl = `http://localhost:8889/stream/${cleanId}/whep`;
        if (!hlsUrl) hlsUrl = `http://localhost:8888/stream/${cleanId}/index.m3u8`;
      }
    }

    if (whepUrl && !rtspUrl) {
      if (whepUrl.includes('live.corp8.cloud')) {
        rtspUrl = `rtsp://live.corp8.cloud:8554/stream/${cleanId}`;
        if (!hlsUrl) hlsUrl = `https://live.corp8.cloud/live/stream/${cleanId}/index.m3u8`;
      } else {
        rtspUrl = `rtsp://localhost:8554/stream/${cleanId}`;
        if (!hlsUrl) hlsUrl = `http://localhost:8888/stream/${cleanId}/index.m3u8`;
      }
    }

    if (!rtspUrl && !whepUrl && !streamUrl) {
      rtspUrl = `rtsp://localhost:8554/stream/${cleanId}`;
      whepUrl = `http://localhost:8889/stream/${cleanId}/whep`;
      hlsUrl = `http://localhost:8888/stream/${cleanId}/index.m3u8`;
      streamUrl = rtspUrl;
    } else if (!streamUrl) {
      streamUrl = rtspUrl || whepUrl;
    }

    if (!whepUrl && cleanId) {
      whepUrl = `http://localhost:8889/stream/${cleanId}/whep`;
    }
    if (!hlsUrl && cleanId) {
      hlsUrl = `http://localhost/live/stream/${cleanId}/index.m3u8`;
    }

    const codec = cameraData.codec || (cameraData.stream_properties && cameraData.stream_properties.codec) || 'H.264';
    const resolution = cameraData.resolution || (cameraData.stream_properties && cameraData.stream_properties.resolution) || '1920x1080';
    const fps = Number(cameraData.fps || (cameraData.stream_properties && cameraData.stream_properties.fps) || 30);
    const bitrate = cameraData.bitrate || (cameraData.stream_properties && cameraData.stream_properties.bitrate) || '4Mbps';

    return {
      stream_url: streamUrl,
      rtsp_url: rtspUrl,
      whep_url: whepUrl,
      hls_url: hlsUrl,
      urls: {
        rtsp: rtspUrl,
        whep: whepUrl,
        hls: hlsUrl
      },
      codec: codec,
      stream_properties: {
        resolution: resolution,
        fps: fps,
        codec: codec,
        bitrate: bitrate
      }
    };
  }

  async create(cameraData) {
    const autoIds = this.getNextCameraIdentifiers();
    const id = cameraData.id || autoIds.id;
    const cameraCode = cameraData.camera_code || autoIds.camera_code;

    const streamData = this.normalizeStreamData(cameraData, id);

    const newCamera = {
      id: id,
      camera_code: cameraCode,
      name: cameraData.name,
      department_id: cameraData.department_id || 'HOME',
      department_name: cameraData.department_name || 'Home Department / Gujarat Police',
      district: cameraData.district || 'Ahmedabad',
      taluka: cameraData.taluka || '',
      latitude: parseFloat(cameraData.latitude),
      longitude: parseFloat(cameraData.longitude),
      address: cameraData.address || '',
      ownership_type: cameraData.ownership_type || 'GOVERNMENT',
      camera_type: cameraData.camera_type || 'PTZ',
      detection_mode: cameraData.detection_mode || 'TRAFFIC_MONITORING',
      vms_vendor: cameraData.vms_vendor || 'Live Sentinel Feeder (H264/MP4)',
      stream_url: streamData.stream_url,
      retention_days: parseInt(cameraData.retention_days || 15, 10),
      status: cameraData.status || 'ACTIVE',
      installation_date: cameraData.installation_date || new Date().toISOString().split('T')[0],
      created_at: cameraData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      codec: streamData.codec,
      urls: streamData.urls,
      rtsp_url: streamData.rtsp_url,
      whep_url: streamData.whep_url,
      hls_url: streamData.hls_url,
      stream_properties: streamData.stream_properties
    };

    const existingIdx = this.cameras.findIndex(c => c.id === newCamera.id || c.camera_code === newCamera.camera_code);
    if (existingIdx >= 0) {
      this.cameras[existingIdx] = newCamera;
    } else {
      this.cameras.push(newCamera);
    }
    this.rebuildIndexes();
    this.saveToFile();

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      try {
        await pgClient.query(
          `INSERT INTO cameras (
            id, camera_code, name, department_id, department_name, district, taluka,
            latitude, longitude, address, ownership_type, camera_type, detection_mode,
            vms_vendor, stream_url, rtsp_url, whep_url, hls_url, codec, retention_days,
            status, installation_date, stream_properties, urls, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            camera_code = EXCLUDED.camera_code,
            department_id = EXCLUDED.department_id,
            department_name = EXCLUDED.department_name,
            district = EXCLUDED.district,
            taluka = EXCLUDED.taluka,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            address = EXCLUDED.address,
            ownership_type = EXCLUDED.ownership_type,
            camera_type = EXCLUDED.camera_type,
            detection_mode = EXCLUDED.detection_mode,
            vms_vendor = EXCLUDED.vms_vendor,
            stream_url = EXCLUDED.stream_url,
            rtsp_url = EXCLUDED.rtsp_url,
            whep_url = EXCLUDED.whep_url,
            hls_url = EXCLUDED.hls_url,
            codec = EXCLUDED.codec,
            retention_days = EXCLUDED.retention_days,
            status = EXCLUDED.status,
            stream_properties = EXCLUDED.stream_properties,
            urls = EXCLUDED.urls,
            updated_at = NOW()`,
          [
            newCamera.id, newCamera.camera_code, newCamera.name, newCamera.department_id, newCamera.department_name,
            newCamera.district, newCamera.taluka, newCamera.latitude, newCamera.longitude, newCamera.address,
            newCamera.ownership_type, newCamera.camera_type, newCamera.detection_mode, newCamera.vms_vendor,
            newCamera.stream_url, newCamera.rtsp_url, newCamera.whep_url, newCamera.hls_url, newCamera.codec,
            newCamera.retention_days, newCamera.status, newCamera.installation_date,
            JSON.stringify(newCamera.stream_properties || {}), JSON.stringify(newCamera.urls || {})
          ]
        );
      } catch (err) {
        console.warn('PG Camera Insert Error:', err.message);
      }
    }

    try {
      mediamtxService.registerCameraStream(newCamera);
    } catch (e) {}
    return newCamera;
  }

  async update(id, updateData) {
    const idx = this.cameras.findIndex(c => c.id === id || c.camera_code === id);
    if (idx === -1) {
      return null;
    }

    const existing = this.cameras[idx];
    const streamData = this.normalizeStreamData({
      ...existing,
      ...updateData
    }, existing.id);

    const updated = {
      ...existing,
      name: updateData.name !== undefined ? updateData.name : existing.name,
      department_id: updateData.department_id !== undefined ? updateData.department_id : existing.department_id,
      department_name: updateData.department_name !== undefined ? updateData.department_name : existing.department_name,
      district: updateData.district !== undefined ? updateData.district : existing.district,
      taluka: updateData.taluka !== undefined ? updateData.taluka : existing.taluka,
      latitude: updateData.latitude !== undefined ? parseFloat(updateData.latitude) : existing.latitude,
      longitude: updateData.longitude !== undefined ? parseFloat(updateData.longitude) : existing.longitude,
      address: updateData.address !== undefined ? updateData.address : existing.address,
      ownership_type: updateData.ownership_type !== undefined ? updateData.ownership_type : existing.ownership_type,
      camera_type: updateData.camera_type !== undefined ? updateData.camera_type : existing.camera_type,
      detection_mode: updateData.detection_mode !== undefined ? updateData.detection_mode : (existing.detection_mode || 'TRAFFIC_MONITORING'),
      vms_vendor: updateData.vms_vendor !== undefined ? updateData.vms_vendor : existing.vms_vendor,
      stream_url: streamData.stream_url,
      retention_days: updateData.retention_days !== undefined ? parseInt(updateData.retention_days, 10) : existing.retention_days,
      status: updateData.status !== undefined ? updateData.status : existing.status,
      installation_date: updateData.installation_date !== undefined ? updateData.installation_date : existing.installation_date,
      codec: streamData.codec,
      urls: streamData.urls,
      rtsp_url: streamData.rtsp_url,
      whep_url: streamData.whep_url,
      hls_url: streamData.hls_url,
      stream_properties: streamData.stream_properties,
      updated_at: new Date().toISOString()
    };

    this.cameras[idx] = updated;
    this.rebuildIndexes();
    this.saveToFile();

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      try {
        await pgClient.query(
          `UPDATE cameras SET
            name = $1, department_id = $2, department_name = $3, district = $4,
            taluka = $5, latitude = $6, longitude = $7, address = $8, ownership_type = $9,
            camera_type = $10, detection_mode = $11, vms_vendor = $12, stream_url = $13,
            retention_days = $14, status = $15, installation_date = $16, codec = $17,
            urls = $18, rtsp_url = $19, whep_url = $20, hls_url = $21, stream_properties = $22,
            updated_at = NOW()
          WHERE id = $23 OR camera_code = $23`,
          [
            updated.name, updated.department_id, updated.department_name, updated.district,
            updated.taluka, updated.latitude, updated.longitude, updated.address, updated.ownership_type,
            updated.camera_type, updated.detection_mode, updated.vms_vendor, updated.stream_url,
            updated.retention_days, updated.status, updated.installation_date, updated.codec,
            JSON.stringify(updated.urls || {}), updated.rtsp_url, updated.whep_url, updated.hls_url,
            JSON.stringify(updated.stream_properties || {}), id
          ]
        );
      } catch (err) {
        console.warn('PG Camera Update Error:', err.message);
      }
    }

    try {
      mediamtxService.registerCameraStream(updated);
    } catch (e) {}
    return updated;
  }

  async delete(id) {
    const idx = this.cameras.findIndex(c => c.id === id || c.camera_code === id);
    let removed = null;
    if (idx !== -1) {
      removed = this.cameras.splice(idx, 1)[0];
      this.rebuildIndexes();
      this.saveToFile();
    }

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      try {
        const res = await pgClient.query('DELETE FROM cameras WHERE id = $1 OR camera_code = $1 RETURNING *', [id]);
        if (!removed && res && res.rows && res.rows.length > 0) {
          removed = res.rows[0];
          this.rebuildIndexes();
          this.saveToFile();
        }
      } catch (err) {
        console.warn('PG Camera Delete Error:', err.message);
      }
    }

    return removed;
  }

  async bulkCreate(cameraList) {
    const added = [];
    for (const c of cameraList) {
      added.push(await this.create(c));
    }
    return added;
  }
}

export default new CameraDataStore();
