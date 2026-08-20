import express from 'express';
import cameraService from '../services/cameraService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, (req, res, next) => {
  try {
    const filters = {
      department: req.query.department,
      district: req.query.district,
      status: req.query.status,
      ownership: req.query.ownership,
      search: req.query.search
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

router.post('/', authenticateToken, (req, res, next) => {
  try {
    const newCamera = cameraService.registerCamera(req.body);
    res.status(201).json({
      success: true,
      message: 'Camera asset successfully registered into state CCTV registry.',
      data: newCamera
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticateToken, (req, res, next) => {
  try {
    const updated = cameraService.updateCamera(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Camera asset successfully updated in state CCTV registry.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, (req, res, next) => {
  try {
    const deleted = cameraService.deleteCamera(req.params.id);
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
