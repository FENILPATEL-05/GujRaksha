/**
 * GujRaksha (ગુજ રક્ષા) — Production PostgreSQL & PostGIS Connection Pool
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Manages PostgreSQL connection lifecycle, auto-migrations, spatial indexing,
 * and high-concurrency database queries.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import config from '../config/env.js';
import {
  initialDepartments,
  initialCameras,
  initialWatchlist,
  initialDetections
} from './seeds.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PostgresDatabase extends EventEmitter {
  constructor() {
    super();
    this.pool = null;
    this.connected = false;
    this.ready = false;
    this.initAttempted = false;
    this.init();
  }

  init() {
    try {
      const dbConfig = {
        host: process.env.DB_HOST || config.DB?.HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || config.DB?.PORT || 5432, 10),
        database: process.env.DB_NAME || config.DB?.NAME || 'sentinel_cctv_db',
        user: process.env.DB_USER || config.DB?.USER || 'postgres',
        password: process.env.DB_PASSWORD || config.DB?.PASSWORD || 'postgres',
        max: 25,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000
      };

      if (process.env.DATABASE_URL) {
        this.pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
      } else {
        this.pool = new Pool(dbConfig);
      }

      this.pool.on('error', (err) => {
        if (this.connected) {
          console.warn('⚠️ [PostgreSQL Pool Error]:', err.message);
        }
      });

      // Test connection & run initial migration asynchronously
      this.testAndMigrate();
    } catch (err) {
      console.warn('⚠️ [PostgreSQL Init Notice]:', err.message);
      this.connected = false;
      this.ready = true;
      this.emit('offline');
    }
  }

  async waitUntilReady(timeoutMs = 3000) {
    if (this.ready) return this.connected;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(this.connected);
      }, timeoutMs);

      const onDone = () => {
        clearTimeout(timer);
        resolve(this.connected);
      };

      this.once('ready', onDone);
      this.once('offline', onDone);
    });
  }

  async testAndMigrate() {
    if (!this.pool) {
      this.ready = true;
      this.emit('offline');
      return;
    }
    try {
      const client = await this.pool.connect();
      this.connected = true;
      console.log('✅ \x1b[32m[PostgreSQL Connected]\x1b[0m Database Active:', process.env.DB_NAME || config.DB?.NAME || 'sentinel_cctv_db');

      // Check if schema is already initialized
      try {
        const checkRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'system_metadata'
          ) as meta_exists,
          EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'cameras'
          ) as cams_exists;
        `);

        const isInitialized = checkRes.rows[0]?.meta_exists && checkRes.rows[0]?.cams_exists;

        if (!isInitialized) {
          // First-Time Database Setup (Run Schema & Seeder ONCE)
          const schemaPath = path.join(__dirname, 'schema.sql');
          if (fs.existsSync(schemaPath)) {
            const sql = fs.readFileSync(schemaPath, 'utf8');
            await client.query(sql);
            console.log('⚡ \x1b[36m[PostgreSQL Migrations]\x1b[0m Initial schema tables & spatial indexes created [OK]');
          }
          await this.autoSeedInitialData(client);
        }

        // Drop deprecated columns from departments table
        try {
          await client.query(`
            ALTER TABLE departments DROP COLUMN IF EXISTS status;
            ALTER TABLE departments DROP COLUMN IF EXISTS category;
            ALTER TABLE departments DROP COLUMN IF EXISTS description;
            ALTER TABLE departments DROP COLUMN IF EXISTS icon;
          `);
        } catch (migErr) {
          // Ignore if columns already removed or table not present
        }
      } catch (checkErr) {
        console.warn('⚠️ [PostgreSQL Check Notice]:', checkErr.message);
      }

      client.release();

      this.ready = true;
      this.emit('ready');
    } catch (err) {
      this.connected = false;
      this.ready = true;
      console.warn(`ℹ️  [PostgreSQL Mode] PostgreSQL connection on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432} is standby/offline (${err.code || err.message}).`);
      this.emit('offline');
    }
  }

  async autoSeedInitialData(client) {
    try {
      // Create metadata table to track seed state so user deletions are NEVER overwritten on restarts
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_metadata (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const seedCheck = await client.query("SELECT value FROM system_metadata WHERE key = 'initial_seed_completed'");
      const alreadySeeded = seedCheck.rows.length > 0 && seedCheck.rows[0].value === 'true';

      if (alreadySeeded) {
        // Platform has already performed initial setup in previous runs.
        // Respect all additions/deletions made by the user.
        return;
      }

      // Check Departments
      const deptRes = await client.query('SELECT COUNT(*) FROM departments');
      if (parseInt(deptRes.rows[0].count, 10) === 0) {
        for (const d of initialDepartments) {
          await client.query(
            `INSERT INTO departments (code, name, nodal_officer, contact_email, contact_phone, color)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (code) DO NOTHING`,
            [d.code, d.name, d.nodal_officer, d.contact_email, d.contact_phone, d.color]
          );
        }
        console.log(`📦 [PostgreSQL Seed] Inserted ${initialDepartments.length} departments into database.`);

      }

      // Check Cameras
      const camRes = await client.query('SELECT COUNT(*) FROM cameras');
      if (parseInt(camRes.rows[0].count, 10) === 0) {
        for (const c of initialCameras) {
          await client.query(
            `INSERT INTO cameras (
              id, camera_code, name, department_id, department_name, district, taluka,
              latitude, longitude, address, ownership_type, camera_type, detection_mode,
              vms_vendor, stream_url, rtsp_url, whep_url, hls_url, codec, retention_days,
              status, installation_date, stream_properties, urls
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
            ON CONFLICT (id) DO NOTHING`,
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
        console.log(`📦 [PostgreSQL Seed] Inserted ${initialCameras.length} cameras into database.`);
      }

      // Check Watchlist
      const wlRes = await client.query('SELECT COUNT(*) FROM watchlist');
      if (parseInt(wlRes.rows[0].count, 10) === 0) {
        for (const w of initialWatchlist) {
          await client.query(
            `INSERT INTO watchlist (id, vehicle_plate, vehicle_type, category, fir_number, police_station, owner_name, priority, status, description, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (vehicle_plate) DO NOTHING`,
            [w.id, w.vehicle_plate, w.vehicle_type, w.category, w.fir_number, w.police_station, w.owner_name, w.priority, w.status, w.description, w.created_at || new Date().toISOString()]
          );
        }
        console.log(`📦 [PostgreSQL Seed] Inserted ${initialWatchlist.length} watchlist records into database.`);
      }

      // Check ANPR Detections
      const anprRes = await client.query('SELECT COUNT(*) FROM anpr_detections');
      if (parseInt(anprRes.rows[0].count, 10) === 0) {
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
        console.log(`📦 [PostgreSQL Seed] Inserted ${initialDetections.length} ANPR detection logs into database.`);
      }

      // Mark initial seed as completed
      await client.query(`
        INSERT INTO system_metadata (key, value)
        VALUES ('initial_seed_completed', 'true')
        ON CONFLICT (key) DO UPDATE SET value = 'true'
      `);
    } catch (err) {
      console.warn('⚠️ [PostgreSQL Auto-Seed Notice]:', err.message);
    }
  }

  async query(text, params = []) {
    if (!this.connected || !this.pool) {
      return null;
    }
    try {
      return await this.pool.query(text, params);
    } catch (err) {
      console.error('❌ [PostgreSQL Query Error]:', err.message);
      throw err;
    }
  }

  isConnected() {
    return this.connected;
  }
}

export default new PostgresDatabase();
