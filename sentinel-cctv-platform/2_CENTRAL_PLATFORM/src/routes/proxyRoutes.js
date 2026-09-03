import express from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';

const router = express.Router();

// 1. WHEP WebRTC SDP Proxy Endpoint (Supports POST / GET / OPTIONS / PATCH / DELETE)
router.all(['/proxy-whep', '/whep-proxy', '/whep/*'], (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl && req.path.startsWith('/whep/')) {
    const streamPath = req.path.replace(/^\/whep\//, '');
    const mediamtxHost = process.env.MEDIAMTX_HOST || '127.0.0.1';
    targetUrl = `http://${mediamtxHost}:8889/${streamPath}`;
  }
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target WHEP URL.' });
  }

  // Handle CORS Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Location');
  res.setHeader('Access-Control-Expose-Headers', 'Location, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const requestHeaders = {
      'Content-Type': req.headers['content-type'] || 'application/sdp',
      'Accept': req.headers['accept'] || 'application/sdp'
    };

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: requestHeaders
    };

    const proxyReq = client.request(options, (proxyRes) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/sdp');
      if (proxyRes.headers['location']) {
        res.setHeader('Location', proxyRes.headers['location']);
      }
      res.status(proxyRes.statusCode);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('WHEP Proxy Error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to connect to WHEP server', details: err.message });
      }
    });

    // Write body if present
    if (req.body) {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        proxyReq.write(req.body);
      } else if (typeof req.body === 'object') {
        proxyReq.write(JSON.stringify(req.body));
      }
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
  } catch (err) {
    console.error('WHEP Proxy Exception:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'WHEP Proxy Exception', details: err.message });
    }
  }
});

import { spawn } from 'child_process';

// 2. Generic HTTP / RTSP / MJPEG / HLS Media Stream Proxy
router.get(['/proxy-stream', '/mjpeg-feed'], (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing target stream URL.');
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  // If RTSP Stream (including H.265 / HEVC physical cameras):
  if (targetUrl.startsWith('rtsp://')) {
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--ffmpegframe',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'close',
      'Pragma': 'no-cache'
    });

    const ffmpeg = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-i', targetUrl,
      '-f', 'mpjpeg',
      '-boundary_tag', 'ffmpegframe',
      '-q:v', '4',
      '-r', '20',
      '-an',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    ffmpeg.stdout.pipe(res);

    req.on('close', () => {
      try { ffmpeg.kill('SIGKILL'); } catch (e) {}
    });

    ffmpeg.on('error', (err) => {
      console.error('FFmpeg RTSP Stream Proxy Error:', err.message);
      if (!res.headersSent) res.status(500).send('Stream error');
    });
    return;
  }

  try {
    const client = targetUrl.startsWith('https') ? https : http;
    const reqProxy = client.get(targetUrl, (streamRes) => {
      res.writeHead(streamRes.statusCode, streamRes.headers);
      streamRes.pipe(res);
    });

    reqProxy.on('error', (err) => {
      console.error('Proxy Stream Error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to proxy target stream', details: err.message });
      }
    });
  } catch (err) {
    console.error('Proxy Exception:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy Exception', details: err.message });
    }
  }
});

// 3. AI Stream Video Feed & Telemetry Proxy (Matching Sentinel CCTV Registry Core Engine)
router.get('/ai/video_feed', (req, res) => {

  res.setHeader('Access-Control-Allow-Origin', '*');
  const aiServiceHost = process.env.AI_STREAM_HOST || '127.0.0.1';
  const aiServicePort = process.env.AI_STREAM_PORT || 8090;

  const queryString = new URLSearchParams(req.query).toString();
  const targetPath = `/api/v1/ai/video_feed?${queryString}`;

  const proxyReq = http.request({
    hostname: aiServiceHost,
    port: aiServicePort,
    path: targetPath,
    method: 'GET'
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.warn('AI Stream Service Offline, falling back to RTSP FFmpeg proxy:', err.message);
    const source = req.query.source;
    if (source) {
      return res.redirect(`/api/v1/proxy-stream?url=${encodeURIComponent(source)}`);
    }
    if (!res.headersSent) {
      res.status(502).json({ error: 'AI Video Stream Service Offline', details: err.message });
    }
  });

  req.on('close', () => {
    proxyReq.destroy();
  });

  proxyReq.end();
});

router.post('/ai/stream_controls', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const aiServiceHost = process.env.AI_STREAM_HOST || '127.0.0.1';
  const aiServicePort = process.env.AI_STREAM_PORT || 8090;

  const payload = JSON.stringify(req.body || {});
  const proxyReq = http.request({
    hostname: aiServiceHost,
    port: aiServicePort,
    path: '/api/v1/ai/stream_controls',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.json({ success: false, error: err.message });
  });

  proxyReq.write(payload);
  proxyReq.end();
});

router.post('/ai/scan_frame', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const aiServiceHost = process.env.AI_STREAM_HOST || '127.0.0.1';
  const aiServicePort = process.env.AI_STREAM_PORT || 8090;

  const payload = JSON.stringify(req.body || {});
  const proxyReq = http.request({
    hostname: aiServiceHost,
    port: aiServicePort,
    path: '/api/v1/ai/scan_frame',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(200).json({
        success: false,
        objects: [],
        plates: [],
        error: `AI Stream Service (Port 8090) Offline: ${err.message}`
      });
    }
  });

  proxyReq.write(payload);
  proxyReq.end();
});

router.get('/ai/stats', (req, res) => {

  res.setHeader('Access-Control-Allow-Origin', '*');
  const aiServiceHost = process.env.AI_STREAM_HOST || '127.0.0.1';
  const aiServicePort = process.env.AI_STREAM_PORT || 8090;

  const proxyReq = http.request({
    hostname: aiServiceHost,
    port: aiServicePort,
    path: '/api/v1/ai/stats',
    method: 'GET'
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    res.json({
      camera_id: 'local',
      is_active: false,
      backend_engine: 'OpenCV DNN (ONNX GPU/CPU)',
      current_frame_counts: {},
      active_dwell_alerts: [],
      intrusion_alerts: [],
      infer_time_ms: 0.0
    });
  });

  proxyReq.end();
});

export default router;

