import db from '../db/pool.js';

class CameraService {
  getCameras(filters) {
    const cameras = db.getAll(filters);
    return {
      total: cameras.length,
      cameras: cameras
    };
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
    return await db.create(cameraData);
  }

  async updateCamera(id, updateData) {
    const updated = await db.update(id, updateData);
    if (!updated) {
      const err = new Error(`Camera asset '${id}' not found for update.`);
      err.statusCode = 404;
      err.code = 'ASSET_NOT_FOUND';
      throw err;
    }
    return updated;
  }

  async deleteCamera(id) {
    const deleted = await db.delete(id);
    if (!deleted) {
      const err = new Error(`Camera asset '${id}' not found for deletion.`);
      err.statusCode = 404;
      err.code = 'ASSET_NOT_FOUND';
      throw err;
    }
    return deleted;
  }
}

export default new CameraService();
