import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pgClient from "./pgClient.js";
import { initialWatchlist } from "./seeds.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const WATCHLIST_FILE = path.join(DATA_DIR, "watchlist.json");

class WatchlistDataStore {
  constructor() {
    this.watchlist = this.loadFromFile();
    
    // Listen for PostgreSQL readiness to sync persisted data
    pgClient.on("ready", () => {
      this.loadFromDatabase();
    });

    if (pgClient.isConnected()) {
      this.loadFromDatabase();
    }
  }

  loadFromFile() {
    try {
      if (fs.existsSync(WATCHLIST_FILE)) {
        const raw = fs.readFileSync(WATCHLIST_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("⚠️ [WatchlistStore] Could not read watchlist.json fallback:", e.message);
    }
    this.saveToFile([...initialWatchlist]);
    return [...initialWatchlist];
  }

  saveToFile(data = this.watchlist) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.warn("⚠️ [WatchlistStore] Could not write watchlist.json:", e.message);
    }
  }

  async loadFromDatabase() {
    try {
      if (pgClient.isConnected()) {
        const res = await pgClient.query("SELECT * FROM watchlist ORDER BY created_at DESC");
        if (res && res.rows) {
          this.watchlist = res.rows;
          this.saveToFile(this.watchlist);
        }
      }
    } catch (err) {
      console.error("Error loading watchlist store from database:", err.message);
    }
  }

  async init() {
    await this.loadFromDatabase();
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

  getById(id) {
    if (!id) return null;
    return this.watchlist.find(w => w.id === id || w.vehicle_plate.toUpperCase() === id.toUpperCase());
  }

  async create(record) {
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
    this.saveToFile();

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      try {
        await pgClient.query(
          `INSERT INTO watchlist (id, vehicle_plate, vehicle_type, category, fir_number, police_station, owner_name, priority, status, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (vehicle_plate) DO UPDATE SET
            category = EXCLUDED.category,
            priority = EXCLUDED.priority,
            status = EXCLUDED.status,
            description = EXCLUDED.description`,
          [newRecord.id, newRecord.vehicle_plate, newRecord.vehicle_type, newRecord.category, newRecord.fir_number, newRecord.police_station, newRecord.owner_name, newRecord.priority, newRecord.status, newRecord.description, newRecord.created_at]
        );
      } catch (err) {
        console.warn("PG Watchlist Insert Error:", err.message);
      }
    }

    return newRecord;
  }

  async update(id, updates) {
    const idx = this.watchlist.findIndex(w => w.id === id || w.vehicle_plate.toUpperCase() === id.toUpperCase());
    if (idx === -1) {
      const err = new Error(`Watchlist record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const current = this.watchlist[idx];
    const updated = {
      ...current,
      ...updates,
      id: current.id,
      vehicle_plate: updates.vehicle_plate ? updates.vehicle_plate.toUpperCase().trim() : current.vehicle_plate,
      updated_at: new Date().toISOString()
    };

    this.watchlist[idx] = updated;
    this.saveToFile();

    if (pgClient.isConnected()) {
      try {
        await pgClient.query(
          `UPDATE watchlist SET
            vehicle_plate = $1,
            vehicle_type = $2,
            category = $3,
            fir_number = $4,
            police_station = $5,
            owner_name = $6,
            priority = $7,
            status = $8,
            description = $9
           WHERE id = $10 OR vehicle_plate = $10`,
          [updated.vehicle_plate, updated.vehicle_type, updated.category, updated.fir_number, updated.police_station, updated.owner_name, updated.priority, updated.status, updated.description, id]
        );
      } catch (err) {
        console.warn("PG Watchlist Update Error:", err.message);
      }
    }

    return updated;
  }

  async delete(id) {
    const idx = this.watchlist.findIndex(w => w.id === id || w.vehicle_plate.toUpperCase() === id.toUpperCase());
    if (idx === -1) {
      const err = new Error(`Watchlist record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const removed = this.watchlist.splice(idx, 1);
    this.saveToFile();

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      try {
        await pgClient.query("DELETE FROM watchlist WHERE id = $1 OR vehicle_plate = $1", [id]);
      } catch (err) {
        console.warn("PG Watchlist Delete Error:", err.message);
      }
    }

    return removed[0];
  }
}

export default new WatchlistDataStore();
