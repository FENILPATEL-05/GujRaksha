import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/gujraksha/',
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['workspace.nxon.io', 'localhost', '127.0.0.1', '.nxon.io', 'true'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/gujraksha/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['workspace.nxon.io', 'localhost', '127.0.0.1', '.nxon.io', 'true']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});

