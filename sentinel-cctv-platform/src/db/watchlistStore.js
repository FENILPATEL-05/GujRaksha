import pgClient from "./pgClient.js";
import { initialWatchlist } from "./seeds.js";

class WatchlistDataStore {
  constructor() {
    this.watchlist = [...initialWatchlist];
    this.init();
  }

  async init() {
    try {
      if (pgClient.isConnected()) {
        const res = await pgClient.query("SELECT * FROM watchlist ORDER BY created_at DESC");
        if (res && res.rows && res.rows.length > 0) {
          this.watchlist = res.rows;
        }
      }
    } catch (err) {
      console.error("Error loading watchlist store from database:", err.message);
    }
  }

  getAll(filters = {}) {
    let result = [...this.watchlist];

    if (filters.category && filters.category !== "ALL") {
      result = result.filter(w => w.category === filters.category);
    }

    if (filters.priority && filters.priority !== "ALL") {
      result = result.filter(w => w.priority === filters.priority);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().replace(/[^a-z0-9]/g, "");
      result = result.filter(w => {
        const plateNorm = (w.vehicle_plate || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const firNorm = (w.fir_number || "").toLowerCase();
        const descNorm = (w.description || "").toLowerCase();
        return plateNorm.includes(q) || firNorm.includes(filters.search.toLowerCase()) || descNorm.includes(filters.search.toLowerCase());
      });
    }

    return result;
  }

  getByPlate(plateNumber) {
    if (!plateNumber) return null;
    const cleanSearch = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return this.watchlist.find(w => {
      const cleanPlate = (w.vehicle_plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return cleanPlate === cleanSearch;
    });
  }

  create(record) {
    if (!record.vehicle_plate) {
      const err = new Error("Vehicle Plate Number is mandatory.");
      err.statusCode = 400;
      throw err;
    }

    const cleanPlate = record.vehicle_plate.toUpperCase().trim();
    const existing = this.getByPlate(cleanPlate);
    if (existing) {
      const err = new Error(`Vehicle plate '${cleanPlate}' is already in the watchlist (${existing.fir_number}).`);
      err.statusCode = 409;
      throw err;
    }

    const newRecord = {
      id: record.id || `wl-${Date.now()}`,
      vehicle_plate: cleanPlate,
      vehicle_type: record.vehicle_type || "Vehicle",
      category: record.category || "STOLEN_VEHICLE",
      fir_number: record.fir_number || `FIR #${Math.floor(100 + Math.random() * 900)}/2026`,
      police_station: record.police_station || "State Police Surveillance Cell",
      owner_name: record.owner_name || "Under Investigation",
      priority: record.priority || "HIGH",
      status: record.status || "ACTIVE",
      description: record.description || "Flagged in statewide CCTV police watchlist.",
      created_at: new Date().toISOString()
    };

    this.watchlist.unshift(newRecord);

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      pgClient.query(
        `INSERT INTO watchlist (id, vehicle_plate, vehicle_type, category, fir_number, police_station, owner_name, priority, status, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (vehicle_plate) DO UPDATE SET
          category = EXCLUDED.category,
          priority = EXCLUDED.priority,
          status = EXCLUDED.status,
          description = EXCLUDED.description`,
        [newRecord.id, newRecord.vehicle_plate, newRecord.vehicle_type, newRecord.category, newRecord.fir_number, newRecord.police_station, newRecord.owner_name, newRecord.priority, newRecord.status, newRecord.description, newRecord.created_at]
      ).catch(err => console.warn("PG Watchlist Insert Error:", err.message));
    }

    return newRecord;
  }

  delete(id) {
    const idx = this.watchlist.findIndex(w => w.id === id || w.vehicle_plate.toUpperCase() === id.toUpperCase());
    if (idx === -1) {
      const err = new Error(`Watchlist record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const removed = this.watchlist.splice(idx, 1);

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      pgClient.query("DELETE FROM watchlist WHERE id = $1 OR vehicle_plate = $1", [id])
        .catch(err => console.warn("PG Watchlist Delete Error:", err.message));
    }

    return removed[0];
  }
}

export default new WatchlistDataStore();
