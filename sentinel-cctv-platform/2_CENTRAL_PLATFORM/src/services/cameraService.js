import db from '../db/pool.js';
import mediamtxService from './mediamtxService.js';
import workerOrchestratorService from './workerOrchestratorService.js';
import anprStore from '../db/anprStore.js';

class CameraService {
  getCameras(filters = {}) {
    const cameras = db.getAll(filters);
    return {
      total: db.cameras.length,
      filtered_total: Array.isArray(cameras) ? cameras.length : 0,
      cameras: cameras
    };
  }

  getSpatialCameras(options = {}) {
    return db.getSpatialCameras(options);
  }

  getCameraById(id) {
    const camera = db.getById(id);
    if (!camera) {
      const err = new Error(`Camera asset '${id}' not found in state registry.`);
      err.statusCode = 404;
      err.code = 'ASSET_NOT_FOUND';
      throw err;
    }
    return camera;
  }

  async registerCamera(cameraData) {
    if (!cameraData.name || cameraData.latitude === undefined || cameraData.longitude === undefined) {
      const err = new Error('Camera Name, Latitude, and Longitude are mandatory parameters.');
      err.statusCode = 400;
      err.code = 'INVALID_PAYLOAD';
      throw err;
    }

    const existingCameras = db.getAll({});
    const inputCode = (cameraData.camera_code || '').trim().toUpperCase();
    const inputName = (cameraData.name || '').trim().toLowerCase();
    const inputDistrict = (cameraData.district || '').trim().toLowerCase();
    const inputStream = (cameraData.stream_url || cameraData.rtsp_url || '').trim().toLowerCase();

    // 1. Check duplicate by camera asset code
    if (inputCode) {
      const dupCode = existingCameras.find(c => (c.camera_code || '').toUpperCase() === inputCode);
      if (dupCode) {
        const err = new Error(`Duplicate Camera: Camera with Asset Code '${dupCode.camera_code}' (${dupCode.name}) already exists in registry.`);
        err.statusCode = 409;
        err.code = 'DUPLICATE_CAMERA_CODE';
        throw err;
      }
    }

    // 2. Check duplicate by name + district
    if (inputName && inputDistrict) {
      const dupName = existingCameras.find(c => 
        (c.name || '').trim().toLowerCase() === inputName && 
        (c.district || '').trim().toLowerCase() === inputDistrict
      );
      if (dupName) {
        const err = new Error(`Duplicate Camera: A camera named '${dupName.name}' is already registered in ${dupName.district} district.`);
        err.statusCode = 409;
        err.code = 'DUPLICATE_CAMERA_NAME';
        throw err;
      }
    }

    // 3. Check duplicate by stream URL (ignore localhost/dummy URLs)
    if (inputStream && !inputStream.includes('localhost') && !inputStream.includes('127.0.0.1')) {
      const dupStream = existingCameras.find(c => {
        const existingStream = (c.stream_url || c.rtsp_url || '').trim().toLowerCase();
        return existingStream && existingStream === inputStream;
      });
      if (dupStream) {
        const err = new Error(`Duplicate Camera: Stream URL is already assigned to camera '${dupStream.name}' (${dupStream.camera_code}).`);
        err.statusCode = 409;
        err.code = 'DUPLICATE_STREAM_URL';
        throw err;
      }
    }

    const created = await db.create(cameraData);
    try {
      workerOrchestratorService.syncAllWorkerAssignments();
    } catch (_) {}
    return created;
  }

  async updateCamera(id, updateData) {
    const updated = await db.update(id, updateData);
    if (!updated) {
      const err = new Error(`Camera asset '${id}' not found for update.`);
      err.statusCode = 404;
      err.code = 'ASSET_NOT_FOUND';
      throw err;
    }

    // Synchronize ANPR workers if detection_mode or status changed
    try {
      workerOrchestratorService.syncAllWorkerAssignments();
    } catch (_) {}

    return updated;
  }

  async deleteCamera(id) {
    const targetCam = db.getById(id);
    const camCodeBefore = targetCam ? targetCam.camera_code : null;

    const deleted = await db.delete(id);
    if (!deleted) {
      const err = new Error(`Camera asset '${id}' not found for deletion.`);
      err.statusCode = 404;
      err.code = 'ASSET_NOT_FOUND';
      throw err;
    }

    const camId = deleted.id || id;
    const camCode = deleted.camera_code || camCodeBefore || id;

    // 🛑 1. Revoke from MediaMTX WebRTC Stream Gateway
    try {
      await mediamtxService.removeCameraStream(camId);
      if (camCode && camCode !== camId) {
        await mediamtxService.removeCameraStream(camCode);
      }
    } catch (_) {}

    // 🛑 2. Revoke from AI ANPR Worker Nodes
    try {
      workerOrchestratorService.onCameraDeleted(camId);
      if (camCode && camCode !== camId) {
        workerOrchestratorService.onCameraDeleted(camCode);
      }
    } catch (_) {}

    // 🛑 3. Revoke from Live Detection Cache
    try {
      anprStore.onCameraDeleted(camId);
      if (camCode && camCode !== camId) {
        anprStore.onCameraDeleted(camCode);
      }
    } catch (_) {}

    return deleted;
  }

  async bulkDeleteCameras(ids = []) {
    const deleted = await db.bulkDelete(ids);

    // 🛑 Revoke all deleted cameras across MediaMTX and AI ANPR Worker Nodes
    for (const id of ids) {
      try {
        await mediamtxService.removeCameraStream(id);
      } catch (_) {}
    }

    try {
      workerOrchestratorService.onCamerasDeleted(ids);
    } catch (_) {}

    try {
      anprStore.onCamerasDeleted(ids);
    } catch (_) {}

    return deleted;
  }

  async bulkUpdateCameras(ids = [], updateData = {}) {
    const updated = await db.bulkUpdate(ids, updateData);

    // Synchronize worker assignments
    try {
      workerOrchestratorService.syncAllWorkerAssignments();
    } catch (_) {}

    return updated;
  }
}

export default new CameraService();

