import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Automatically route API calls through /gujraksha/api when hosted under /gujraksha/
if (typeof window !== 'undefined' && window.location.pathname.startsWith('/gujraksha')) {
  const originalFetch = window.fetch;
  window.fetch = function (url, options) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      url = '/gujraksha' + url;
    }
    return originalFetch.call(this, url, options);
  };

  const OriginalEventSource = window.EventSource;
  window.EventSource = function (url, options) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      url = '/gujraksha' + url;
    }
    return new OriginalEventSource(url, options);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

