# 🧠 Part 3: Python AI ANPR Edge Worker (80,000 Camera Cluster Node)

Yeh folder **Distributed Python AI ANPR Engine** hai jo 80,000 CCTV cameras ke scale par kaam karta hai. Is folder ko aap **multiple laptops, edge servers, ya GPU machines** par copy karke parallel me run kar sakte hain.

---

## 🎯 Iska Exact Flow (According to Architecture Doc):

```
┌────────────────────────────────────────────────────────┐
│ 1. Python Worker Boots Up                              │
│    └─► Registers with Central (POST /api/v1/workers)   │
│    └─► Status: ONLINE | State: STANDBY                 │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 2. Watchlist Sync (O(1) Hash Map)                      │
│    └─► Central se target plates fetch karta hai        │
│    └─► e.g. "GJ-01-AA-1234", "HR-98-AA-0000"           │
│    └─► 0.0001s Instant in-memory RAM lookup            │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 3. Central Assigns 100 Cameras (On-Demand Dispatch)    │
│    └─► Central Admin UI se 100 cameras assign karta hai│
│    └─► Worker heartbeat me 100 RTSP URLs receive karega│
│    └─► State flips to: SCANNING (100 Streams Active)   │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 4. Real-Time AI Detection & Threat-Only Alerting       │
│    └─► YOLOv9 Plate Detector + CCT Transformer OCR     │
│    └─► If Plate in Watchlist -> Immediate Central Alert│
│    └─► If Normal Plate -> Local Log (Saves Central Net)│
└────────────────────────────────────────────────────────┘
```

---

## 🚀 How to Run Worker:

### Step 1: Environment Setup (First Time Only)
```bash
chmod +x *.sh
./setup_env.sh
```

---

### Step 2: Start Worker in Central Managed Cluster Mode (Recommended)
Worker ko Central Server ka URL aur apna Node ID dekar run karein:

```bash
./start_worker.sh <CENTRAL_API_URL> [WORKER_ID] [MAX_CAMERAS]
```

#### Example (Connecting to Laptop B's Central Server):
```bash
./start_worker.sh http://192.168.1.100:3000/api/v1 node-1 100
```

1. Worker Central Server se connect hoke **STANDBY (Ready)** state me chala jayega.
2. Central Dashboard ke **"Distributed AI ANPR Nodes"** tab me yeh `node-1` dikhega.
3. Central Admin **"+ 100 Cams"** ya **"Auto-Distribute"** button click karega.
4. Worker ko instantly 100 cameras mil jayenge aur wo 100 streams par AI scanning shuru kar dega!
5. Jaise hi stream me watchlist ki koi target plate aayegi, worker Central CCC par real-time alert trigger kar dega!

---

### Step 3: Direct Single Stream Testing (Optional)
Agar aap kisi ek specific camera ya MediaMTX stream par test karna chahte hain:
```bash
./start_worker.sh --source rtsp://192.168.1.50:8554/stream/1 http://192.168.1.100:3000/api/v1 GJ-GOV-001
```
