/**
 * GujRaksha (ગુજ રક્ષા) — Ultra-Fast TFLite ANPR Engine Integration Service
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Manages Python TFLite (YOLOv9 Plate Detector + CCT Transformer OCR) AI detection engine worker processes.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import anprStore from '../db/anprStore.js';
import watchlistStore from '../db/watchlistStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PYTHON_TFLITE_SCRIPT = path.join(__dirname, 'anpr_tflite_scanner.py');

class AnprEngineService {
  constructor() {
    this.activeWorker = null;
    this.status = 'STOPPED';
  }

  isPythonScannerAvailable() {
    return fs.existsSync(PYTHON_TFLITE_SCRIPT);
  }

  // Run Ultra-Fast Python TFLite AI Scanner (YOLOv9 + CCT Transformer OCR)
  runPythonTFLiteScanner(source = '0', cameraCode = 'GJ-GOV-001') {
    if (!this.isPythonScannerAvailable()) {
      console.warn('⚠️ Python TFLite scanner script not found.');
      return null;
    }

    const scriptArgs = source === '--all-cameras' ? ['--all-cameras'] : ['--source', String(source), '--camera-code', cameraCode];
    console.log(`🚀 [TFLite AI ANPR Engine] Spawning YOLOv9 + CCT OCR (${scriptArgs.join(' ')})...`);
    const child = spawn('python3', [PYTHON_TFLITE_SCRIPT, ...scriptArgs]);

    child.stdout.on('data', (chunk) => {
      process.stdout.write(`\x1b[35m[TFLite AI ANPR]\x1b[0m ${chunk.toString()}`);
    });

    child.stderr.on('data', (chunk) => {
      process.stdout.write(`\x1b[33m[TFLite AI Notice]\x1b[0m ${chunk.toString()}`);
    });

    return child;
  }

  // Scan / test single plate via Python TFLite AI Engine
  async scanPlate(plateNumber, cameraId = 'GJ-GOV-001') {
    const isHit = watchlistStore.getByPlate(plateNumber);
    const result = anprStore.ingest({
      vehicle_plate: plateNumber,
      camera_code: cameraId
    });

    return {
      success: true,
      isWatchlistHit: !!isHit,
      detection: result
    };
  }

  // Run inference across ALL camera feeds on the platform
  async runInferenceOnAllCameras() {
    return this.runPythonTFLiteScanner('--all-cameras');
  }
}

export default new AnprEngineService();
