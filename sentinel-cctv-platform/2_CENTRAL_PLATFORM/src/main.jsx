import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Automatically route API calls and streams when hosted under /gujraksha/ or HTTPS reverse proxies
if (typeof window !== 'undefined' && !window.__gujraksha_api_patched__) {
  window.__gujraksha_api_patched__ = true;
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = input;
    if (typeof input === 'string') {
      const isHttps = window.location.protocol === 'https:';
      const isSubpath = window.location.pathname.startsWith('/gujraksha');
      
      if (isSubpath && url.startsWith('/api/') && !url.startsWith('/gujraksha/api/')) {
        url = '/gujraksha' + url;
      } else if (isSubpath && url.startsWith('/whep') && !url.startsWith('/gujraksha/whep')) {
        url = '/gujraksha' + url;
      }
      
      if (isHttps && url.includes(':8889/')) {
        const apiPrefix = isSubpath ? '/gujraksha' : '';
        url = `${apiPrefix}/api/v1/proxy-whep?url=${encodeURIComponent(url)}`;
      }
    }
    return originalFetch.call(this, url, init);
  };

  const OriginalEventSource = window.EventSource;
  window.EventSource = function (url, options) {
    if (typeof url === 'string') {
      if (window.location.pathname.startsWith('/gujraksha') && url.startsWith('/api/') && !url.startsWith('/gujraksha/api/')) {
        url = '/gujraksha' + url;
      }
    }
    return new OriginalEventSource(url, options);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

