import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pgClient from "./pgClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export const initialUsers = [
  {
    id: "usr-superadmin-01",
    username: "superadmin",
    email: "admin@gujraksha.gov.in",
    password: "admin123",
    name: "State Command Superadmin",
    role: "SUPERADMIN",
    department_id: "ALL",
    department_name: "Statewide Command Center",
    status: "ACTIVE",
    created_at: "2026-09-01T00:00:00.000Z"
  },
  {
    id: "usr-admin-alias",
    username: "admin",
    email: "admin@gujarat.gov.in",
    password: "admin123",
    name: "State Command Admin",
    role: "SUPERADMIN",
    department_id: "ALL",
    department_name: "Statewide Command Center",
    status: "ACTIVE",
    created_at: "2026-09-01T00:00:00.000Z"
  },
  {
    id: "usr-dept-home-01",
    username: "police_admin",
    email: "police@gujraksha.gov.in",
    password: "police123",
    name: "Gujarat Police Nodal Officer",
    role: "DEPT_ADMIN",
    department_id: "HOME",
    department_name: "Home Department / Gujarat Police",
    status: "ACTIVE",
    created_at: "2026-09-01T00:00:00.000Z"
  },
  {
    id: "usr-dept-transport-01",
    username: "rto_admin",
    email: "rto@gujraksha.gov.in",
    password: "rto123",
    name: "Transport & RTO Officer",
    role: "DEPT_ADMIN",
    department_id: "TRANSPORT",
    department_name: "Transport & Road Safety",
    status: "ACTIVE",
    created_at: "2026-09-01T00:00:00.000Z"
  },
  {
    id: "usr-dept-urban-01",
    username: "urban_admin",
    email: "urban@gujraksha.gov.in",
    password: "urban123",
    name: "Urban Development & Smart City Lead",
    role: "DEPT_ADMIN",
    department_id: "URBAN_DEV",
    department_name: "Urban Development & Smart Cities",
    status: "ACTIVE",
    created_at: "2026-09-01T00:00:00.000Z"
  },
  {
    id: "usr-viewer-01",
    username: "viewer",
    email: "viewer@gujraksha.gov.in",
    password: "viewer123",
    name: "Statewide GIS Observer",
    role: "VIEWER",
    department_id: "ALL",
    department_name: "Public Safety & Observer",
    status: "ACTIVE",
    created_at: "2026-09-01T00:00:00.000Z"
  }
];

class UserDataStore {
  constructor() {
    this.users = this.loadFromFile();

    pgClient.on("ready", () => {
      this.loadFromDatabase();
    });

    if (pgClient.isConnected()) {
      this.loadFromDatabase();
    }
  }

  loadFromFile() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("⚠️ [UserStore] Could not read users.json fallback:", e.message);
    }
    this.saveToFile([...initialUsers]);
    return [...initialUsers];
  }

  saveToFile(data = this.users) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.warn("⚠️ [UserStore] Could not write users.json:", e.message);
    }
  }

  async loadFromDatabase() {
    try {
      if (pgClient.isConnected()) {
        await pgClient.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(100) PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(150) UNIQUE,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(150) NOT NULL,
            role VARCHAR(50) DEFAULT 'DEPT_ADMIN',
            department_id VARCHAR(50) DEFAULT 'ALL',
            department_name VARCHAR(150),
            status VARCHAR(30) DEFAULT 'ACTIVE',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);

        const res = await pgClient.query("SELECT * FROM users ORDER BY created_at ASC");
        if (res && res.rows && res.rows.length > 0) {
          this.users = res.rows;
          this.saveToFile(this.users);
        } else {
          // Seed database with default users
          for (const u of this.users) {
            await pgClient.query(
              `INSERT INTO users (id, username, email, password, name, role, department_id, department_name, status, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (username) DO NOTHING`,
              [u.id, u.username, u.email, u.password, u.name, u.role, u.department_id, u.department_name, u.status || 'ACTIVE', u.created_at || new Date()]
            );
          }
        }
      }
    } catch (err) {
      console.error("Error syncing users with database:", err.message);
    }
  }

  getAll() {
    return this.users.map(u => {
      const { password, ...safeUser } = u;
      return safeUser;
    });
  }

  getById(id) {
    const u = this.users.find(x => x.id === id);
    if (!u) return null;
    const { password, ...safeUser } = u;
    return safeUser;
  }

  getByUsernameOrEmail(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).trim().toLowerCase();
    return this.users.find(u => 
      (u.username && u.username.toLowerCase() === clean) ||
      (u.email && u.email.toLowerCase() === clean)
    );
  }

  verifyCredentials(usernameOrEmail, password) {
    if (!usernameOrEmail || !password) return null;
    const user = this.getByUsernameOrEmail(usernameOrEmail);
    if (user && user.password === password) {
      const { password: _, ...safeUser } = user;
      return safeUser;
    }
    return null;
  }

  async create(userData) {
    const cleanUsername = String(userData.username || "").trim().toLowerCase();
    if (!cleanUsername) {
      throw new Error("Username is mandatory.");
    }
    if (!userData.password || userData.password.length < 4) {
      throw new Error("Password must be at least 4 characters long.");
    }

    const existing = this.getByUsernameOrEmail(cleanUsername);
    if (existing) {
      throw new Error(`User with username '${cleanUsername}' already exists.`);
    }

    if (userData.email) {
      const emailExisting = this.getByUsernameOrEmail(userData.email);
      if (emailExisting) {
        throw new Error(`User with email '${userData.email}' already exists.`);
      }
    }

    const role = (userData.role || "DEPT_ADMIN").toUpperCase();
    const department_id = role === "SUPERADMIN" ? "ALL" : (userData.department_id || "HOME");

    const newUser = {
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      username: cleanUsername,
      email: userData.email || `${cleanUsername}@gujraksha.gov.in`,
      password: userData.password,
      name: userData.name || cleanUsername,
      role: role,
      department_id: department_id,
      department_name: userData.department_name || (department_id === "ALL" ? "Statewide Command Center" : department_id),
      status: userData.status || "ACTIVE",
      created_at: new Date().toISOString()
    };

    this.users.push(newUser);
    this.saveToFile(this.users);

    if (pgClient.isConnected()) {
      try {
        await pgClient.query(
          `INSERT INTO users (id, username, email, password, name, role, department_id, department_name, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [newUser.id, newUser.username, newUser.email, newUser.password, newUser.name, newUser.role, newUser.department_id, newUser.department_name, newUser.status, newUser.created_at]
        );
      } catch (err) {
        console.error("Error inserting user to pg:", err.message);
      }
    }

    const { password, ...safeUser } = newUser;
    return safeUser;
  }

  async update(id, updateData) {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) {
      throw new Error(`User '${id}' not found.`);
    }

    const current = this.users[idx];
    const updated = {
      ...current,
      name: updateData.name !== undefined ? updateData.name : current.name,
      email: updateData.email !== undefined ? updateData.email : current.email,
      role: updateData.role !== undefined ? updateData.role.toUpperCase() : current.role,
      department_id: updateData.department_id !== undefined ? updateData.department_id : current.department_id,
      department_name: updateData.department_name !== undefined ? updateData.department_name : current.department_name,
      status: updateData.status !== undefined ? updateData.status : current.status,
      password: updateData.password ? updateData.password : current.password,
      updated_at: new Date().toISOString()
    };

    this.users[idx] = updated;
    this.saveToFile(this.users);

    if (pgClient.isConnected()) {
      try {
        await pgClient.query(
          `UPDATE users SET name = $1, email = $2, role = $3, department_id = $4, department_name = $5, status = $6, password = $7, updated_at = NOW() WHERE id = $8`,
          [updated.name, updated.email, updated.role, updated.department_id, updated.department_name, updated.status, updated.password, id]
        );
      } catch (err) {
        console.error("Error updating user in pg:", err.message);
      }
    }

    const { password, ...safeUser } = updated;
    return safeUser;
  }

  async delete(id) {
    const user = this.users.find(u => u.id === id);
    if (!user) {
      throw new Error(`User '${id}' not found.`);
    }
    if (user.username === "superadmin" || user.username === "admin") {
      throw new Error("Default System Superadmin account cannot be deleted.");
    }

    this.users = this.users.filter(u => u.id !== id);
    this.saveToFile(this.users);

    if (pgClient.isConnected()) {
      try {
        await pgClient.query("DELETE FROM users WHERE id = $1", [id]);
      } catch (err) {
        console.error("Error deleting user from pg:", err.message);
      }
    }

    return { success: true, deleted_id: id };
  }
}

export const userStore = new UserDataStore();
export default userStore;
