import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEPT_FILE_PATH = path.join(__dirname, "../data/departments.json");

class DepartmentDataStore {
  constructor() {
    this.departments = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DEPT_FILE_PATH)) {
        const raw = fs.readFileSync(DEPT_FILE_PATH, "utf8");
        this.departments = JSON.parse(raw);
      } else {
        this.departments = [];
      }
    } catch (err) {
      console.error("Error loading department data store:", err.message);
      this.departments = [];
    }
  }

  save() {
    try {
      const dir = path.dirname(DEPT_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DEPT_FILE_PATH, JSON.stringify(this.departments, null, 2), "utf8");
    } catch (err) {
      console.error("Error saving department data store:", err.message);
    }
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
    const code = (deptData.code || deptData.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()).trim();
    if (!code || !deptData.name) {
      const err = new Error("Department Code and Department Name are mandatory.");
      err.statusCode = 400;
      throw err;
    }

    const existingIdx = this.departments.findIndex(d => (d.code || "").toUpperCase() === code.toUpperCase());
    if (existingIdx >= 0) {
      const err = new Error("Department code \x27" + code + "\x27 already exists.");
      err.statusCode = 409;
      throw err;
    }

    const newDept = {
      code: code,
      name: deptData.name.trim(),
      category: deptData.category || "State Administration & Services",
      nodal_officer: deptData.nodal_officer || "Nodal CCTV In-Charge",
      contact_email: deptData.contact_email || (code.toLowerCase() + ".cctv@gujarat.gov.in"),
      contact_phone: deptData.contact_phone || "+91 79 2325 0000",
      status: deptData.status || "ACTIVE",
      icon: deptData.icon || "Building2",
      color: deptData.color || "#22d3ee",
      description: deptData.description || "Surveillance and security camera infrastructure for " + deptData.name,
      created_at: new Date().toISOString()
    };

    this.departments.push(newDept);
    this.save();
    return this.getByCode(code);
  }

  update(code, updateData) {
    const idx = this.departments.findIndex(d => (d.code || "").toUpperCase() === (code || "").toUpperCase());
    if (idx === -1) {
      const err = new Error("Department \x27" + code + "\x27 not found.");
      err.statusCode = 404;
      throw err;
    }

    const existing = this.departments[idx];
    const updated = {
      ...existing,
      name: updateData.name !== undefined ? updateData.name.trim() : existing.name,
      category: updateData.category !== undefined ? updateData.category : existing.category,
      nodal_officer: updateData.nodal_officer !== undefined ? updateData.nodal_officer : existing.nodal_officer,
      contact_email: updateData.contact_email !== undefined ? updateData.contact_email : existing.contact_email,
      contact_phone: updateData.contact_phone !== undefined ? updateData.contact_phone : existing.contact_phone,
      status: updateData.status !== undefined ? updateData.status : existing.status,
      icon: updateData.icon !== undefined ? updateData.icon : existing.icon,
      color: updateData.color !== undefined ? updateData.color : existing.color,
      description: updateData.description !== undefined ? updateData.description : existing.description,
      updated_at: new Date().toISOString()
    };

    this.departments[idx] = updated;
    this.save();
    return this.getByCode(code);
  }

  delete(code) {
    const idx = this.departments.findIndex(d => (d.code || "").toUpperCase() === (code || "").toUpperCase());
    if (idx === -1) {
      const err = new Error("Department \x27" + code + "\x27 not found.");
      err.statusCode = 404;
      throw err;
    }

    // Safety check: Cannot delete default protected departments if cameras are attached
    const cameras = db.getAll({});
    const assignedCameras = cameras.filter(c => (c.department_id || "").toUpperCase() === code.toUpperCase());
    if (assignedCameras.length > 0) {
      const err = new Error("Cannot delete department \x27" + code + "\x27 because " + assignedCameras.length + " camera assets are currently registered under it.");
      err.statusCode = 400;
      throw err;
    }

    const removed = this.departments.splice(idx, 1);
    this.save();
    return removed[0];
  }
}

export default new DepartmentDataStore();
