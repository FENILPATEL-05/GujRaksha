import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WATCHLIST_PATH = path.join(__dirname, "../data/watchlist.json");

class WatchlistDataStore {
  constructor() {
    this.watchlist = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(WATCHLIST_PATH)) {
        const raw = fs.readFileSync(WATCHLIST_PATH, "utf8");
        this.watchlist = JSON.parse(raw);
      } else {
        this.watchlist = [];
      }
    } catch (err) {
      console.error("Error loading watchlist store:", err.message);
      this.watchlist = [];
    }
  }

  save() {
    try {
      const dir = path.dirname(WATCHLIST_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(this.watchlist, null, 2), "utf8");
    } catch (err) {
      console.error("Error saving watchlist store:", err.message);
    }
  }

  getAll(filters = {}) {
    this.init();
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
    this.init();
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
      const err = new Error(`Vehicle plate \x27${cleanPlate}\x27 is already in the watchlist (${existing.fir_number}).`);
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
    this.save();
    return newRecord;
  }

  delete(id) {
    const idx = this.watchlist.findIndex(w => w.id === id || w.vehicle_plate.toUpperCase() === id.toUpperCase());
    if (idx === -1) {
      const err = new Error(`Watchlist record \x27${id}\x27 not found.`);
      err.statusCode = 404;
      throw err;
    }

    const removed = this.watchlist.splice(idx, 1);
    this.save();
    return removed[0];
  }
}

export default new WatchlistDataStore();
