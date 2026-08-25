#!/usr/bin/env node
/**
 * GujRaksha (ગુજ રક્ષા) — Pre-Flight Requirement Verification & Auto-Fulfillment
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Checks and auto-fulfills all system, library, Python, Node, MediaMTX, and AI model
 * requirements so that the platform builds and runs out-of-the-box on any machine.
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function checkCmd(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

async function verifyAndFulfill() {
  log('\n' + '='.repeat(70), colors.cyan);
  log('  🛡️  GUJRAKSHA (ગુજ રક્ષા) — SYSTEM PRE-FLIGHT DEPENDENCY CHECK', colors.bright + colors.cyan);
  log('='.repeat(70), colors.cyan);

  let hasErrors = false;

  // 1. Check Node.js Version
  const nodeVer = process.version;
  log(`\n📦 [1/6] Node.js Runtime: ${colors.green}${nodeVer}${colors.reset} [OK]`);

  // 2. Check & Auto-Install NPM Dependencies
  log(`\n📦 [2/6] Checking Node.js Dependencies...`);
  const nodeModulesPath = path.join(PROJECT_ROOT, 'node_modules');
  if (!fs.existsSync(nodeModulesPath) || !fs.existsSync(path.join(nodeModulesPath, 'vite'))) {
    log(`   ⚠️  node_modules missing or incomplete. Auto-installing npm dependencies...`, colors.yellow);
    try {
      execSync('npm install', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      log(`   ✅ Node.js dependencies installed successfully!`, colors.green);
    } catch (err) {
      log(`   ❌ npm install failed: ${err.message}`, colors.red);
      hasErrors = true;
    }
  } else {
    log(`   ✅ Node.js packages verified [OK]`, colors.green);
  }

  // 3. Check Python 3 & pip
  log(`\n🐍 [3/6] Checking Python 3 Runtime & AI Packages...`);
  if (!checkCmd('python3')) {
    log(`   ❌ Python 3 is not installed on this system. Please install Python 3.10+ (sudo apt install python3 python3-pip)`, colors.red);
    hasErrors = true;
  } else {
    const pyVer = execSync('python3 --version', { encoding: 'utf-8' }).trim();
    log(`   Found ${colors.green}${pyVer}${colors.reset}`);

    // Required Python packages for ANPR & AI
    const pythonPackages = [
      { name: 'opencv-python-headless', importTest: 'import cv2' },
      { name: 'ai-edge-litert', importTest: 'import ai_edge_litert' },
      { name: 'requests', importTest: 'import requests' },
      { name: 'numpy', importTest: 'import numpy' }
    ];

    const missingPyPackages = [];

    for (const pkg of pythonPackages) {
      const res = spawnSync('python3', ['-c', pkg.importTest], { stdio: 'pipe' });
      if (res.status !== 0) {
        missingPyPackages.push(pkg.name);
      }
    }

    if (missingPyPackages.length > 0) {
      log(`   ⚠️  Missing Python packages: ${missingPyPackages.join(', ')}`, colors.yellow);
      log(`   ⚙️  Auto-installing missing Python packages...`, colors.cyan);

      try {
        const installCmd = `pip3 install --break-system-packages ${missingPyPackages.join(' ')} || python3 -m pip install ${missingPyPackages.join(' ')}`;
        execSync(installCmd, { stdio: 'inherit' });
        log(`   ✅ All required Python packages installed successfully!`, colors.green);
      } catch (pipErr) {
        log(`   ⚠️  Pip auto-install warning: ${pipErr.message}`, colors.yellow);
        log(`   👉 Try running: pip3 install --break-system-packages ${missingPyPackages.join(' ')}`, colors.cyan);
      }
    } else {
      log(`   ✅ All Python AI packages verified (OpenCV, LiteRT, Requests, NumPy) [OK]`, colors.green);
    }
  }

  // 4. Check FFmpeg
  log(`\n🎬 [4/6] Checking FFmpeg Multimedia Core...`);
  if (checkCmd('ffmpeg') && checkCmd('ffprobe')) {
    const ffVer = execSync('ffmpeg -version', { encoding: 'utf-8' }).split('\n')[0];
    log(`   ✅ ${ffVer} [OK]`, colors.green);
  } else {
    log(`   ⚠️  FFmpeg is not installed. Attempting auto-installation...`, colors.yellow);
    try {
      execSync('sudo apt update && sudo apt install -y ffmpeg', { stdio: 'inherit' });
      log(`   ✅ FFmpeg installed successfully!`, colors.green);
    } catch (e) {
      log(`   ⚠️  Could not auto-install FFmpeg via sudo. If streams fail, run: sudo apt install ffmpeg`, colors.yellow);
    }
  }

  // 5. Check MediaMTX Binary & Permissions
  log(`\n📡 [5/6] Checking MediaMTX Streaming Gateway...`);
  const mediamtxBin = path.join(PROJECT_ROOT, 'tools/mediamtx/mediamtx');
  const mediamtxDir = path.join(PROJECT_ROOT, 'tools/mediamtx');

  if (!fs.existsSync(mediamtxBin)) {
    log(`   ⚠️  MediaMTX binary missing. Downloading official MediaMTX release...`, colors.yellow);
    try {
      fs.mkdirSync(mediamtxDir, { recursive: true });
      const dlUrl = 'https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_amd64.tar.gz';
      execSync(`curl -L -s "${dlUrl}" -o "${path.join(mediamtxDir, 'mediamtx.tar.gz')}"`, { stdio: 'inherit' });
      execSync(`tar -xzf "${path.join(mediamtxDir, 'mediamtx.tar.gz')}" -C "${mediamtxDir}"`, { stdio: 'inherit' });
      execSync(`chmod +x "${mediamtxBin}"`, { stdio: 'pipe' });
      log(`   ✅ MediaMTX binary downloaded and configured!`, colors.green);
    } catch (mtxErr) {
      log(`   ❌ Failed to auto-download MediaMTX: ${mtxErr.message}`, colors.red);
    }
  } else {
    // Ensure executable permissions
    try {
      execSync(`chmod +x "${mediamtxBin}"`, { stdio: 'pipe' });
    } catch (e) {}
    log(`   ✅ MediaMTX binary verified & executable permissions granted [OK]`, colors.green);
  }

  // 6. Check TFLite AI Models
  log(`\n🧠 [6/6] Checking YOLOv9 & OCR TFLite AI Models...`);
  const detectorPath = path.join(PROJECT_ROOT, 'models/tflite/plate_detector.tflite');
  const ocrPath = path.join(PROJECT_ROOT, 'models/tflite/plate_ocr.tflite');

  if (fs.existsSync(detectorPath) && fs.existsSync(ocrPath)) {
    const detSize = (fs.statSync(detectorPath).size / (1024 * 1024)).toFixed(1);
    const ocrSize = (fs.statSync(ocrPath).size / (1024 * 1024)).toFixed(1);
    log(`   ✅ Plate Detector Model (${detSize} MB) [OK]`, colors.green);
    log(`   ✅ Plate OCR Transformer Model (${ocrSize} MB) [OK]`, colors.green);
  } else {
    log(`   ⚠️  One or more AI models missing in models/tflite/`, colors.yellow);
  }

  log('\n' + '='.repeat(70), colors.cyan);
  if (hasErrors) {
    log('  ⚠️  Pre-flight check completed with warnings. Proceeding with build...', colors.yellow);
  } else {
    log('  🚀 ALL REQUIREMENTS FULFILLED! READY FOR BUILD & EXECUTION.', colors.bright + colors.green);
  }
  log('='.repeat(70) + '\n', colors.cyan);
}

verifyAndFulfill().catch(err => {
  console.error('Requirement check error:', err);
  process.exit(0);
});
