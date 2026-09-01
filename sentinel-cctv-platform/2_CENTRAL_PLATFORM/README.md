# 🏢 Part 2: GujRaksha Central Command Platform (Web & Database)

Yeh folder **Central Command & Control Center** hai. Isme React GIS UI, Video Wall, Camera Registry, Watchlist, Threat Radar Alerts, aur Ingestion APIs shamil hain.

---

## 🎯 Iska Kaam Kya Hai?
1. **GIS Spatial Map & Video Wall:** Gujarat ke sabhi CCTV cameras ko live map par display karta hai aur WebRTC/WHEP ke through real-time feeds play karta hai.
2. **Watchlist Management:** Flagged / stolen suspect gaadiyo ka database manage karta hai.
3. **Real-Time Alert Dispatch:** Jab Part 3 (Python AI Worker) koi suspect plate detect karta hai, toh Central Server turant alert dispatch karke map aur sidebar radar me show karta hai.
4. **PostgreSQL & JSON Persistence:** Alert clear karne ya dismiss karne par database permanent update rehta hai.

---

## 🚀 How to Run on Laptop B:

### Step 1: Install Dependencies
```bash
chmod +x *.sh
npm install
```

### Step 2: Start Central Server
```bash
./start_central.sh
```
Terminal me aapko Central Server ka **Web URL** aur **Ingestion API URL** mil jayega:
- **Web UI:** `http://<CENTRAL_IP>:3000/`
- **Ingest API:** `http://<CENTRAL_IP>:3000/api/v1/anpr/ingest`

---

## ⚙️ Configuration with Other Laptops:

- **MediaMTX Stream Server (Part 1):** Agar MediaMTX Laptop A par chal raha hai (e.g. `192.168.1.50`), toh `.env` me add karein:
  ```env
  STREAM_SERVER_HOST=192.168.1.50
  ```
  Isse Central Platform saare cameras ke WebRTC/WHEP URL automatically Laptop A se pull karega (`http://192.168.1.50:8889/stream/.../whep`).

- **Python AI Worker (Part 3):** Python AI workers ko Central Server ka IP pass karein:
  ```bash
  --central-url http://<CENTRAL_IP>:3000/api/v1
  ```
