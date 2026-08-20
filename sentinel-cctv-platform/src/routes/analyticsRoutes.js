import express from 'express';
import gapAnalysisService from '../services/gapAnalysisService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/gap-analysis', authenticateToken, (req, res, next) => {
  try {
    const report = gapAnalysisService.generateReport();
    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    next(err);
  }
});

export default router;
