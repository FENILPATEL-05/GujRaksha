#!/usr/bin/env node
/**
 * GujRaksha (ગુજ રક્ષા) — Dedicated PostgreSQL Database Initializer & Migration Tool
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Runs schema.sql and migrates all cameras, departments, watchlist, and detections
 * into PostgreSQL with validation.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  initialDepartments,
  initialCameras,
  initialWatchlist,
  initialDetections
} from '../src/db/seeds.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');

// Load environment variables
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || 5432, 10),
  database: process.env.DB_NAME || 'sentinel_cctv_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
};

async function main() {
  console.log('======================================================================');
  console.log(' 🐘 GUJRAKSHA POSTGRESQL & POSTGIS DATABASE SETUP TOOL');
  console.log('======================================================================');
  console.log(`Connecting to: postgres://${config.user}:****@${config.host}:${config.port}/${config.database}`);

  const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : config);

  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL Server successfully!');

    // 1. Execute schema.sql
    const schemaPath = path.join(PROJECT_ROOT, 'src/db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('⚡ Executing schema.sql DDL migrations...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('✅ Schema tables (departments, cameras, watchlist, anpr_detections) created!');
    }

    // 2. Migrate Departments
    for (const d of initialDepartments) {
      await client.query(
        `INSERT INTO departments (code, name, category, nodal_officer, contact_email, contact_phone, status, icon, color, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          nodal_officer = EXCLUDED.nodal_officer,
          status = EXCLUDED.status`,
        [d.code, d.name, d.category, d.nodal_officer, d.contact_email, d.contact_phone, d.status, d.icon, d.color, d.description]
      );
    }
    console.log(`📦 Synced ${initialDepartments.length} departments into PostgreSQL.`);

    // 3. Migrate Cameras
    for (const c of initialCameras) {
      await client.query(
        `INSERT INTO cameras (
          id, camera_code, name, department_id, department_name, district, taluka,
          latitude, longitude, address, ownership_type, camera_type, detection_mode,
          vms_vendor, stream_url, rtsp_url, whep_url, hls_url, codec, retention_days,
          status, installation_date, stream_properties, urls
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        ON CONFLICT (id) DO UPDATE SET
          camera_code = EXCLUDED.camera_code,
          name = EXCLUDED.name,
          detection_mode = CASE 
            WHEN EXCLUDED.detection_mode = 'GENERAL_SURVEILLANCE' AND cameras.detection_mode IS NOT NULL AND cameras.detection_mode != '' THEN cameras.detection_mode 
            ELSE EXCLUDED.detection_mode 
          END,
          status = EXCLUDED.status`,
        [
          c.id, c.camera_code, c.name, c.department_id, c.department_name, c.district, c.taluka || '',
          parseFloat(c.latitude) || 23.0, parseFloat(c.longitude) || 72.5, c.address || '', c.ownership_type || 'GOVERNMENT',
          c.camera_type || 'PTZ', c.detection_mode || 'TRAFFIC_MONITORING', c.vms_vendor || 'Live Sentinel Feeder',
          c.stream_url || '', c.rtsp_url || '', c.whep_url || '', c.hls_url || '', c.codec || 'H.264',
          parseInt(c.retention_days || 15, 10), c.status || 'ACTIVE', c.installation_date || '2026-08-25',
          JSON.stringify(c.stream_properties || {}), JSON.stringify(c.urls || {})
        ]
      );
    }
    console.log(`📦 Synced ${initialCameras.length} cameras into PostgreSQL.`);

    // 4. Migrate Watchlist
    for (const w of initialWatchlist) {
      await client.query(
        `INSERT INTO watchlist (id, vehicle_plate, vehicle_type, category, fir_number, police_station, owner_name, priority, status, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (vehicle_plate) DO UPDATE SET
          category = EXCLUDED.category,
          priority = EXCLUDED.priority,
          status = EXCLUDED.status`,
        [w.id, w.vehicle_plate, w.vehicle_type, w.category, w.fir_number, w.police_station, w.owner_name, w.priority, w.status, w.description, w.created_at || new Date().toISOString()]
      );
    }
    console.log(`📦 Synced ${initialWatchlist.length} watchlist records into PostgreSQL.`);

    // 5. Migrate Detections
    for (const d of initialDetections) {
      await client.query(
        `INSERT INTO anpr_detections (id, vehicle_plate, confidence, camera_id, camera_code, camera_name, district, location_lat, location_lng, speed_kmh, vehicle_type, is_watchlist_hit, watchlist_category, watchlist_fir, raw_payload, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO NOTHING`,
        [
          d.id, d.vehicle_plate, parseInt(d.confidence || 95, 10), d.camera_id || '', d.camera_code || '',
          d.camera_name || '', d.district || '', parseFloat(d.location_lat) || 23.0, parseFloat(d.location_lng) || 72.5,
          parseInt(d.speed_kmh || 45, 10), d.vehicle_type || 'Car', !!d.is_watchlist_hit, d.watchlist_category || '',
          d.watchlist_fir || '', JSON.stringify(d), d.timestamp || new Date().toISOString()
        ]
      );
    }
    console.log(`📦 Synced ${initialDetections.length} ANPR detection logs into PostgreSQL.`);

    // 6. Query counts
    const countCams = await client.query('SELECT COUNT(*) FROM cameras');
    const countDepts = await client.query('SELECT COUNT(*) FROM departments');
    const countWL = await client.query('SELECT COUNT(*) FROM watchlist');
    const countDet = await client.query('SELECT COUNT(*) FROM anpr_detections');

    console.log('======================================================================');
    console.log(`🎉 PostgreSQL Database Ready! Total Cameras: ${countCams.rows[0].count} | Departments: ${countDepts.rows[0].count} | Watchlist: ${countWL.rows[0].count} | Detections: ${countDet.rows[0].count}`);
    console.log('======================================================================');

    client.release();
    await pool.end();
  } catch (err) {
    console.error('\n❌ PostgreSQL Connection / Migration Error:', err.message);
    console.log('\n👉 Tips to resolve:');
    console.log('   1. Ensure PostgreSQL is started: sudo service postgresql start');
    console.log('   2. Ensure database exists: sudo -u postgres psql -c "CREATE DATABASE sentinel_cctv_db;"');
    console.log('   3. Check credentials in .env (DB_USER, DB_PASSWORD, DB_PORT)\n');
    process.exit(1);
  }
}

main();
