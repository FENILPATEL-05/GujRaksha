/**
 * GujRaksha (ગુજ રક્ષા) — Central Server Wrapper
 * Delegates execution to 2_CENTRAL_PLATFORM/server.js
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const centralDir = path.join(__dirname, '2_CENTRAL_PLATFORM');

const child = spawn('node', ['server.js'], {
  cwd: centralDir,
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
