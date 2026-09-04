import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import watchlistStore from "./watchlistStore.js";
import db from "./pool.js";
import pgClient from "./pgClient.js";
import { initialDetections } from "./seeds.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const ANPR_FILE = path.join(DATA_DIR, "anpr_detections.json");

class AnprDataStore {
  constructor() {
    this.detections = this.loadFromFile();
    this.alertSubscribers = [];
    this.liveCameraDetections = new Map();
    this.activeVisionCameraCode = "GJ-GOV-001";
  }

  setActiveVisionCamera(camCode) {
    if (camCode) {
      this.activeVisionCameraCode = String(camCode);
    }
  }

  getActiveVisionCamera() {
    return this.activeVisionCameraCode || "GJ-GOV-001";
  }

  updateLiveDetections(payload) {
    if (!payload || !payload.camera_code) return;
    const camCode = payload.camera_code;
    this.liveCameraDetections.set(camCode, {
      camera_code: camCode,
      camera_id: payload.camera_id,
      timestamp: payload.timestamp || new Date().toISOString(),
      detections: payload.detections || [],
      counts: payload.counts || {
        total: (payload.detections || []).length,
        vehicles: (payload.detections || []).filter(d => ['CAR', 'TRUCK', 'BUS', 'MOTORCYCLE', 'BICYCLE'].includes(String(d.label).toUpperCase())).length,
        persons: (payload.detections || []).filter(d => String(d.label).toUpperCase() === 'PERSON').length,
        plates: (payload.detections || []).filter(d => d.type === 'PLATE' || String(d.label).includes('PLATE')).length
      }
    });
  }

  getLiveDetections(cameraCode) {
    if (!cameraCode) return null;
    return this.liveCameraDetections.get(cameraCode) || null;
  }

  onCameraDeleted(cameraIdOrCode) {
    if (!cameraIdOrCode) return;
    const str = String(cameraIdOrCode).toUpperCase().trim();
    const toDelete = [];
    for (const [key, val] of this.liveCameraDetections.entries()) {
      const keyUpper = String(key).toUpperCase().trim();
      const idUpper = String(val?.camera_id || '').toUpperCase().trim();
      const codeUpper = String(val?.camera_code || '').toUpperCase().trim();
      if (keyUpper === str || idUpper === str || codeUpper === str || keyUpper.includes(str) || (str.length > 3 && str.includes(keyUpper))) {
        toDelete.push(key);
      }
    }
    toDelete.forEach(k => this.liveCameraDetections.delete(k));
  }

  onCamerasDeleted(ids = []) {
    if (!Array.isArray(ids)) return;
    ids.forEach(id => this.onCameraDeleted(id));
  }

  loadFromFile() {
    try {
      if (fs.existsSync(ANPR_FILE)) {
        const raw = fs.readFileSync(ANPR_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("⚠️ [AnprStore] Could not read anpr_detections.json fallback:", e.message);
    }
    this.saveToFile([...initialDetections]);
    return [...initialDetections];
  }

  saveToFile(data = this.detections) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(ANPR_FILE, JSON.stringify(data.slice(0, 500), null, 2), "utf8");
    } catch (e) {
      console.warn("⚠️ [AnprStore] Could not write anpr_detections.json:", e.message);
    }
  }

  async loadFromDatabase() {
    try {
      if (pgClient.isConnected()) {
        const res = await pgClient.query("SELECT * FROM anpr_detections ORDER BY timestamp DESC LIMIT 500");
        if (res && res.rows) {
          this.detections = res.rows.map(r => ({
            ...r,
            latitude: r.location_lat,
            longitude: r.location_lng,
            is_read: !!r.is_read,
            is_dismissed: !!r.is_dismissed
          }));
          this.saveToFile(this.detections);
        }
      }
    } catch (err) {
      console.error("Error loading ANPR detections store from database:", err.message);
    }
  }

  async init() {
    await this.loadFromDatabase();
  }

  // Subscribe to real-time Server-Sent Events (SSE)
  subscribeAlerts(res) {
    this.alertSubscribers.push(res);
    res.on("close", () => {
      this.alertSubscribers = this.alertSubscribers.filter(client => client !== res);
    });
  }

  // Broadcast real incident to all connected browser dashboards
  broadcastAlert(incident) {
    this.alertSubscribers.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(incident)}\n\n`);
      } catch (err) {
        console.error("Error sending SSE alert:", err.message);
      }
    });
  }

  // Ingest & Cache Real-Time Live Camera Detections (Object & Plate Bounding Boxes)
  updateLiveDetections(payload) {
    if (!payload || (!payload.camera_code && !payload.camera_id)) return null;
    const cameraCode = payload.camera_code || payload.camera_id;
    const items = Array.isArray(payload.detections) ? payload.detections : [];
    
    // Calculate category breakdown
    const counts = {
      total: items.length,
      vehicles: items.filter(d => ['CAR', 'TRUCK', 'BUS', 'MOTORCYCLE', 'BICYCLE', 'VEHICLE'].includes(String(d.label).toUpperCase())).length,
      persons: items.filter(d => String(d.label).toUpperCase() === 'PERSON').length,
      plates: items.filter(d => d.type === 'PLATE' || d.plate || String(d.label).toUpperCase().includes('PLATE')).length
    };

    const record = {
      camera_code: cameraCode,
      camera_id: payload.camera_id || cameraCode,
      timestamp: payload.timestamp || new Date().toISOString(),
      updated_at: Date.now(),
      frame_width: payload.frame_width || 1920,
      frame_height: payload.frame_height || 1080,
      detections: items,
      counts: counts
    };

    this.liveCameraDetections.set(cameraCode, record);
    if (payload.camera_id && payload.camera_id !== cameraCode) {
      this.liveCameraDetections.set(payload.camera_id, record);
    }

    // Broadcast live detections to SSE subscribers
    this.broadcastAlert({
      type: "STREAM_AI_DETECTIONS",
      ...record
    });

    return record;
  }

  getLiveDetections(cameraCode) {
    if (!cameraCode) return { camera_code: "", detections: [], counts: { total: 0, vehicles: 0, persons: 0, plates: 0 } };
    const clean = String(cameraCode).trim();
    const data = this.liveCameraDetections.get(clean) || this.liveCameraDetections.get(`gov-feed-${clean}`) || this.liveCameraDetections.get(clean.replace('gov-feed-', ''));
    if (!data) return { camera_code: cameraCode, detections: [], counts: { total: 0, vehicles: 0, persons: 0, plates: 0 } };
    
    // Check if stale (> 8 seconds)
    if (Date.now() - data.updated_at > 8000) {
      return { ...data, stale: true };
    }
    return data;
  }

  getAllLiveDetections() {
    const list = [];
    const now = Date.now();
    const seen = new Set();
    for (const [code, data] of this.liveCameraDetections.entries()) {
      if (!seen.has(data.camera_code) && now - data.updated_at <= 8000) {
        seen.add(data.camera_code);
        list.push(data);
      }
    }
    return list;
  }

  async getAll(filters = {}) {
    // 1. If PostgreSQL is connected, execute high-performance indexed SQL query
    if (pgClient.isConnected()) {
      try {
        let query = "SELECT * FROM anpr_detections WHERE 1=1";
        const params = [];

        if (filters.is_watchlist === "true") {
          query += " AND is_watchlist_hit = TRUE";
        }

        if (filters.district && filters.district !== "ALL") {
          params.push(filters.district);
          query += ` AND LOWER(district) = LOWER($${params.length})`;
        }

        if (filters.search && filters.search.trim()) {
          const s = `%${filters.search.trim()}%`;
          params.push(s);
          const pIdx = params.length;
          query += ` AND (vehicle_plate ILIKE $${pIdx} OR camera_name ILIKE $${pIdx} OR camera_code ILIKE $${pIdx} OR district ILIKE $${pIdx})`;
          query += " ORDER BY timestamp DESC LIMIT 2000";
        } else {
          // Default view: latest 500 records
          query += " ORDER BY timestamp DESC LIMIT 500";
        }

        const res = await pgClient.query(query, params);
        if (res && res.rows) {
          return res.rows.map(r => ({
            ...r,
            latitude: r.location_lat,
            longitude: r.location_lng,
            is_read: !!r.is_read,
            is_dismissed: !!r.is_dismissed
          }));
        }
      } catch (err) {
        console.warn("⚠️ [AnprStore] Error executing PostgreSQL getAll query:", err.message);
      }
    }

    // 2. In-Memory / Fallback Search
    let result = [...this.detections];

    if (filters.is_watchlist === "true") {
      result = result.filter(d => d.is_watchlist_hit);
    }

    if (filters.district && filters.district !== "ALL") {
      result = result.filter(d => (d.district || "").toLowerCase() === filters.district.toLowerCase());
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().replace(/[^a-z0-9]/g, "");
      result = result.filter(d => {
        const pNorm = (d.vehicle_plate || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const cNorm = (d.camera_name || "").toLowerCase();
        const distNorm = (d.district || "").toLowerCase();
        return pNorm.includes(q) || cNorm.includes(filters.search.toLowerCase()) || distNorm.includes(filters.search.toLowerCase());
      });
    } else {
      result = result.slice(0, 500);
    }

    return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // Returns active real-world alerts for the Radar Panel & Map
  getActiveAlerts() {
    const hits = this.detections.filter(d => d.is_watchlist_hit && !d.is_dismissed);
    return hits.map(d => ({
      id: `alert-${d.id}`,
      detectionId: d.id,
      type: "ANPR_HOTLIST",
      title: `Watchlist Match — ${d.watchlist_category ? d.watchlist_category.replace("_", " ") : "FLAGGED VEHICLE"}`,
      vehicleNo: d.vehicle_plate,
      vehicle_type: d.vehicle_type,
      vehicle_color: d.vehicle_color,
      description: `${d.vehicle_plate} (${d.vehicle_type || 'Vehicle'}) · Matched Police Database (${d.watchlist_fir || "Active Watchlist"}) at ${d.speed_kmh || 45} km/h`,
      severity: d.watchlist_category === "STOLEN_VEHICLE" ? "CRITICAL" : "HIGH",
      cameraId: d.camera_id,
      cameraCode: d.camera_code,
      cameraName: d.camera_name,
      district: d.district || "Gujarat",
      latitude: d.latitude || d.location_lat,
      longitude: d.longitude || d.location_lng,
      createdAt: new Date(d.timestamp).getTime(),
      timestamp: d.timestamp,
      is_read: !!d.is_read,
      is_dismissed: !!d.is_dismissed
    }));
  }

  async dismissAlert(alertId) {
    if (!alertId) return false;
    const cleanId = String(alertId).replace(/^alert-/, '');
    
    let updatedCount = 0;
    this.detections.forEach(d => {
      if (String(d.id) === cleanId || String(d.id) === alertId) {
        d.is_dismissed = true;
        d.is_read = true;
        d.dismissed_at = new Date().toISOString();
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      this.saveToFile(this.detections);
      
      try {
        if (pgClient.isConnected()) {
          await pgClient.query(
            "UPDATE anpr_detections SET is_read = TRUE, is_dismissed = TRUE, dismissed_at = CURRENT_TIMESTAMP WHERE id = $1",
            [cleanId]
          );
        }
      } catch (err) {
        console.warn("⚠️ [AnprStore] Error updating PostgreSQL alert dismissal:", err.message);
      }
      return true;
    }
    return false;
  }

  async dismissAllAlerts() {
    let updatedCount = 0;
    this.detections.forEach(d => {
      if (d.is_watchlist_hit && !d.is_dismissed) {
        d.is_dismissed = true;
        d.is_read = true;
        d.dismissed_at = new Date().toISOString();
        updatedCount++;
      }
    });

    this.saveToFile(this.detections);

    try {
      if (pgClient.isConnected()) {
        await pgClient.query(
          "UPDATE anpr_detections SET is_read = TRUE, is_dismissed = TRUE, dismissed_at = CURRENT_TIMESTAMP WHERE is_watchlist_hit = TRUE AND (is_dismissed = FALSE OR is_dismissed IS NULL)"
        );
      }
    } catch (err) {
      console.warn("⚠️ [AnprStore] Error updating PostgreSQL dismiss-all:", err.message);
    }
    return updatedCount;
  }

  async clearAllDetections() {
    this.detections = [];
    this.saveToFile([]);
    try {
      if (pgClient.isConnected()) {
        await pgClient.query("DELETE FROM anpr_detections");
      }
    } catch (err) {
      console.warn("⚠️ [AnprStore] Error clearing PostgreSQL detections:", err.message);
    }
    return true;
  }

  async deleteDetection(id) {
    if (!id) return false;
    const cleanId = String(id).replace(/^alert-/, '');
    const initialLen = this.detections.length;
    this.detections = this.detections.filter(d => String(d.id) !== cleanId && String(d.id) !== id);
    if (this.detections.length !== initialLen) {
      this.saveToFile(this.detections);
      try {
        if (pgClient.isConnected()) {
          await pgClient.query("DELETE FROM anpr_detections WHERE id = $1", [cleanId]);
        }
      } catch (err) {
        console.warn("⚠️ [AnprStore] Error deleting PostgreSQL detection:", err.message);
      }
      return true;
    }
    return false;
  }

  getTrajectoryForPlate(plateNumber) {
    if (!plateNumber) return { vehicle_plate: "", detections: [], waypoints: [] };
    const cleanSearch = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");

    const matched = this.detections.filter(d => {
      const cleanPlate = (d.vehicle_plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return cleanPlate.includes(cleanSearch) || cleanSearch.includes(cleanPlate);
    });

    matched.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const waypoints = matched.map((d, index) => {
      // Dynamic camera coordinate re-binding from pool/database
      let cam = null;
      const searchKey = String(d.camera_id || d.camera_code || "").trim();
      if (searchKey) {
        cam = db.getById(searchKey) || db.getByCameraCode(searchKey) || db.getById(d.camera_code) || db.getByCameraCode(d.camera_code);
        if (!cam) {
          const digits = searchKey.replace(/\D/g, "");
          if (digits) {
            const padded = 'cam' + digits.padStart(2, '0');
            const govPadded = 'GJ-GOV-CAM' + digits.padStart(2, '0');
            cam = db.getById(padded) || db.getByCameraCode(govPadded) || db.getById(`cam${digits}`) || db.getById(`gov-feed-${digits}`) || db.getByCameraCode(`GJ-GOV-${digits.padStart(3, '0')}`);
          }
        }
      }

      const lat = (cam && typeof cam.latitude === "number" && !isNaN(cam.latitude)) 
        ? cam.latitude 
        : (parseFloat(d.latitude) || parseFloat(d.location_lat) || 23.0225);
      const lng = (cam && typeof cam.longitude === "number" && !isNaN(cam.longitude)) 
        ? cam.longitude 
        : (parseFloat(d.longitude) || parseFloat(d.location_lng) || 72.5714);

      return {
        sequence: index + 1,
        id: d.id,
        camera_id: cam ? cam.id : (d.camera_id || "cam01"),
        camera_code: cam ? cam.camera_code : (d.camera_code || "GJ-GOV-CAM01"),
        camera_name: cam ? cam.name : (d.camera_name || "State CCTV Node"),
        district: cam ? cam.district : (d.district || "Ahmedabad"),
        latitude: lat,
        longitude: lng,
        speed_kmh: d.speed_kmh || 45,
        confidence: d.confidence || 95,
        timestamp: d.timestamp,
        is_watchlist_hit: d.is_watchlist_hit
      };
    });

    return {
      vehicle_plate: plateNumber.toUpperCase(),
      total_spotted: matched.length,
      first_seen: matched.length > 0 ? matched[0].timestamp : null,
      last_seen: matched.length > 0 ? matched[matched.length - 1].timestamp : null,
      waypoints: waypoints
    };
  }

  async ingest(payload) {
    if (!payload.vehicle_plate) {
      const err = new Error("vehicle_plate is required in detection payload.");
      err.statusCode = 400;
      throw err;
    }

    const cleanPlate = payload.vehicle_plate.toUpperCase().trim();
    
    // Check against real Watchlist Database
    const watchlistHit = watchlistStore.getByPlate(cleanPlate);

    let camMeta = null;
    const searchId = String(payload.camera_id || payload.camera_code || "").trim();
    if (searchId) {
      camMeta = db.getById(searchId) || db.getByCameraCode(searchId) || db.getById(payload.camera_code) || db.getByCameraCode(payload.camera_code);
      if (!camMeta) {
        const digits = searchId.replace(/\D/g, "");
        if (digits) {
          const padded = 'cam' + digits.padStart(2, '0');
          const govPadded = 'GJ-GOV-CAM' + digits.padStart(2, '0');
          camMeta = db.getById(padded) || db.getByCameraCode(govPadded) || db.getById(`cam${digits}`) || db.getById(`gov-feed-${digits}`) || db.getByCameraCode(`GJ-GOV-${digits.padStart(3, '0')}`);
        }
      }
    }

    const newDetection = {
      id: payload.id || `det-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      vehicle_plate: cleanPlate,
      vehicle_type: payload.vehicle_type || (watchlistHit ? watchlistHit.vehicle_type : "Motor Vehicle"),
      vehicle_color: payload.vehicle_color || "Standard",
      snapshot_url: payload.snapshot_url || null,
      camera_id: camMeta ? camMeta.id : (payload.camera_id || "cam01"),
      camera_code: camMeta ? camMeta.camera_code : (payload.camera_code || "GJ-GOV-CAM01"),
      camera_name: camMeta ? camMeta.name : (payload.camera_name || "State CCTV Node"),
      district: camMeta ? camMeta.district : (payload.district || "Ahmedabad"),
      latitude: camMeta ? camMeta.latitude : (payload.latitude !== undefined ? parseFloat(payload.latitude) : 23.0225),
      longitude: camMeta ? camMeta.longitude : (payload.longitude !== undefined ? parseFloat(payload.longitude) : 72.5714),
      speed_kmh: payload.speed_kmh ? parseInt(payload.speed_kmh, 10) : Math.floor(40 + Math.random() * 45),
      confidence: payload.confidence ? parseFloat(payload.confidence) : parseFloat((95 + Math.random() * 4.8).toFixed(1)),
      is_watchlist_hit: !!watchlistHit,
      watchlist_category: watchlistHit ? watchlistHit.category : null,
      watchlist_fir: watchlistHit ? watchlistHit.fir_number : null,
      watchlist_ps: watchlistHit ? watchlistHit.police_station : null,
      watchlist_priority: watchlistHit ? watchlistHit.priority : null,
      timestamp: (payload.timestamp ? String(payload.timestamp).replace(/Z$/, '') : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T')),
      stored: true,
      is_read: false,
      is_dismissed: false,
      dismissed_at: null
    };

    // Save detection in in-memory list & JSON file
    this.detections.unshift(newDetection);
    if (this.detections.length > 500) {
      this.detections = this.detections.slice(0, 500);
    }
    this.saveToFile();

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      try {
        await pgClient.query(
          `INSERT INTO anpr_detections (
            id, vehicle_plate, confidence, camera_id, camera_code, camera_name,
            district, location_lat, location_lng, speed_kmh, vehicle_type,
            is_watchlist_hit, watchlist_category, watchlist_fir, raw_payload, timestamp,
            is_read, is_dismissed
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, FALSE, FALSE)
          ON CONFLICT (id) DO NOTHING`,
          [
            newDetection.id, newDetection.vehicle_plate, parseInt(newDetection.confidence, 10) || 95,
            newDetection.camera_id, newDetection.camera_code, newDetection.camera_name, newDetection.district,
            newDetection.latitude, newDetection.longitude, newDetection.speed_kmh, newDetection.vehicle_type,
            newDetection.is_watchlist_hit, newDetection.watchlist_category, newDetection.watchlist_fir, JSON.stringify(newDetection),
            newDetection.timestamp
          ]
        );
      } catch (err) {
        console.warn("PG ANPR Detection Insert Error:", err.message);
      }
    }

    if (watchlistHit) {
      // Print High-Visibility Alert in Terminal
      console.log(`\n\x1b[41m\x1b[1m\x1b[37m 🚨 [ANPR ALERT] POLICE WATCHLIST TARGET DETECTED! \x1b[0m`);
      console.log(`\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
      console.log(`   🚘 \x1b[1mVehicle Plate  :\x1b[0m \x1b[33m\x1b[1m${newDetection.vehicle_plate}\x1b[0m`);
      console.log(`   🚨 \x1b[1mThreat Category:\x1b[0m \x1b[31m\x1b[1m${newDetection.watchlist_category || "SUSPECT_HOTLIST"}\x1b[0m (\x1b[35m${newDetection.watchlist_priority || "CRITICAL"}\x1b[0m)`);
      console.log(`   📋 \x1b[1mFIR Reference  :\x1b[0m \x1b[36m${newDetection.watchlist_fir || "Active FIR"}\x1b[0m (\x1b[37m${newDetection.watchlist_ps || "State Police"}\x1b[0m)`);
      console.log(`   🎥 \x1b[1mCamera Node    :\x1b[0m \x1b[32m[${newDetection.camera_code}]\x1b[0m ${newDetection.camera_name}`);
      console.log(`   📍 \x1b[1mLocation / GPS :\x1b[0m ${newDetection.district} (${newDetection.latitude.toFixed(4)}, ${newDetection.longitude.toFixed(4)})`);
      console.log(`   ⚡ \x1b[1mTelemetry      :\x1b[0m Speed: \x1b[33m${newDetection.speed_kmh} km/h\x1b[0m | AI Confidence: \x1b[32m${newDetection.confidence}%\x1b[0m`);
      console.log(`   🕒 \x1b[1mTimestamp      :\x1b[0m ${newDetection.timestamp}`);
      console.log(`\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n`);
    } else {
      console.log(`\x1b[36m[ANPR SCAN]\x1b[0m 🚗 Plate: \x1b[1m\x1b[37m${cleanPlate}\x1b[0m | Camera: \x1b[33m${newDetection.camera_code}\x1b[0m | Snapshot: \x1b[32m${newDetection.snapshot_url || 'Saved'}\x1b[0m`);
    }

    // Broadcast real-time live detection event to Web UI dashboard & Incident Radar
    const alertObject = {
      id: `alert-${newDetection.id}`,
      type: newDetection.is_watchlist_hit ? "ANPR_HOTLIST" : "ANPR_DETECTION",
      title: newDetection.is_watchlist_hit
        ? `🚨 WATCHLIST ALERT: ${newDetection.watchlist_category ? newDetection.watchlist_category.replace("_", " ") : "SUSPECT DETECTED"}`
        : `🚗 Plate Scanned: ${newDetection.vehicle_plate}`,
      vehicleNo: newDetection.vehicle_plate,
      vehicle_plate: newDetection.vehicle_plate,
      snapshot_url: newDetection.snapshot_url,
      description: `${newDetection.vehicle_plate} (${newDetection.vehicle_type}) · Camera ${newDetection.camera_code} at ${newDetection.speed_kmh} km/h`,
      severity: newDetection.is_watchlist_hit ? (newDetection.watchlist_category === "STOLEN_VEHICLE" ? "CRITICAL" : "HIGH") : "INFO",
      is_watchlist_hit: !!newDetection.is_watchlist_hit,
      cameraId: newDetection.camera_id,
      cameraCode: newDetection.camera_code,
      cameraName: newDetection.camera_name,
      district: newDetection.district,
      latitude: newDetection.latitude,
      longitude: newDetection.longitude,
      createdAt: Date.now(),
      timestamp: newDetection.timestamp,
      isNew: true
    };
    this.broadcastAlert(alertObject);

    return newDetection;

  }

  async ingestBatch(payloads = []) {
    if (!Array.isArray(payloads) || payloads.length === 0) {
      return { success: true, count: 0, results: [] };
    }
    const results = [];
    for (const p of payloads) {
      results.push(await this.ingest(p));
    }
    return {
      success: true,
      count: results.length,
      results
    };
  }
}

export default new AnprDataStore();

