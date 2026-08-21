/**
 * GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial GIS Control Platform
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 * Proprietary & Confidential — Unauthorized copying or distribution is strictly prohibited.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import cameraRoutes from './src/routes/cameraRoutes.js';
import onboardingRoutes from './src/routes/onboardingRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';
import proxyRoutes from './src/routes/proxyRoutes.js';
import departmentRoutes from './src/routes/departmentRoutes.js';
import watchlistRoutes from './src/routes/watchlistRoutes.js';
import anprRoutes from './src/routes/anprRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// REST API Routes
app.use('/api/v1/cameras', cameraRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/watchlist', watchlistRoutes);
app.use('/api/v1/anpr', anprRoutes);
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
      const { createServer: createViteServer } = await import('vite');
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
