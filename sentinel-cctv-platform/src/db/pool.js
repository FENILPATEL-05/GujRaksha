const fs = require('fs');
const path = require('path');
const config = require('../config/env');

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

  create(cameraData) {
    const newCamera = {
      id: cameraData.id || `gov-feed-${Date.now()}`,
      camera_code: cameraData.camera_code || `GJ-GOV-${Date.now().toString().slice(-3)}`,
      name: cameraData.name,
      department_id: cameraData.department_id || 'HOME',
      department_name: cameraData.department_name || 'Home Department / Police',
      district: cameraData.district || 'Gandhinagar',
      taluka: cameraData.taluka || '',
      latitude: parseFloat(cameraData.latitude),
      longitude: parseFloat(cameraData.longitude),
      address: cameraData.address || '',
      ownership_type: cameraData.ownership_type || 'GOVERNMENT',
      camera_type: cameraData.camera_type || 'ANPR_SPECIAL',
      vms_vendor: cameraData.vms_vendor || 'Live Sentinel Simulator (H264/MP4)',
      stream_url: cameraData.stream_url || '',
      retention_days: parseInt(cameraData.retention_days || 15, 10),
      status: cameraData.status || 'ACTIVE',
      installation_date: cameraData.installation_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
    const updated = {
      ...existing,
      name: updateData.name !== undefined ? updateData.name : existing.name,
      department_id: updateData.department_id !== undefined ? updateData.department_id : existing.department_id,
      department_name: updateData.department_name !== undefined ? updateData.department_name : existing.department_name,
      district: updateData.district !== undefined ? updateData.district : existing.district,
      latitude: updateData.latitude !== undefined ? parseFloat(updateData.latitude) : existing.latitude,
      longitude: updateData.longitude !== undefined ? parseFloat(updateData.longitude) : existing.longitude,
      address: updateData.address !== undefined ? updateData.address : existing.address,
      vms_vendor: updateData.vms_vendor !== undefined ? updateData.vms_vendor : existing.vms_vendor,
      stream_url: updateData.stream_url !== undefined ? updateData.stream_url : existing.stream_url,
      status: updateData.status !== undefined ? updateData.status : existing.status,
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

module.exports = new CameraDataStore();
