import watchlistStore from "./watchlistStore.js";
import db from "./pool.js";
import pgClient from "./pgClient.js";
import { initialDetections } from "./seeds.js";

class AnprDataStore {
  constructor() {
    this.detections = [...initialDetections];
    this.alertSubscribers = [];
    this.init();
  }

  async init() {
    try {
      if (pgClient.isConnected()) {
        const res = await pgClient.query("SELECT * FROM anpr_detections ORDER BY timestamp DESC LIMIT 500");
        if (res && res.rows && res.rows.length > 0) {
          this.detections = res.rows.map(r => ({
            ...r,
            latitude: r.location_lat,
            longitude: r.location_lng
          }));
        }
      }
    } catch (err) {
      console.error("Error loading ANPR detections store from database:", err.message);
    }
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

  getAll(filters = {}) {
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
    }

    return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // Returns active real-world alerts for the Radar Panel & Map
  getActiveAlerts() {
    const hits = this.detections.filter(d => d.is_watchlist_hit);
    return hits.map(d => ({
      id: `alert-${d.id}`,
      type: "ANPR_HOTLIST",
      title: `Watchlist Match — ${d.watchlist_category ? d.watchlist_category.replace("_", " ") : "FLAGGED VEHICLE"}`,
      vehicleNo: d.vehicle_plate,
      description: `${d.vehicle_plate} (${d.vehicle_type}) · Matched Police Database (${d.watchlist_fir || "Active Watchlist"}) at ${d.speed_kmh} km/h`,
      severity: d.watchlist_category === "STOLEN_VEHICLE" ? "CRITICAL" : "HIGH",
      cameraId: d.camera_id,
      cameraCode: d.camera_code,
      cameraName: d.camera_name,
      district: d.district || "Gujarat",
      latitude: d.latitude || d.location_lat,
      longitude: d.longitude || d.location_lng,
      createdAt: new Date(d.timestamp).getTime(),
      timestamp: d.timestamp
    }));
  }

  getTrajectoryForPlate(plateNumber) {
    if (!plateNumber) return { vehicle_plate: "", detections: [], waypoints: [] };
    const cleanSearch = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");

    const matched = this.detections.filter(d => {
      const cleanPlate = (d.vehicle_plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return cleanPlate.includes(cleanSearch) || cleanSearch.includes(cleanPlate);
    });

    matched.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const waypoints = matched.map((d, index) => ({
      sequence: index + 1,
      id: d.id,
      camera_id: d.camera_id,
      camera_code: d.camera_code,
      camera_name: d.camera_name,
      district: d.district,
      latitude: d.latitude || d.location_lat,
      longitude: d.longitude || d.location_lng,
      speed_kmh: d.speed_kmh,
      confidence: d.confidence,
      timestamp: d.timestamp,
      is_watchlist_hit: d.is_watchlist_hit
    }));

    return {
      vehicle_plate: plateNumber.toUpperCase(),
      total_spotted: matched.length,
      first_seen: matched.length > 0 ? matched[0].timestamp : null,
      last_seen: matched.length > 0 ? matched[matched.length - 1].timestamp : null,
      waypoints: waypoints
    };
  }

  ingest(payload) {
    if (!payload.vehicle_plate) {
      const err = new Error("vehicle_plate is required in detection payload.");
      err.statusCode = 400;
      throw err;
    }

    const cleanPlate = payload.vehicle_plate.toUpperCase().trim();
    
    // Check against real Watchlist Database
    const watchlistHit = watchlistStore.getByPlate(cleanPlate);

    let camMeta = null;
    if (payload.camera_id || payload.camera_code) {
      camMeta = db.getById(payload.camera_id || payload.camera_code);
    }

    const newDetection = {
      id: payload.id || `det-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      vehicle_plate: cleanPlate,
      vehicle_type: payload.vehicle_type || (watchlistHit ? watchlistHit.vehicle_type : "Motor Vehicle"),
      vehicle_color: payload.vehicle_color || "Standard",
      camera_id: payload.camera_id || (camMeta ? camMeta.id : "gov-feed-1"),
      camera_code: payload.camera_code || (camMeta ? camMeta.camera_code : "GJ-GOV-001"),
      camera_name: payload.camera_name || (camMeta ? camMeta.name : "State CCTV Node"),
      district: payload.district || (camMeta ? camMeta.district : "Ahmedabad"),
      latitude: payload.latitude !== undefined ? parseFloat(payload.latitude) : (camMeta ? camMeta.latitude : 23.0225),
      longitude: payload.longitude !== undefined ? parseFloat(payload.longitude) : (camMeta ? camMeta.longitude : 72.5714),
      speed_kmh: payload.speed_kmh ? parseInt(payload.speed_kmh, 10) : Math.floor(40 + Math.random() * 45),
      confidence: payload.confidence ? parseFloat(payload.confidence) : parseFloat((95 + Math.random() * 4.8).toFixed(1)),
      is_watchlist_hit: !!watchlistHit,
      watchlist_category: watchlistHit ? watchlistHit.category : null,
      watchlist_fir: watchlistHit ? watchlistHit.fir_number : null,
      watchlist_ps: watchlistHit ? watchlistHit.police_station : null,
      watchlist_priority: watchlistHit ? watchlistHit.priority : null,
      timestamp: payload.timestamp || new Date().toISOString(),
      stored: true
    };

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

      // Keep in detections store
      this.detections.unshift(newDetection);
      if (this.detections.length > 500) {
        this.detections = this.detections.slice(0, 500);
      }

      // Direct Database Persistence (PostgreSQL)
      if (pgClient.isConnected()) {
        pgClient.query(
          `INSERT INTO anpr_detections (
            id, vehicle_plate, confidence, camera_id, camera_code, camera_name,
            district, location_lat, location_lng, speed_kmh, vehicle_type,
            is_watchlist_hit, watchlist_category, watchlist_fir, raw_payload, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING`,
          [
            newDetection.id, newDetection.vehicle_plate, parseInt(newDetection.confidence, 10) || 95,
            newDetection.camera_id, newDetection.camera_code, newDetection.camera_name, newDetection.district,
            newDetection.latitude, newDetection.longitude, newDetection.speed_kmh, newDetection.vehicle_type,
            true, newDetection.watchlist_category, newDetection.watchlist_fir, JSON.stringify(newDetection),
            newDetection.timestamp
          ]
        ).catch(err => console.warn("PG ANPR Detection Insert Error:", err.message));
      }

      // Broadcast ONLY watchlist hits to live SSE radar/alerts
      const alertObject = {
        id: `alert-${newDetection.id}`,
        type: "ANPR_HOTLIST",
        title: `🚨 WATCHLIST ALERT: ${newDetection.watchlist_category ? newDetection.watchlist_category.replace("_", " ") : "SUSPECT DETECTED"}`,
        vehicleNo: newDetection.vehicle_plate,
        vehicle_plate: newDetection.vehicle_plate,
        description: `${newDetection.vehicle_plate} (${newDetection.vehicle_type}) · Matched ${newDetection.watchlist_fir || "Police Watchlist"} at ${newDetection.speed_kmh} km/h`,
        severity: newDetection.watchlist_category === "STOLEN_VEHICLE" ? "CRITICAL" : "HIGH",
        is_watchlist_hit: true,
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
    } else {
      // Clean / non-watchlist vehicles are logged in console only (no popup alerts)
      console.log(`\x1b[36m[ANPR SCAN]\x1b[0m 🚗 Plate: \x1b[1m\x1b[37m${cleanPlate}\x1b[0m | Camera: \x1b[33m${newDetection.camera_code}\x1b[0m | Status: \x1b[32mPASS (Clean Vehicle - No Alert)\x1b[0m`);
      return {
        vehicle_plate: cleanPlate,
        is_watchlist_hit: false,
        stored: false,
        message: "Clean vehicle passed (Logged in console, no alert broadcasted)."
      };
    }
  }
}

export default new AnprDataStore();
