/**
 * GujRaksha (ગુજ રક્ષા) — ANPR Engine Integration Service
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Manages native C++ ANPR detection worker processes and watchlist hotlist syncing.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import anprStore from '../db/anprStore.js';
import watchlistStore from '../db/watchlistStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CPP_BINARY = path.join(__dirname, '../../cpp/sentinel_anpr_engine');

class AnprEngineService {
  constructor() {
    this.activeWorker = null;
    this.status = 'STOPPED';
  }

  getBinaryPath() {
    return CPP_BINARY;
  }

  isBinaryAvailable() {
    return fs.existsSync(CPP_BINARY);
  }

  // Scan / test single plate via native C++ engine
  async scanPlate(plateNumber, cameraId = 'GJ-GOV-001') {
    if (!this.isBinaryAvailable()) {
      return anprStore.ingest({
        vehicle_plate: plateNumber,
        camera_code: cameraId
      });
    }

    return new Promise((resolve, reject) => {
      const child = spawn(CPP_BINARY, ['--plate', plateNumber, '--camera-code', cameraId]);
      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdoutData += text;
        process.stdout.write(`\x1b[90m[C++ ANPR]\x1b[0m ${text}`);
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderrData += text;
        process.stderr.write(`\x1b[31m[C++ ANPR ERR]\x1b[0m ${text}`);
      });

      child.on('close', (code) => {
        const isHit = stdoutData.includes('MATCH DETECTED') || watchlistStore.getByPlate(plateNumber);
        const result = anprStore.ingest({
          vehicle_plate: plateNumber,
          camera_code: cameraId
        });
        resolve({
          success: true,
          code,
          isWatchlistHit: !!isHit,
          output: stdoutData,
          detection: result
        });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  // Run test suite
  async runTestSuite() {
    if (!this.isBinaryAvailable()) {
      return { success: false, message: 'C++ ANPR binary not compiled yet.' };
    }

    return new Promise((resolve, reject) => {
      const child = spawn(CPP_BINARY, ['--test-mode']);
      let output = '';

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(`\x1b[90m[C++ ANPR]\x1b[0m ${text}`);
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output
        });
      });

      child.on('error', reject);
    });
  }

  // Run inference across ALL camera feeds on the platform
  async runInferenceOnAllCameras() {
    if (!this.isBinaryAvailable()) {
      const watchlistPlates = ['GJ01AB1234', 'GJ05CD5678', 'GJ01HG9999', 'GJ18KL9012'];
      const results = watchlistPlates.map((plate, index) => 
        anprStore.ingest({
          vehicle_plate: plate,
          camera_code: `GJ-GOV-00${index + 1}`
        })
      );
      return {
        success: true,
        mode: 'fallback-in-memory',
        hitsCount: results.filter(r => r.is_watchlist_hit).length,
        results
      };
    }

    return new Promise((resolve, reject) => {
      const child = spawn(CPP_BINARY, ['--all-cameras']);
      let output = '';

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        output += text;
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          binary: CPP_BINARY,
          output
        });
      });

      child.on('error', reject);
    });
  }
}

export default new AnprEngineService();
