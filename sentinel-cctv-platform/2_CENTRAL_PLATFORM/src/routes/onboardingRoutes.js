import express from 'express';
import onboardingService from '../services/onboardingService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/template-csv', (req, res) => {
  try {
    const template = onboardingService.getSampleCsvTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="camera_onboarding_template.csv"');
    return res.send(template);
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

router.post('/bulk-csv', authenticateToken, async (req, res, next) => {
  try {
    let csvContent = '';
    if (typeof req.body === 'string') {
      csvContent = req.body;
    } else if (req.body && typeof req.body === 'object') {
      csvContent = req.body.csv || req.body.data || req.body.csvContent || req.body.content || '';
    }

    if (!csvContent) {
      csvContent = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve(parsed.csv || parsed.data || raw);
          } catch (e) {
            resolve(raw);
          }
        });
        req.on('error', () => resolve(''));
      });
    }

    if (!csvContent || !csvContent.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_PAYLOAD', message: 'No CSV payload provided in request body.' }
      });
    }

    const result = await onboardingService.processBulkCsv(csvContent);
    return res.json({
      success: true,
      message: `Bulk onboarding completed. ${result.successCount} cameras registered successfully.`,
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
      message: `Successfully synchronized ${result.count} live government feeds from https://cctv.corp8.cloud/`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
