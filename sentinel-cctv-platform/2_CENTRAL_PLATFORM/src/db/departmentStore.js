import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./pool.js";
import pgClient from "./pgClient.js";
import { initialDepartments } from "./seeds.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const DEPARTMENTS_FILE = path.join(DATA_DIR, "departments.json");

class DepartmentDataStore {
  constructor() {
    this.departments = this.loadFromFile();
    
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
      if (fs.existsSync(DEPARTMENTS_FILE)) {
        const raw = fs.readFileSync(DEPARTMENTS_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("⚠️ [DepartmentStore] Could not read departments.json fallback:", e.message);
    }
    this.saveToFile([...initialDepartments]);
    return [...initialDepartments];
  }

  saveToFile(data = this.departments) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DEPARTMENTS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.warn("⚠️ [DepartmentStore] Could not write departments.json:", e.message);
    }
  }

  async loadFromDatabase() {
    try {
      if (pgClient.isConnected()) {
        const res = await pgClient.query("SELECT * FROM departments ORDER BY code ASC");
        if (res && res.rows) {
          this.departments = res.rows;
          this.saveToFile(this.departments);
        }
      }
    } catch (err) {
      console.error("Error loading department data store from database:", err.message);
    }
  }

  async init() {
    await this.loadFromDatabase();
  }

  getAll() {
    const cameras = db.getAll({});
    
    // Calculate live camera counts & active SLA per department
    return this.departments.map(dept => {
      const deptCode = (dept.code || "").toUpperCase();
      const matchedCameras = cameras.filter(c => 
        (c.department_id || "").toUpperCase() === deptCode ||
        (c.department_name || "").toLowerCase().includes((dept.name || "").toLowerCase())
      );

      const activeCount = matchedCameras.filter(c => c.status === "ACTIVE").length;
      const districtSet = new Set(matchedCameras.map(c => c.district).filter(Boolean));

      return {
        ...dept,
        totalCameras: matchedCameras.length,
        activeCameras: activeCount,
        offlineCameras: matchedCameras.length - activeCount,
        districtsCovered: districtSet.size,
        uptimePercentage: matchedCameras.length > 0 ? ((activeCount / matchedCameras.length) * 100).toFixed(1) + "%" : "100%"
      };
    });
  }

  getByCode(code) {
    const all = this.getAll();
    return all.find(d => (d.code || "").toUpperCase() === (code || "").toUpperCase());
  }

  create(deptData) {
    const rawCode = (deptData.code || deptData.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()).replace(/_+/g, "_").trim();
    const code = rawCode || `DEPT_${Date.now()}`;
    if (!deptData.name) {
      const err = new Error("Department Name is mandatory.");
      err.statusCode = 400;
      throw err;
    }

    const existingIdx = this.departments.findIndex(d => (d.code || "").toUpperCase() === code.toUpperCase());
    if (existingIdx >= 0) {
      const err = new Error("Department with similar name/code '" + code + "' already exists.");
      err.statusCode = 409;
      throw err;
    }

    const newDept = {
      code: code,
      name: deptData.name.trim(),
      category: deptData.category ? deptData.category.trim() : "General",
      nodal_officer: deptData.nodal_officer || "",
      contact_email: deptData.contact_email || (code.toLowerCase() + ".cctv@gujarat.gov.in"),
      contact_phone: deptData.contact_phone || "+91 79 2325 0000",
      color: deptData.color || "#22d3ee",
      created_at: new Date().toISOString()
    };

    this.departments.push(newDept);
    this.saveToFile();

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      pgClient.query(
        `INSERT INTO departments (code, name, category, nodal_officer, contact_email, contact_phone, color, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          nodal_officer = EXCLUDED.nodal_officer,
          contact_email = EXCLUDED.contact_email,
          contact_phone = EXCLUDED.contact_phone,
          color = EXCLUDED.color,
          updated_at = NOW()`,
        [newDept.code, newDept.name, newDept.category, newDept.nodal_officer, newDept.contact_email, newDept.contact_phone, newDept.color]
      ).catch(err => console.warn("PG Department Insert Error:", err.message));
    }

    return this.getByCode(code);
  }

  update(code, updateData) {
    const idx = this.departments.findIndex(d => (d.code || "").toUpperCase() === (code || "").toUpperCase());
    if (idx === -1) {
      const err = new Error("Department '" + code + "' not found.");
      err.statusCode = 404;
      throw err;
    }

    const existing = this.departments[idx];
    const updated = {
      ...existing,
      name: updateData.name !== undefined ? updateData.name.trim() : existing.name,
      category: updateData.category !== undefined ? updateData.category.trim() : (existing.category || "General"),
      nodal_officer: updateData.nodal_officer !== undefined ? updateData.nodal_officer : existing.nodal_officer,
      contact_email: updateData.contact_email !== undefined ? updateData.contact_email : existing.contact_email,
      contact_phone: updateData.contact_phone !== undefined ? updateData.contact_phone : existing.contact_phone,
      color: updateData.color !== undefined ? updateData.color : existing.color,
      updated_at: new Date().toISOString()
    };

    this.departments[idx] = updated;
    this.saveToFile();

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      pgClient.query(
        `UPDATE departments SET
          name = $1, category = $2, nodal_officer = $3, contact_email = $4,
          contact_phone = $5, color = $6,
          updated_at = NOW()
        WHERE code = $7`,
        [updated.name, updated.category, updated.nodal_officer, updated.contact_email, updated.contact_phone, updated.color, code]
      ).catch(err => console.warn("PG Department Update Error:", err.message));
    }

    return this.getByCode(code);
  }


  delete(code) {
    const idx = this.departments.findIndex(d => (d.code || "").toUpperCase() === (code || "").toUpperCase());
    if (idx === -1) {
      const err = new Error("Department '" + code + "' not found.");
      err.statusCode = 404;
      throw err;
    }

    // Safety check: Cannot delete default protected departments if cameras are attached
    const cameras = db.getAll({});
    const assignedCameras = cameras.filter(c => (c.department_id || "").toUpperCase() === code.toUpperCase());
    if (assignedCameras.length > 0) {
      const err = new Error("Cannot delete department '" + code + "' because " + assignedCameras.length + " camera assets are currently registered under it.");
      err.statusCode = 400;
      throw err;
    }

    const removed = this.departments.splice(idx, 1);
    this.saveToFile();

    // Direct Database Persistence (PostgreSQL)
    if (pgClient.isConnected()) {
      pgClient.query("DELETE FROM departments WHERE code = $1", [code])
        .catch(err => console.warn("PG Department Delete Error:", err.message));
    }

    return removed[0];
  }
}

export default new DepartmentDataStore();
