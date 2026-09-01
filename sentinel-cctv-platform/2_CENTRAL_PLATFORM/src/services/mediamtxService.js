/**
 * GujRaksha (ગુજ રક્ષા) — MediaMTX Dynamic Stream Synchronization Service
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Dynamically provisions raw RTSP camera feeds into MediaMTX Control API (Port 9997)
 * so that web browsers can instantly play WHEP WebRTC without manual YAML editing.
 */

import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const MEDIAMTX_BIN = path.join(PROJECT_ROOT, 'tools/mediamtx/mediamtx');
const MEDIAMTX_CFG = path.join(PROJECT_ROOT, 'tools/mediamtx/mediamtx.yml');

class MediaMtxService {
  constructor() {
    this.apiUrl = 'http://localhost:9997/v3/config/paths';
    this.process = null;
  }

  // Ensure MediaMTX server process is running
  async startServerProcess() {
    // Check if already running on port 9997
    try {
      await this.makeRequest('/list', 'GET');
      console.log('🎥 [MediaMTX Gateway] MediaMTX is active on port 8554 (RTSP) & 8889 (WebRTC)');
      return;
    } catch (e) {
      // Not running, spawn binary
    }

    if (!fs.existsSync(MEDIAMTX_BIN)) {
      console.warn('⚠️ [MediaMTX Gateway] Binary not found at:', MEDIAMTX_BIN);
      return;
    }

    try {
      this.process = spawn(MEDIAMTX_BIN, [MEDIAMTX_CFG], {
        cwd: PROJECT_ROOT,
        stdio: 'ignore',
        detached: true
      });
      this.process.unref();
      console.log('🚀 [MediaMTX Gateway] Successfully launched MediaMTX WebRTC/RTSP Gateway Process!');
      // Wait for port binding
      await new Promise(r => setTimeout(r, 1200));
    } catch (err) {
      console.error('❌ [MediaMTX Gateway] Failed to launch MediaMTX process:', err.message);
    }
  }

  // Register or update dynamic RTSP camera source in MediaMTX
  async registerCameraStream(camera) {
    if (!camera) return;
    const cleanId = String(camera.id || '1').replace('gov-feed-', '');
    const pathName = `stream/${cleanId}`;
    const rawRtsp = camera.rtsp_url || (camera.urls && camera.urls.rtsp) || camera.stream_url;

    if (!rawRtsp || !rawRtsp.startsWith('rtsp://')) return;

    // If stream already targets local MediaMTX, no external pull needed
    if (rawRtsp.includes(':8554/stream/')) return;

    let payloadObj = {
      source: rawRtsp,
      sourceOnDemand: true,
      rtspTransport: 'tcp'
    };

    // If local/office physical camera (often in H.265/HEVC which Chrome can't decode over WebRTC),
    // MediaMTX automatically launches ultra-fast zero-latency H.264 transcoding on demand!
    const isLocalOrPhysical = rawRtsp.includes('192.168.') || rawRtsp.includes('10.') || rawRtsp.includes('172.') || rawRtsp.includes('admin:');
    if (isLocalOrPhysical) {
      payloadObj = {
        source: 'publisher',
        runOnDemand: `ffmpeg -rtsp_transport tcp -i "${rawRtsp}" -c:v libx264 -preset ultrafast -tune zerolatency -b:v 2500k -maxrate 3000k -bufsize 1000k -an -f rtsp -rtsp_transport tcp rtsp://localhost:8554/${pathName}`,
        runOnDemandRestart: true,
        runOnDemandCloseAfter: '10s'
      };
    }

    const payload = JSON.stringify(payloadObj);

    try {
      // 1. Try adding path
      await this.makeRequest(`/add/${pathName}`, 'POST', payload);
      console.log(`📡 [MediaMTX Gateway] Auto-provisioned WebRTC bridge for ${camera.camera_code || pathName} -> ${rawRtsp}`);
    } catch (err) {
      // 2. If already exists, patch path
      try {
        await this.makeRequest(`/patch/${pathName}`, 'POST', payload);
        console.log(`📡 [MediaMTX Gateway] Updated WebRTC bridge for ${camera.camera_code || pathName} -> ${rawRtsp}`);
      } catch (patchErr) {
        // MediaMTX might not be running yet; will retry on demand
      }
    }
  }

  // Sync all cameras in registry with MediaMTX on platform startup
  async syncAllCameras(cameras = []) {
    for (const cam of cameras) {
      try {
        await this.registerCameraStream(cam);
      } catch (e) {}
    }
  }

  makeRequest(endpoint, method, data) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 9997,
        path: `/v3/config/paths${endpoint}`,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data || '')
        },
        timeout: 2000
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`MediaMTX API error ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('MediaMTX API timeout'));
      });

      if (data) req.write(data);
      req.end();
    });
  }
}

export default new MediaMtxService();
