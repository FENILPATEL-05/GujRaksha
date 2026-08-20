const express = require('express');
const router = express.Router();
const gapAnalysisService = require('../services/gapAnalysisService');
const { authenticateToken } = require('../middleware/auth');

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

module.exports = router;
