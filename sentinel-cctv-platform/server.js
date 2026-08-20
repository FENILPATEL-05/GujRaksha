/**
 * GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial GIS Control Platform
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 * Proprietary & Confidential — Unauthorized copying or distribution is strictly prohibited.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// REST API Routes
const cameraRoutes = require('./src/routes/cameraRoutes');
const onboardingRoutes = require('./src/routes/onboardingRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const proxyRoutes = require('./src/routes/proxyRoutes');

app.use('/api/v1/cameras', cameraRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/proxy-stream', proxyRoutes);

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    platform: 'GujRaksha CCTV Control Center',
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Single Port Dev Setup using Vite Middleware
    try {
      const { createServer: createViteServer } = require('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('Vite dev middleware fallback to static public:', e.message);
      app.use(express.static(path.join(__dirname, 'public')));
      app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
      });
    }
  } else {
    // Production Mode
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log('=======================================================');
    console.log('🚀 GUJRAKSHA CCTV PLATFORM');
    console.log(`📡 Single Unified Server running on http://localhost:${PORT}`);
    console.log('🗺️  GIS Control Center & React Platform Active');
    console.log('=======================================================');
  });
}

startServer();
