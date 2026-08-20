import express from 'express';
import http from 'http';
import https from 'https';

const router = express.Router();

router.get('/proxy-stream', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing target stream URL.');
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

export default router;
