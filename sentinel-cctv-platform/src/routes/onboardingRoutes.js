import express from 'express';
import onboardingService from '../services/onboardingService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/bulk-csv', authenticateToken, (req, res, next) => {
  try {
    const csvContent = req.body.csv || req.body.data;
    if (!csvContent) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_PAYLOAD', message: 'No CSV payload provided in request body.' }
      });
    }

    const result = onboardingService.processBulkCsv(csvContent);
    res.json({
      success: true,
      message: `Bulk onboarding completed. ${result.successCount} cameras registered.`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.post('/sync-gov-feeds', authenticateToken, async (req, res, next) => {
  try {
    const result = await onboardingService.syncGovernmentLiveFeeds();
    res.json({
      success: true,
      message: `Successfully synchronized ${result.count} live government feeds from http://live.sentinelgujarat.in/`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
