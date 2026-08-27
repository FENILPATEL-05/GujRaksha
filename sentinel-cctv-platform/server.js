/**
 * GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial GIS Control Platform
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 * Proprietary & Confidential — Unauthorized copying or distribution is strictly prohibited.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';


import cameraRoutes from './src/routes/cameraRoutes.js';
import cameraService from './src/services/cameraService.js';
import onboardingRoutes from './src/routes/onboardingRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';
import proxyRoutes from './src/routes/proxyRoutes.js';
import departmentRoutes from './src/routes/departmentRoutes.js';
import watchlistRoutes from './src/routes/watchlistRoutes.js';
import anprRoutes from './src/routes/anprRoutes.js';
import edgeRoutes from './src/routes/edgeRoutes.js';
import anprEngineService from './src/services/anprEngineService.js';
import streamAnprScanner from './src/services/streamAnprScanner.js';
import mediamtxService from './src/services/mediamtxService.js';
import pgClient from './src/db/pgClient.js';
import pool from './src/db/pool.js';
import departmentStore from './src/db/departmentStore.js';
import watchlistStore from './src/db/watchlistStore.js';
import compression from 'compression';
import anprStore from './src/db/anprStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// High-Performance HTTP Response Compression for Large JSON / GIS Datasets
app.use(compression({
  threshold: 1024, // compress responses larger than 1KB
  level: 6
}));

// Middleware
app.use(cors());
app.use(express.text({ type: ['text/*', 'application/sdp'], limit: '10mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount Routes Helper for both Root and /gujraksha Subpath
const mountApiEndpoints = (prefix = '') => {
  app.use(`${prefix}/api/v1/cameras`, cameraRoutes);
  app.use(`${prefix}/api/v1/departments`, departmentRoutes);
  app.use(`${prefix}/api/v1/watchlist`, watchlistRoutes);
  app.use(`${prefix}/api/v1/anpr`, anprRoutes);
  app.use(`${prefix}/api/v1/edge`, edgeRoutes);
  app.use(`${prefix}/api/v1/onboarding`, onboardingRoutes);
  app.use(`${prefix}/api/v1/analytics`, analyticsRoutes);
  app.use(`${prefix}/api/v1`, proxyRoutes);
  app.use(`${prefix}/api/v1/proxy-stream`, proxyRoutes);

  // Camera Ingest Catalogue API (Protocol Section 1)
  app.get(`${prefix}/api/ingest`, (req, res, next) => {
    try {
      const result = cameraService.getCameras({});
      const list = result.cameras || [];
      const host = req.hostname || 'localhost';
      res.json({
        success: true,
        total_cameras: list.length,
        cameras: list.map(c => {
          const cleanId = (c.id || '').replace('gov-feed-', '');
          return {
            id: c.id,
            camera_code: c.camera_code,
            name: c.name,
            district: c.district,
            codec: c.codec || 'H.264',
            status: c.status || 'ACTIVE',
            camera_type: c.camera_type || 'PTZ',
            detection_mode: c.detection_mode || 'TRAFFIC_MONITORING',
            location: {
              latitude: c.latitude,
              longitude: c.longitude,
              district: c.district,
              address: c.address || ''
            },
            stream_properties: c.stream_properties || {
              resolution: '1920x1080',
              fps: 30,
              codec: c.codec || 'H.264'
            },
            urls: c.urls || {
              rtsp: `rtsp://${host}:8554/stream/${cleanId}`,
              whep: `http://${host}:8889/stream/${cleanId}/whep`,
              hls: `http://${host}/live/stream/${cleanId}/index.m3u8`
            },
            rtsp_url: c.rtsp_url || `rtsp://${host}:8554/stream/${cleanId}`,
            whep_url: c.whep_url || `http://${host}:8889/stream/${cleanId}/whep`,
            hls_url: c.hls_url || `http://${host}/live/stream/${cleanId}/index.m3u8`,
            stream_url: c.stream_url || `rtsp://${host}:8554/stream/${cleanId}`
          };
        })
      });
    } catch (err) {
      next(err);
    }
  });

  // Health Check API
  app.get(`${prefix}/api/health`, (req, res) => {
    res.json({
      status: 'UP',
      platform: 'GujRaksha CCTV Control Center',
      timestamp: new Date().toISOString()
    });
  });
};

mountApiEndpoints('');
mountApiEndpoints('/gujraksha');



async function startServer() {
  await pgClient.waitUntilReady();
  await pool.loadFromDatabase();
  await departmentStore.loadFromDatabase();
  await watchlistStore.loadFromDatabase();
  await anprStore.loadFromDatabase();
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
    const staticDir = fs.existsSync(path.join(__dirname, 'dist')) ? path.join(__dirname, 'dist') : path.join(__dirname, 'public');
    app.use('/gujraksha', express.static(staticDir));
    app.use(express.static(staticDir));
    app.get(['/gujraksha', '/gujraksha/*', '*'], (req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }


  app.listen(PORT, () => {
    console.log('=======================================================');
    console.log('🚀 GUJRAKSHA CCTV PLATFORM');
    console.log(`📡 Single Unified Server running on http://localhost:${PORT}`);
    console.log('🗺️  GIS Control Center & React Platform Active');
    console.log('⚡ Native ANPR Engine Active & Standing By for Camera Feeds');
    console.log('🎥 Real-Time Video Stream ANPR Scanner Initialized');
    console.log('=======================================================');

    // Auto-connect Real-Time Video Stream ANPR Scanner & Launch Parallel TFLite AI Engine
    setTimeout(async () => {
      try {
        await mediamtxService.startServerProcess();
        const cams = cameraService.getCameras({}).cameras || [];
        await mediamtxService.syncAllCameras(cams);
        await streamAnprScanner.init();
        // Automatically start high-speed Python TFLite ANPR Engine across all cameras in parallel
        anprEngineService.runPythonTFLiteScanner('--all-cameras');
      } catch (err) {
        // Silent catch for stream scanner startup
      }
    }, 1500);
  });
}

startServer();
