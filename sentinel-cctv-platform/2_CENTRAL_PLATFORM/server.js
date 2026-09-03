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
import workerRoutes from './src/routes/workerRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import pgClient from './src/db/pgClient.js';
import pool from './src/db/pool.js';
import departmentStore from './src/db/departmentStore.js';
import watchlistStore from './src/db/watchlistStore.js';
import http from 'http';
import compression from 'compression';
import anprStore from './src/db/anprStore.js';
import visionWsServer from './src/services/wsVisionServer.js';

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
  app.use(`${prefix}/api/v1/workers`, workerRoutes);
  app.use(`${prefix}/api/v1/edge`, edgeRoutes);
  app.use(`${prefix}/api/v1/onboarding`, onboardingRoutes);
  app.use(`${prefix}/api/v1/analytics`, analyticsRoutes);
  app.use(`${prefix}/api/v1/auth`, authRoutes);
  app.use(`${prefix}/api/v1`, proxyRoutes);
  app.use(`${prefix}/api/v1/proxy-stream`, proxyRoutes);

  // Camera Ingest Catalogue API (Protocol Section 1)
  app.get(`${prefix}/api/ingest`, (req, res, next) => {
    try {
      const result = cameraService.getCameras({});
      const list = result.cameras || [];
      const hostHeader = req.headers.host ? req.headers.host.split(':')[0] : '';
      const host = (hostHeader && hostHeader !== 'localhost' && hostHeader !== '127.0.0.1') ? hostHeader : (req.hostname || 'localhost');
      
      const fixHost = (str) => {
        if (!str || typeof str !== 'string') return str;
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return str.split('localhost').join(host).split('127.0.0.1').join(host);
        }
        return str;
      };

      res.json({
        success: true,
        total_cameras: list.length,
        cameras: list.map(c => {
          const cleanId = (c.id || '').replace('gov-feed-', '');
          const rtsp = fixHost(c.rtsp_url || (c.urls && c.urls.rtsp) || c.stream_url) || `rtsp://${host}:8554/stream/${cleanId}`;
          const whep = fixHost(c.whep_url || (c.urls && c.urls.whep)) || `http://${host}:8889/stream/${cleanId}/whep`;
          const hls = fixHost(c.hls_url || (c.urls && c.urls.hls)) || `http://${host}:8888/stream/${cleanId}/index.m3u8`;

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
            urls: {
              rtsp: rtsp,
              whep: whep,
              hls: hls
            },
            rtsp_url: rtsp,
            whep_url: whep,
            hls_url: hls,
            stream_url: rtsp
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


  const server = http.createServer(app);
  visionWsServer.init(server);

  server.listen(PORT, () => {
    console.log('=======================================================');
    console.log('🏢 GUJRAKSHA CENTRAL COMMAND & CONTROL PLATFORM');
    console.log(`💻 Central Dashboard running on http://localhost:${PORT}`);
    console.log('🗺️  GIS Control Center, Video Wall & Database Active');
    console.log('⚡ Real-Time WebSocket AI Vision Streaming on ws://localhost:' + PORT + '/ws/ai-vision');
    console.log('📡 Distributed AI Ingestion API Active & Standing By');
    console.log('=======================================================');
  });
}

startServer();
