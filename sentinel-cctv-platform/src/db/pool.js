import mediamtxService from '../services/mediamtxService.js';
import pgClient from './pgClient.js';
import { initialCameras } from './seeds.js';

class CameraDataStore {
  constructor() {
    this.cameras = [...initialCameras];
    this.init();
  }

  async init() {
    try {
      if (pgClient.isConnected()) {
        const res = await pgClient.query('SELECT * FROM cameras ORDER BY created_at DESC');
        if (res && res.rows && res.rows.length > 0) {
          this.cameras = res.rows.map(r => ({
            ...r,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
            stream_properties: typeof r.stream_properties === 'string' ? JSON.parse(r.stream_properties) : (r.stream_properties || {}),
            urls: typeof r.urls === 'string' ? JSON.parse(r.urls) : (r.urls || {})
          }));
        }
      }
    } catch (err) {
      console.error('Error loading camera data store from database:', err.message);
    }
  }

  getAll(filters = {}) {
    let result = [...this.cameras];

    if (filters.department && filters.department !== 'ALL') {
      result = result.filter(c => (c.department_id || '').toLowerCase() === filters.department.toLowerCase());
    }

    if (filters.district && filters.district !== 'ALL') {
      result = result.filter(c => (c.district || '').toLowerCase() === filters.district.toLowerCase());
    }

    if (filters.status && filters.status !== 'ALL') {
      result = result.filter(c => (c.status || '').toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.ownership && filters.ownership !== 'ALL') {
      result = result.filter(c => (c.ownership_type || '').toLowerCase() === filters.ownership.toLowerCase());
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c => 
        (c.camera_code || '').toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.district || '').toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.vms_vendor && c.vms_vendor.toLowerCase().includes(q))
      );
    }

    return result;
  }

  getById(id) {
    return this.cameras.find(c => c.id === id || c.camera_code === id);
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

  create(cameraData) {
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

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      pgClient.query(
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
      ).catch(err => console.warn('PG Camera Insert Error:', err.message));
    }

    try {
      mediamtxService.registerCameraStream(newCamera);
    } catch (e) {}
    return newCamera;
  }

  update(id, updateData) {
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

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      pgClient.query(
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
      ).catch(err => console.warn('PG Camera Update Error:', err.message));
    }

    try {
      mediamtxService.registerCameraStream(updated);
    } catch (e) {}
    return updated;
  }

  delete(id) {
    const idx = this.cameras.findIndex(c => c.id === id || c.camera_code === id);
    if (idx !== -1) {
      const removed = this.cameras.splice(idx, 1);

      // Direct Database Persistence (PostgreSQL)
      if (pgClient.isConnected()) {
        pgClient.query('DELETE FROM cameras WHERE id = $1 OR camera_code = $1', [id])
          .catch(err => console.warn('PG Camera Delete Error:', err.message));
      }

      return removed[0];
    }
    return null;
  }

  bulkCreate(cameraList) {
    const added = [];
    cameraList.forEach(c => {
      added.push(this.create(c));
    });
    return added;
  }
}

export default new CameraDataStore();
