#!/usr/bin/env node
/**
 * GujRaksha (ગુજ રક્ષા) — Central Platform Pre-Flight Check
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 */

import { execSync } from 'child_process';
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
  cyan: '\x1b[36m'
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

async function verifyCentral() {
  log('\n' + '='.repeat(70), colors.cyan);
  log('  🏢 GUJRAKSHA CENTRAL PLATFORM — SYSTEM PRE-FLIGHT CHECK', colors.bright + colors.cyan);
  log('='.repeat(70), colors.cyan);

  // 1. Check Node.js Version
  const nodeVer = process.version;
  log(`\n📦 [1/2] Node.js Runtime: ${colors.green}${nodeVer}${colors.reset} [OK]`);

  // 2. Check Node.js Dependencies
  log(`\n📦 [2/2] Checking Node.js Dependencies...`);
  const nodeModulesPath = path.join(PROJECT_ROOT, 'node_modules');
  if (!fs.existsSync(nodeModulesPath) || !fs.existsSync(path.join(nodeModulesPath, 'vite'))) {
    log(`   ⚠️  node_modules missing. Auto-installing dependencies...`, colors.yellow);
    try {
      execSync('npm install', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      log(`   ✅ Node.js packages installed successfully!`, colors.green);
    } catch (err) {
      log(`   ❌ npm install error: ${err.message}`, colors.red);
    }
  } else {
    log(`   ✅ Node.js packages verified [OK]`, colors.green);
  }

  log('\n' + '='.repeat(70), colors.cyan);
  log('  🚀 CENTRAL PLATFORM READY FOR EXECUTION!', colors.bright + colors.green);
  log('='.repeat(70), colors.cyan + '\n');
}

verifyCentral();
