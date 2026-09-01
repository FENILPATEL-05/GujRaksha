# 🏢 PART 2: GujRaksha Central Command & Control Platform (Web, GIS & Orchestrator)
## Complete Technical Documentation & Architecture Guide
### GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial Control Platform

---

## 1. Overview & System Purpose

The **Central Command & Control Platform (Part 2)** is the central intelligence, governance, spatial GIS mapping, and worker orchestration brain of the GujRaksha platform.

It is designed to handle **80,000+ CCTV camera records** across all **33 districts** and **26 government departments** of Gujarat. It provides high-speed vector GIS spatial visualization, video wall streaming, stolen vehicle watchlist management, real-time threat radar dispatching, and dynamic orchestration of distributed AI ANPR worker clusters.

```mermaid
graph TD
    subgraph ClientLayer [Enterprise Web Frontend - React SPA]
        GIS["🗺️ Leaflet High-Speed Vector GIS Map (80,000 Cams)"]
        WALL["📺 16-Grid WebRTC Video Wall"]
        WATCH["📋 Watchlist & FIR Hotlist Manager"]
        ORCH_UI["🤖 Distributed AI Cluster Node Monitor"]
        RADAR["🚨 Real-Time Threat Radar Panel & Audio Siren"]
    end

    subgraph CentralServer [Node.js / Express Backend Engine]
        ROUTER["REST API Gateway & SSE Event Bus"]
        ORCH_SVC["Worker Node Orchestrator & Auto-Dispatcher"]
        ANPR_SVC["ANPR Threat Ingestion & PostGIS Trajectory Engine"]
        CAM_SVC["Camera Registry & Spatial Gap Analysis Engine"]
    end

    subgraph DataStorageLayer [Data & Storage Layer]
        PG[("PostgreSQL 16 + PostGIS Spatial Engine")]
        MEM_CACHE[("In-Memory High-Speed Cache & JSON Persistence")]
    end

    subgraph ExternalParties [External Node Connections]
        GW["Part 1: MediaMTX Stream Gateway (WebRTC WHEP)"]
        WORKERS["Part 3: Distributed Python AI Edge Nodes"]
    end

    ClientLayer <-->|REST APIs & SSE Live Stream| CentralServer
    CentralServer <--> DataStorageLayer
    GW -.->|Live Video WHEP Feeds| WALL
    WORKERS <-->|Register, Heartbeat, Threat Ingest| CentralServer
```

---

## 2. Directory & Key File Structure

```
2_CENTRAL_PLATFORM/
├── server.js               # Master Express.js server & API routes mount
├── start_central.sh        # 1-Click production/dev startup script
├── package.json            # Node.js dependencies & scripts
├── vite.config.js          # Vite build tool configuration
├── PART2_CENTRAL_PLATFORM_DOC.md # Complete technical documentation
├── data/
│   ├── cameras.json        # 80,000+ Camera master records database (138 MB)
│   ├── departments.json    # 26 Gujarat Government departments directory
│   ├── watchlist.json      # Wanted / Stolen vehicle plates database
│   └── anpr_detections.json# Historical ANPR logs & alert records
├── src/
│   ├── components/
│   │   ├── MapView.jsx               # High-performance Leaflet GIS Map & Heatmap
│   │   ├── VideoWallPage.jsx         # 1/4/9/16 WebRTC multi-grid live surveillance wall
│   │   ├── ANPRIntelligencePage.jsx  # Distributed AI nodes monitor & real-time alerts
│   │   ├── WatchlistManagerPage.jsx  # Stolen vehicle hotlist & eGujCop FIR manager
│   │   ├── CameraRegistryPage.jsx    # 80,000 camera search, filter & edit table
│   │   ├── IncidentRadarPanel.jsx    # Real-time popup alerts & sound siren
│   │   └── GapAnalysisModal.jsx      # Spatial blindspot & coverage gap calculator
│   ├── routes/
│   │   ├── cameraRoutes.js           # Camera CRUD & spatial filtering endpoints
│   │   ├── workerRoutes.js           # Python AI worker registration & dynamic dispatch
│   │   ├── anprRoutes.js             # Detection ingestion, alert dismiss & SSE
│   │   ├── watchlistRoutes.js        # Watchlist CRUD & live sync
│   │   └── departmentRoutes.js       # Departmental isolation & RBAC
│   ├── services/
│   │   ├── workerOrchestratorService.js # Cluster node manager & camera auto-distributor
│   │   ├── cameraService.js          # In-memory spatial index & pagination
│   │   ├── anprStore.js              # Real-time alert bus & SSE subscriber manager
│   │   └── gapAnalysisService.js     # Unmonitored corridor & ageing equipment analysis
│   └── db/
│       ├── pool.js                   # PostgreSQL connection & high-speed memory fallback
│       ├── pgClient.js               # PostGIS client initialization
│       └── schema.sql                # PostGIS spatial DDL schema
```

---

## 3. Key Modules & Functional Architecture

### A. GIS Spatial Control Center & Vector Map (`MapView.jsx`)
* **Scale Capability:** Capable of rendering 80,000+ camera coordinates across Gujarat's 33 districts.
* **Spatial Geography:** Uses PostGIS `GEOGRAPHY(Point, 4326)` for accurate geodesic calculations across Gujarat's 1,000 km geographic span.
* **Coverage Heatmap:** Real-time spatial density heatmap highlighting high-density security zones and vulnerable blind spots.
* **Trajectory Path Reconstruction:** When a suspect vehicle plate is clicked, the GIS map queries historical camera timestamps and draws the vehicle's exact driving trajectory corridor with chronological timestamps and speed tags.

---

### B. Live WebRTC / WHEP Video Wall (`VideoWallPage.jsx`)
* Supports **1x1, 2x2 (4-grid), 3x3 (9-grid), and 4x4 (16-grid)** live surveillance views.
* Integrates directly with Part 1 (MediaMTX) using native **WHEP (WebRTC HTTP Egress Protocol)** for sub-200ms glass-to-glass latency without requiring browser plugins.
* Features PTZ controls simulation, snapshot capture, full-screen expansion, and district camera switching.

---

### C. Stolen Vehicle & Suspect Watchlist Manager (`WatchlistManagerPage.jsx`)
* Manages state and national law enforcement watchlists:
  * **Stolen Vehicles (VAHAN integration)**
  * **Crime Suspects & Active FIRs (eGujCop / CCTNS integration)**
  * **Traffic Blacklist & High-Speed Violators**
* Fields: Plate Number, Category, FIR Number, Police Station, Officer In-Charge, Threat Priority (`CRITICAL`, `HIGH`, `MEDIUM`).
* Synchronized instantly to all connected Python AI worker nodes via memory hash sets.

---

### D. Distributed AI Worker Orchestrator (`workerOrchestratorService.js`)
* **Auto-Discovery & Dynamic Allocation:**
  * When a Python AI node starts, it calls `POST /api/v1/workers/register`.
  * Central auto-allocates up to 100 ANPR cameras per connected worker node based on district or workload.
* **Health Watchdog:**
  * Monitors heartbeat every 2-3 seconds (`POST /api/v1/workers/heartbeat`).
  * If a worker stops sending heartbeats for >10 seconds, status automatically flips to `🔴 OFFLINE`.
  * When worker recovers, state flips back to `🟢 ONLINE / SCANNING`.
* **1-Click Cluster Auto-Distribution:**
  * Admin can click **"Auto-Distribute All Cameras"** or **"+ 100 Cams"** to instantly balance thousands of RTSP streams across 10, 50, or 800 worker machines.

---

### E. Real-Time Threat Radar & Ingestion Hub (`anprRoutes.js` & `anprStore.js`)
* High-throughput HTTP ingestion endpoint: `POST /api/v1/anpr/ingest` and micro-batch endpoint `POST /api/v1/anpr/ingest-batch`.
* When a watchlist hit arrives:
  1. Broadcasts event instantly over **Server-Sent Events (SSE)** to all connected operator browsers (`/api/v1/anpr/alerts/live`).
  2. Triggers the Tactical Radar siren audio in the CCC room.
  3. Displays a persistent red flashing alert banner with camera name, plate number, district, and timestamp.
  4. Stores the event in database with operator acknowledgement/dismissal support (`PATCH /api/v1/anpr/alerts/:id/dismiss`).

---

## 4. Complete REST API Reference

### 1. Camera Registry Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/cameras` | List cameras with pagination, district filter, department filter, and search. |
| `GET` | `/api/v1/cameras/:id` | Get detailed metadata and live stream URLs for a single camera. |
| `POST` | `/api/v1/cameras` | Register a new CCTV camera asset with geographic coordinates. |
| `PUT` | `/api/v1/cameras/:id` | Update camera technical specifications or status (`ACTIVE`, `MAINTENANCE`, `OFFLINE`). |
| `DELETE` | `/api/v1/cameras/:id` | Remove a camera asset from the statewide registry. |
| `GET` | `/api/ingest` | Standardized catalog API returning all active camera RTSP/WebRTC/HLS URLs. |

### 2. Distributed Worker Orchestrator Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/workers/register` | Register a new Python AI worker node in STANDBY mode. |
| `POST` | `/api/v1/workers/heartbeat` | Worker heartbeat ping returning assigned RTSP camera list and latest watchlist. |
| `GET` | `/api/v1/workers` | Get status, FPS, and stream capacity for all active cluster worker nodes. |
| `POST` | `/api/v1/workers/:id/assign` | Assign specific number of cameras or district streams to a worker. |
| `POST` | `/api/v1/workers/:id/clear` | Revoke assigned cameras from a worker node (returns to STANDBY). |
| `POST` | `/api/v1/workers/auto-distribute` | 1-Click auto-balancer distributing all unassigned cameras across active nodes. |

### 3. Watchlist & ANPR Threat Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/watchlist` | Fetch all active wanted vehicle watchlist records. |
| `POST` | `/api/v1/watchlist` | Add a new target plate, FIR reference, and priority rating. |
| `DELETE` | `/api/v1/watchlist/:id` | Remove a plate from the active threat watchlist. |
| `POST` | `/api/v1/anpr/ingest` | Endpoint called by Python AI workers to report a detected vehicle or threat hit. |
| `POST` | `/api/v1/anpr/ingest-batch` | Micro-batch ingestion endpoint for high-throughput multi-camera clusters. |
| `GET` | `/api/v1/anpr/alerts` | Get active un-dismissed threat alerts for CCC operators. |
| `GET` | `/api/v1/anpr/alerts/live` | Server-Sent Events (SSE) real-time streaming feed for instant browser popups. |
| `PATCH` | `/api/v1/anpr/alerts/:id/dismiss` | Dismiss/acknowledge a threat alert in the database. |
| `GET` | `/api/v1/anpr/trajectory/:plate` | Fetch spatial and temporal route path for suspect vehicle tracking. |

---

## 5. Step-by-Step Setup & Operations Guide

### Step 1: Environment Configuration
Edit or create `.env` in `2_CENTRAL_PLATFORM/`:

```env
PORT=3000
NODE_ENV=production
# IP of Laptop A (MediaMTX Stream Gateway)
STREAM_SERVER_HOST=192.168.1.50
# PostgreSQL Database Connection (Optional - In-Memory DB works out-of-the-box)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gujraksha_cctv
```

### Step 2: Install Node.js Dependencies
```bash
cd 2_CENTRAL_PLATFORM
npm install
```

### Step 3: Start the Central Server
```bash
./start_central.sh
```

Terminal output will display:
```
=======================================================
🏢 GUJRAKSHA CENTRAL COMMAND & CONTROL PLATFORM
💻 Central Dashboard running on http://localhost:3000
🗺️  GIS Control Center, Video Wall & Database Active
📡 Distributed AI Ingestion API Active & Standing By
=======================================================
```

Access the Web Portal in any browser at: `http://<CENTRAL_IP>:3000/`
