# 🛡️ GujRaksha — 80,000 CCTV & 3-Tier Distributed Architecture Guide

GujRaksha CCTV & ANPR Platform ko **3 independent, modular parts/folders** me divide kiya gaya hai:

```
sentinel-cctv-platform/
│
├── 📁 1_STREAM_GATEWAY/     ──> 💻 Laptop A (MediaMTX Standalone Video Stream Server)
│   ├── start_gateway.sh     ──> Starts RTSP (8554), WebRTC (8889), HLS (8888)
│   ├── publish_video.sh     ──> Feeds MP4 CCTV Video in loop to stream
│   ├── publish_webcam.sh    ──> Feeds Webcam to stream
│   ├── get_urls.sh          ──> Displays 3 URLs (RTSP / WebRTC / HLS)
│   └── README.md
│
├── 📁 2_CENTRAL_PLATFORM/   ──> 🖥️ Laptop B (Central Command & Control Room)
│   ├── start_central.sh     ──> Starts Central Web UI & APIs (Port 3000)
│   ├── src/                 ──> React GIS Map, Video Wall, Watchlist & Ingestion APIs
│   ├── data/                ──> 80,000 Cameras Registry & Watchlist DB
│   ├── dist/                ──> Compiled production frontend bundle
│   └── README.md
│
└── 📁 3_ANPR_EDGE_WORKER/   ──> 💻 Laptop C, D, E... (Distributed Python AI Inference Nodes)
    ├── setup_env.sh         ──> 1-click Python AI dependencies setup
    ├── start_worker.sh      ──> 1-click AI worker execution (Cluster & Standalone)
    ├── anpr_worker.py       ──> YOLOv9 Plate Detector + CCT Transformer OCR + O(1) Watchlist Sync
    ├── models/              ──> TFLite & ONNX AI models
    └── README.md
```

---

## 🌐 80,000 Cameras Scaled Architecture Flow:

### 1️⃣ Laptop A: Stream Gateway (`1_STREAM_GATEWAY`)
- MediaMTX stream server start karein:
  ```bash
  cd 1_STREAM_GATEWAY
  ./start_gateway.sh
  ```
- Video/Camera publish karein:
  ```bash
  ./publish_video.sh test_traffic.mp4 1
  ```
- **3 URLs generated:**
  - 🔴 **RTSP:** `rtsp://<STREAM_IP>:8554/stream/1` *(Python AI ke liye)*
  - 🟢 **WebRTC (WHEP):** `http://<STREAM_IP>:8889/stream/1/whep` *(Central Web UI ke liye)*
  - 🟡 **HLS:** `http://<STREAM_IP>:8888/stream/1/index.m3u8`

---

### 2️⃣ Laptop B: Central Control Room (`2_CENTRAL_PLATFORM`)
- Central Server start karein:
  ```bash
  cd 2_CENTRAL_PLATFORM
  ./start_central.sh
  ```
- Browser me open karein: `http://<CENTRAL_IP>:3000/`
- Central Platform me **80,000 Cameras Registry**, **Watchlist Manager**, aur **GIS Map** ready rahenge.
- **"ANPR Intelligence" ➔ "Distributed AI ANPR Nodes"** tab me connected workers monitor honge.

---

### 3️⃣ Laptop C, D, E...: Python AI Workers (`3_ANPR_EDGE_WORKER`)
- Python worker ko Central Server ka IP dekar start karein:
  ```bash
  cd 3_ANPR_EDGE_WORKER
  ./start_worker.sh http://<CENTRAL_IP>:3000/api/v1 node-1 100
  ```

#### 🔄 Dynamic Interaction Lifecycle:
1. **Worker Boots Up & Registers:**
   - Worker Central ko register request bhejta hai (`POST /api/v1/workers/register`).
   - Central CCC UI me worker **`ONLINE | STANDBY`** dikhne lagta hai.
2. **Watchlist Sync (O(1) Memory Hash Map):**
   - Worker Central API se active target plates (e.g. `GJ-01-AA-1234`, `HR-98-AA-0000`, etc.) fetch karke local RAM hash set me store karta hai (0.0001s instant lookup).
3. **Central Assigns 100 Cameras:**
   - Central Admin UI me jakar `node-1` ke aage **"+ 100 Cams"** ya **"Auto-Distribute All Cameras"** click karta hai.
   - Worker ko agle heartbeat me 100 cameras mil jaate hain aur worker ka status **`SCANNING (100 Active Streams)`** ho jata hai!
4. **AI Detection & Real-Time Alerting:**
   - Worker frames me se YOLOv9 + CCT OCR se plate detect karta hai.
   - O(1) in-memory check: `if plate in watchlist`.
   - Jaise hi target plate aati hai, worker Central Server ko `POST /api/v1/anpr/ingest` alert bhejta hai.
   - Central Server GIS Map par turant **Threat Alert Siren & Red Pin Popup** trigger kar deta hai!
