# 🛡️ GujRaksha (ગુજ રક્ષા) — Statewide CCTV AI Surveillance & ANPR Intelligence Grid

> **Next-Generation Multi-Tenant CCTV Asset Registry, Real-Time GPU ANPR Engine, Spatial GIS Mapping, Deep Video Forensic Analytics & Distributed Multi-District Edge Cluster Architecture.**

---

## 📑 Table of Contents

1. [System Overview & Architecture](#-system-overview--architecture)
2. [Method 1: All-in-One Docker Deployment (Recommended)](#-method-1-all-in-one-docker-deployment-recommended)
3. [Method 2: Distributed Multi-Server Cluster Deployment (`3_ANPR_EDGE_WORKER` District Nodes)](#-method-2-distributed-multi-server-cluster-deployment-3_anpr_edge_worker-district-nodes)
4. [Method 3: Manual / Standalone Server Run (Node.js & Python)](#-method-3-manual--standalone-server-run-nodejs--python)
5. [Apache Reverse Proxy & SSL Configuration](#-apache-reverse-proxy--ssl-configuration)
6. [GPU Hardware Acceleration (CUDA / TensorRT)](#-gpu-hardware-acceleration-cuda--tensorrt)
7. [Port Reference & Network Grid](#-port-reference--network-grid)
8. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏢 System Overview & Architecture

GujRaksha is built as a scalable, distributed microservice architecture:

| Microservice | Technology | Description | Default Port |
|---|---|---|---|
| **Central Platform** | Node.js (Express) + React (Vite, Leaflet GIS) | Command & Control Dashboard, GIS Map, User RBAC, Camera Registry, Forensics Analyzer | `3000` |
| **Live AI Stream Service** | Python (OpenCV, ONNX Runtime GPU, ByteTrack) | Real-time object & vehicle detection overlay, video forensics frame scanner | `8090` |
| **ANPR Edge Worker** | Python (YOLOv9 ONNX, OCR ONNX, PostGIS Logger) | High-speed vehicle license plate recognition, hotlist matching & PostgreSQL sync | Background Worker |
| **Stream Gateway** | MediaMTX (Bluenviron) | RTSP Ingestion, WebRTC WHEP (Ultra-Low Latency), HLS, RTMP | `8554`, `8889`, `8888` |
| **Database Engine** | PostgreSQL 16 + PostGIS Spatial 3.4 | Geolocation indexing, camera assets, ANPR detection logs, Watchlists | `5432` / `5433` |

---

## 🚀 Method 1: All-in-One Docker Deployment (Recommended)

To deploy all services (Central Platform, AI Worker, Live AI Stream, MediaMTX, PostgreSQL) on a single server using Docker:

### 1. Prerequisites on Server:
- **Ubuntu 20.04 / 22.04 / 24.04 LTS**
- **Docker Engine** (`docker >= 24.0`)
- **Docker Compose v2** (`docker-compose >= 2.20`)
- *(Optional for GPU)* **NVIDIA Drivers & NVIDIA Container Toolkit** (`nvidia-container-toolkit`)

```bash
# Verify Docker & Compose installation
docker --version
docker-compose version
```

### 2. Launch Complete Platform:

```bash
# 1. Clone repository
git clone <YOUR_GIT_REPO_URL>
cd sentinel-cctv-platform

# 2. Launch all containers in background
docker-compose up -d --build
```

### 3. Verify Container Status:

```bash
docker-compose ps
```

You should see 5 active containers:
- `gujraksha_central_platform` (`Up` on Port 3000)
- `gujraksha_ai_stream` (`Up` on Port 8090)
- `gujraksha_ai_worker` (`Up` - Background ANPR Engine)
- `gujraksha_stream_gateway` (`Up` on Ports 8554, 8889, 8888)
- `gujraksha_postgres_db` (`Up` on Port 5433->5432)

---

## 🌐 Method 2: Distributed Multi-Server Cluster Deployment (`3_ANPR_EDGE_WORKER` District Nodes)

For large-scale state-wide deployments (e.g., **80,000+ CCTV Cameras** across 33 Districts of Gujarat), GujRaksha supports **Distributed Edge AI Clusters**:

```
                              ┌───────────────────────────────────────────────┐
                              │     🖥️ CENTRAL COMMAND HEADQUARTERS           │
                              │     Central Platform (Node.js/React :3000)    │
                              │     PostgreSQL + PostGIS Database             │
                              │     Domain: https://workspace.nxon.io         │
                              └───────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       │                              │                              │
                       ▼                              ▼                              ▼
        ┌────────────────────────────┐ ┌────────────────────────────┐ ┌────────────────────────────┐
        │ 🏢 AHMEDABAD CLUSTER NODE   │ │ 🏢 SURAT CLUSTER NODE      │ │ 🏢 VADODARA CLUSTER NODE   │
        │ Edge Server 1 (GPU/Docker) │ │ Edge Server 2 (GPU/Docker) │ │ Edge Server 3 (GPU/Docker) │
        │ 3_ANPR_EDGE_WORKER         │ │ 3_ANPR_EDGE_WORKER         │ │ 3_ANPR_EDGE_WORKER         │
        │ Processes 100-500 Cameras  │ │ Processes 100-500 Cameras  │ │ Processes 100-500 Cameras  │
        └────────────────────────────┘ └────────────────────────────┘ └────────────────────────────┘
```

---

### Step 1: Server A (Central Headquarters)
Run only the Central Platform, Database, and MediaMTX on the main server:
```bash
# On Server A (Central Server):
cd sentinel-cctv-platform
docker-compose up -d --build central-platform postgres stream-gateway
```
*Central Platform will be accessible at `https://workspace.nxon.io/gujraksha` (or `http://<SERVER_A_IP>:3000`).*

---

### Step 2: Server B, C, D... (Remote District Edge Cluster Nodes)

On each remote district edge server / GPU node:

#### 🐳 **Option A: Run District Edge Node via Docker (Recommended)**

```bash
cd sentinel-cctv-platform/3_ANPR_EDGE_WORKER

# Build the Edge Worker Image
docker build -t gujraksha-ai-worker .

# Run container connected to Central Server A (with NVIDIA GPU enabled)
docker run -d \
  --name gujraksha_edge_node_ahmedabad \
  --restart unless-stopped \
  --gpus all \
  -e CENTRAL_URL="https://workspace.nxon.io/gujraksha/api/v1" \
  -e TRITON_BACKEND="auto" \
  -e MAX_CAPACITY=100 \
  -e CUDA_VISIBLE_DEVICES=0 \
  gujraksha-ai-worker
```

#### 🐍 **Option B: Run District Edge Node via Python Standalone**

```bash
cd sentinel-cctv-platform/3_ANPR_EDGE_WORKER

# 1. Setup Python Virtual Environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 2. Start worker connected to Central Server A
python3 anpr_worker.py \
  --central-url "https://workspace.nxon.io/gujraksha/api/v1" \
  --backend auto \
  --max-capacity 100
```

> **Automatic Load Balancing:** Har Edge Worker Node automatically Central Platform se connect hokar cameras fetch karta hai, local GPU par ANPR & Hotlist Match execute karta hai, aur real-time vehicle sightings Central Dashboard par sync karta hai.
>
> **Cluster Monitoring:** Central Platform me **"ANPR Intelligence" ➔ "Distributed AI ANPR Nodes"** tab me saare connected cluster nodes live monitor hote hain!

---

## 💻 Method 3: Manual / Standalone Server Run (Node.js & Python)

If running all components manually on a single server without Docker:

### Step 1: PostgreSQL & PostGIS Setup
```bash
sudo apt-get install -y postgresql-16 postgresql-16-postgis-3

sudo -u postgres psql -c "CREATE DATABASE gujraksha;"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gujraksha TO postgres;"
sudo -u postgres psql -d gujraksha -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

---

### Step 2: Start MediaMTX Stream Gateway (WebRTC & RTSP)
```bash
cd 1_STREAM_GATEWAY
./start_gateway.sh
```
*MediaMTX will listen on port `8554` (RTSP) and port `8889` (WebRTC WHEP).*

---

### Step 3: Run Node.js Central Command Platform
```bash
cd 2_CENTRAL_PLATFORM

# 1. Install Node.js dependencies
npm install

# 2. Build Vite Frontend assets
npm run build

# 3. Start Express Production Server
npm start
```
*Platform will start on **`http://localhost:3000`** (and serves **`http://localhost:3000/gujraksha`**).*

To run Node.js in background with PM2:
```bash
sudo npm install -g pm2
pm2 start server.js --name "gujraksha-node"
pm2 save
```

---

### Step 4: Run Live AI Stream Service (Port 8090)
```bash
cd 3_ANPR_EDGE_WORKER

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Start AI Stream Service
python3 ai_stream_service.py --port 8090 &
```

---

### Step 5: Run Background ANPR Edge Worker
```bash
cd 3_ANPR_EDGE_WORKER
source venv/bin/activate

python3 anpr_worker.py --central-url http://127.0.0.1:3000/api/v1 --backend auto --max-capacity 100 &
```

---

## 🔒 Apache Reverse Proxy & SSL Configuration

To deploy on a domain (e.g., `https://workspace.nxon.io/gujraksha`) without affecting existing projects:

### 1. Enable Required Apache Modules:
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl
```

### 2. Apache VirtualHost SSL Configuration:
Edit `/etc/apache2/sites-available/workspace.nxon.io-le-ssl.conf`:

```apache
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName workspace.nxon.io

    DocumentRoot /var/www/html

    <Directory /var/www/html>
        Options FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ProxyPreserveHost On

    # =======================================================
    # 1. Existing Legacy Project (Port 5000 API)
    # =======================================================
    ProxyPass /api http://127.0.0.1:5000/api
    ProxyPassReverse /api http://127.0.0.1:5000/api

    # =======================================================
    # 2. GujRaksha Real-Time AI WebSocket Proxy
    # =======================================================
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule ^/ws/(.*) ws://127.0.0.1:3000/ws/$1 [P,L]
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule ^/gujraksha/ws/(.*) ws://127.0.0.1:3000/ws/$1 [P,L]

    # =======================================================
    # 3. GujRaksha CCTV Platform UI & Backend APIs
    # =======================================================
    ProxyPass /gujraksha http://127.0.0.1:3000/gujraksha
    ProxyPassReverse /gujraksha http://127.0.0.1:3000/gujraksha

    # =======================================================
    # 4. MediaMTX WHEP WebRTC Stream (CCTV Video Stream)
    # =======================================================
    ProxyPass /whep http://127.0.0.1:8889
    ProxyPassReverse /whep http://127.0.0.1:8889

    # SSL Certificates
    SSLCertificateFile /etc/letsencrypt/live/workspace.nxon.io/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/workspace.nxon.io/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf

    ErrorLog ${APACHE_LOG_DIR}/app-error.log
    CustomLog ${APACHE_LOG_DIR}/app-access.log combined
</VirtualHost>
</IfModule>
```

### 3. Test & Reload Apache:
```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

## ⚡ GPU Hardware Acceleration (CUDA / TensorRT)

To enable NVIDIA GPU acceleration inside Docker:

### 1. Install NVIDIA Container Toolkit on Ubuntu:
```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### 2. Verify GPU inside Docker:
```bash
docker run --rm --gpus all nvidia/cuda:12.2.2-base-ubuntu22.04 nvidia-smi
```

---

## 🌐 Port Reference & Network Grid

| Port | Service | Protocol | Access |
|---|---|---|---|
| **`3000`** | GujRaksha Node.js Web App & API | HTTP / WebSocket | Public / Reverse Proxy |
| **`8090`** | AI Vision Stream Service | HTTP / REST | Internal / Proxy |
| **`8554`** | MediaMTX RTSP Server | RTSP / TCP | Cameras & Workers |
| **`8889`** | MediaMTX WebRTC WHEP Server | HTTP (WHEP) | Browser WebRTC |
| **`8888`** | MediaMTX HLS Server | HTTP | Browser HLS fallback |
| **`5433`** | PostgreSQL Spatial DB (Host port) | TCP | Database Client |

---

## 🛠️ Troubleshooting & FAQs

### Q1: `docker-compose: Not supported URL scheme http+docker`
**Cause:** Outdated Python docker-compose v1.
**Fix:**
```bash
sudo curl -SL "https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
```

### Q2: `failed to bind host port 0.0.0.0:5432/tcp: address already in use`
**Fix:** PostgreSQL host port is already mapped to `5433:5432` in `docker-compose.yml`.

### Q3: Updating server after `git pull`
```bash
git pull
docker-compose up -d --build
```

---

## 👨‍💻 Author & License
- **Author:** Fenil Patel
- **Project:** GujRaksha (ગુજ રક્ષા) — CCTV AI & Spatial Sentinel Platform
- **Copyright:** (c) 2026. All Rights Reserved.
