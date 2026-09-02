import express from 'express';
import cameraService from '../services/cameraService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET lightweight camera directory for AI Inference pipeline (no auth required for edge nodes)
router.get('/sync-list', (req, res, next) => {
  try {
    const result = cameraService.getCameras({});
    const list = result.cameras || [];
    res.json({
      success: true,
      total_cameras: list.length,
      data: list.map(c => ({
        id: c.id,
        camera_code: c.camera_code,
        name: c.name,
        district: c.district,
        department_name: c.department_name,
        camera_type: c.camera_type,
        detection_mode: c.detection_mode || 'GENERAL_SURVEILLANCE',
        stream_url: c.stream_url,

        status: c.status,
        latitude: c.latitude,
        longitude: c.longitude
      }))
    });
  } catch (err) {
    next(err);
  }
});

// GET Spatial Bounding Box & Zoom Clustering (Optimized for 80,000+ camera assets)
router.get('/spatial', authenticateToken, (req, res, next) => {
  try {
    const options = {
      bbox: req.query.bbox,
      zoom: req.query.zoom,
      department: req.query.department,
      district: req.query.district,
      status: req.query.status,
      detection_mode: req.query.detection_mode,
      search: req.query.search,
      format: req.query.format
    };
    const result = cameraService.getSpatialCameras(options);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticateToken, (req, res, next) => {
  try {
    const filters = {
      department: req.query.department,
      district: req.query.district,
      status: req.query.status,
      detection_mode: req.query.detection_mode,
      ownership: req.query.ownership,
      search: req.query.search,
      bbox: req.query.bbox,
      zoom: req.query.zoom,
      page: req.query.page,
      limit: req.query.limit,
      format: req.query.format
    };
    const result = cameraService.getCameras(filters);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticateToken, (req, res, next) => {
  try {
    const camera = cameraService.getCameraById(req.params.id);
    res.json({
      success: true,
      data: camera
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const newCamera = await cameraService.registerCamera(req.body);
    res.status(201).json({
      success: true,
      message: 'Camera asset successfully registered into state CCTV registry.',
      data: newCamera
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const updated = await cameraService.updateCamera(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Camera asset successfully updated in state CCTV registry.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-delete', authenticateToken, async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'Array of camera IDs is required for bulk delete.' } });
    }
    const removed = await cameraService.bulkDeleteCameras(ids);
    res.json({
      success: true,
      message: `Successfully deleted ${removed.length} camera assets from registry.`,
      count: removed.length,
      data: removed
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const deleted = await cameraService.deleteCamera(req.params.id);
    res.json({
      success: true,
      message: 'Camera asset successfully removed from registry.',
      data: deleted
    });
  } catch (err) {
    next(err);
  }
});

export default router;
