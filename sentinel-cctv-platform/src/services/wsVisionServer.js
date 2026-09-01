/**
 * GujRaksha (ગુજ રક્ષા) — Real-Time WebSocket AI Vision Gateway
 * Low-latency bidirectional WebSocket engine for live bounding boxes streaming.
 */

import { WebSocketServer, WebSocket } from 'ws';
import anprStore from '../db/anprStore.js';

class VisionWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> Set(cameraCodes)
  }

  init(httpServer) {
    this.wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request, socket, head) => {
      try {
        const urlObj = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
        const pathname = urlObj.pathname;
        if (pathname === '/ws/ai-vision' || pathname === '/gujraksha/ws/ai-vision' || pathname.endsWith('/ws/ai-vision')) {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit('connection', ws, request);
          });
        }
      } catch (err) {
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws, req) => {
      this.clients.set(ws, new Set());

      // Send initial active vision target
      try {
        ws.send(JSON.stringify({
          type: 'ACTIVE_VISION_TARGET',
          active_camera_code: anprStore.getActiveVisionCamera ? anprStore.getActiveVisionCamera() : 'GJ-GOV-001'
        }));
      } catch (_) {}

      ws.on('message', (message) => {
        try {
          const payload = JSON.parse(message.toString());

          if (payload.type === 'SUBSCRIBE' || payload.type === 'SET_ACTIVE_VISION_CAMERA') {
            const camCode = payload.camera_code || 'GJ-GOV-001';
            if (anprStore.setActiveVisionCamera) {
              anprStore.setActiveVisionCamera(camCode);
            }
            const subs = this.clients.get(ws) || new Set();
            subs.clear();
            subs.add(camCode);
            this.clients.set(ws, subs);

            // Broadcast active target to all connected worker clients
            const targetMsg = JSON.stringify({
              type: 'ACTIVE_VISION_TARGET',
              active_camera_code: camCode
            });
            for (const [client] of this.clients.entries()) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(targetMsg);
              }
            }

            // Send latest real cached frame immediately if available
            const latest = anprStore.getLiveDetections ? anprStore.getLiveDetections(camCode) : null;
            if (latest && latest.detections && latest.detections.length > 0) {
              ws.send(JSON.stringify({
                type: 'STREAM_AI_DETECTIONS',
                camera_code: camCode,
                detections: latest.detections,
                counts: latest.counts
              }));
            }
          } else if (payload.type === 'UNSUBSCRIBE') {
            const camCode = payload.camera_code;
            const subs = this.clients.get(ws);
            if (subs) subs.delete(camCode);
          } else if (payload.type === 'DETECTIONS_FRAME' || payload.type === 'AI_DETECTIONS') {
            // Python Worker sending real-time detection frame
            const camCode = payload.camera_code || 'GJ-GOV-001';

            // Cache in anprStore
            anprStore.updateLiveDetections(payload);

            // Backend Terminal Logging for Detected Objects
            if (payload.detections && payload.detections.length > 0) {
              const now = Date.now();
              if (!this.lastLogTimes) this.lastLogTimes = new Map();
              const lastTime = this.lastLogTimes.get(camCode) || 0;
              if (now - lastTime >= 1500) {
                this.lastLogTimes.set(camCode, now);
                const counts = {};
                for (const d of payload.detections) {
                  const lbl = (d.label || 'OBJECT').toUpperCase();
                  counts[lbl] = (counts[lbl] || 0) + 1;
                }
                const summary = Object.entries(counts).map(([k, v]) => `${v}x ${k}`).join(', ');
                const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
                console.log(`\x1b[35m[AI VISION WS]\x1b[0m 🎯 \x1b[33m[${camCode}]\x1b[0m Ingested Objects: \x1b[1m\x1b[37m${summary}\x1b[0m | Time: ${timeStr}`);
              }
            }

            // Broadcast to all subscribed WebSocket frontend clients
            const broadcastCamCode = payload.camera_code || payload.camera_id || 'GJ-GOV-001';
            const broadcastCamId = payload.camera_id || payload.camera_code || 'gov-feed-1';

            const broadcastMsg = JSON.stringify({
              type: 'STREAM_AI_DETECTIONS',
              camera_code: broadcastCamCode,
              camera_id: broadcastCamId,
              detections: payload.detections || [],
              counts: payload.counts || {
                total: (payload.detections || []).length,
                vehicles: (payload.detections || []).filter(d => ['CAR', 'TRUCK', 'BUS', 'MOTORCYCLE', 'BICYCLE'].includes(String(d.label).toUpperCase())).length,
                persons: (payload.detections || []).filter(d => String(d.label).toUpperCase() === 'PERSON').length,
                plates: (payload.detections || []).filter(d => d.type === 'PLATE' || String(d.label).includes('PLATE')).length
              }
            });

            const upperCamCode = String(broadcastCamCode).toUpperCase();
            const upperCamId = String(broadcastCamId).toUpperCase();

            for (const [client, subscriptions] of this.clients.entries()) {
              if (client.readyState === WebSocket.OPEN) {
                const isSubscribed = Array.from(subscriptions).some(sub => {
                  const s = String(sub).toUpperCase();
                  return s === upperCamCode || s === upperCamId || s === 'ALL' || upperCamCode.includes(s) || s.includes(upperCamCode);
                });
                if (isSubscribed) {
                  client.send(broadcastMsg);
                }
              }
            }
          }
        } catch (err) {}
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    console.log('⚡ [AI VISION WS] Real-Time WebSocket Server Active on /ws/ai-vision');
  }

  broadcastFrame(camCode, payload) {
    if (!this.wss) return;
    const msg = JSON.stringify({
      type: 'STREAM_AI_DETECTIONS',
      camera_code: camCode,
      ...payload
    });
    for (const [client, subscriptions] of this.clients.entries()) {
      if (client.readyState === WebSocket.OPEN && (subscriptions.has(camCode) || subscriptions.has('ALL'))) {
        client.send(msg);
      }
    }
  }
}

const visionWsServer = new VisionWebSocketServer();
export default visionWsServer;
