import express from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';

const router = express.Router();

// 1. WHEP WebRTC SDP Proxy Endpoint (Supports POST / GET / OPTIONS / PATCH / DELETE)
router.all(['/proxy-whep', '/whep-proxy'], (req, res) => {
  const targetUrl = req.query.url;
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

// 2. Generic HTTP / MJPEG / HLS Media Stream Proxy
router.get(['/proxy-stream', '/'], (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing target stream URL.');
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

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

export default router;
