import fs from 'fs';
import path from 'path';
import config from '../config/env.js';

class CameraDataStore {
  constructor() {
    this.filePath = config.DATA_PATH;
    this.cameras = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.cameras = JSON.parse(raw);
      } else {
        this.cameras = [];
      }
    } catch (err) {
      console.error('Error loading camera data store:', err.message);
      this.cameras = [];
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.cameras, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving camera data store:', err.message);
    }
  }

  getAll(filters = {}) {
    let result = [...this.cameras];

    if (filters.department && filters.department !== 'ALL') {
      result = result.filter(c => c.department_id.toLowerCase() === filters.department.toLowerCase());
    }

    if (filters.district && filters.district !== 'ALL') {
      result = result.filter(c => c.district.toLowerCase() === filters.district.toLowerCase());
    }

    if (filters.status && filters.status !== 'ALL') {
      result = result.filter(c => c.status.toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.ownership && filters.ownership !== 'ALL') {
      result = result.filter(c => c.ownership_type.toLowerCase() === filters.ownership.toLowerCase());
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c => 
        c.camera_code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
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
      const match = rtspUrl.match(/rtsp:\/\/([^:/]+):?(\d*)\/(.+)/);
      if (match) {
        const host = match[1] || 'localhost';
        const pathPart = match[3];
        whepUrl = `http://${host}:8889/${pathPart}/whep`;
        if (!hlsUrl) hlsUrl = `http://${host}/live/${pathPart}/index.m3u8`;
      } else {
        whepUrl = `http://localhost:8889/stream/${cleanId}/whep`;
      }
    }

    if (whepUrl && !rtspUrl) {
      const match = whepUrl.match(/https?:\/\/([^:/]+):?(\d*)\/(.+)\/whep/);
      if (match) {
        const host = match[1] || 'localhost';
        const pathPart = match[3];
        rtspUrl = `rtsp://${host}:8554/${pathPart}`;
        if (!hlsUrl) hlsUrl = `http://${host}/live/${pathPart}/index.m3u8`;
      } else {
        rtspUrl = `rtsp://localhost:8554/stream/${cleanId}`;
      }
    }

    if (!rtspUrl && !whepUrl && !streamUrl) {
      rtspUrl = `rtsp://localhost:8554/stream/${cleanId}`;
      whepUrl = `http://localhost:8889/stream/${cleanId}/whep`;
      hlsUrl = `http://localhost/live/stream/${cleanId}/index.m3u8`;
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

    this.save();
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
    this.save();
    return updated;
  }

  delete(id) {
    const idx = this.cameras.findIndex(c => c.id === id || c.camera_code === id);
    if (idx !== -1) {
      const removed = this.cameras.splice(idx, 1);
      this.save();
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
