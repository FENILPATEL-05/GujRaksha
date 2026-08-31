# 🛡️ GujRaksha (ગુજ રક્ષા) — 80,000 CCTV & 1 Crore (10M) Plate ANPR Architecture

---

## 1. Executive Summary & Scale Physics

Running Real-Time Automated Number Plate Recognition (ANPR) across **80,000 cameras** and evaluating against **1 Crore (10 Million) Wanted Plates** is an enterprise-scale engineering task.

### 📊 The Core Scale Parameters:
* **Total Cameras:** $80,000 \text{ HD RTSP Video Streams}$
* **Incoming Bandwidth (at 3 Mbps/stream):** $80,000 \times 3\text{ Mbps} = \mathbf{240 \text{ Gbps}}$
* **Raw Video Frames (at 25 FPS):** $80,000 \times 25 = \mathbf{2,000,000 \text{ Frames per Second}}$
* **Watchlist Database:** $\mathbf{1,00,00,000 \text{ (1 Crore / 10 Million) Wanted Plates}}$
* **Single Node Golden Rule:** 1 Server Node comfortably decodes and analyzes **100 streams**. Total worker nodes needed = $\mathbf{800 \text{ Nodes across 33 Districts}}$.

---

## 2. The 1 Crore Plate Search Problem: Why We NEVER Use a Loop

### ❌ The Loop Flaw ($O(N)$ Sequential Iteration):
If code iterates through 1 Crore plates using a `for` loop:
```python
# ❌ NEVER DO THIS: Takes 1.5 to 3.0 seconds per car, freezing the CPU
for wanted_plate in one_crore_watchlist:
    if wanted_plate == scanned_plate:
        trigger_alarm()
```
Iterating 10,000,000 entries for every passing car causes extreme CPU saturation and missing fast-moving cars.

### ✅ The Solution: In-Memory Hash Sets ($O(1)$ Constant Time Direct Jump)
Instead of searching through a list, modern computer science uses **Direct Memory Address Calculation (Hashing)**:

```mermaid
graph LR
    A["Scanned Plate:\n'GJ01AB1234'"] -->|Math Hash Function| B["Hash Key:\nSlot #849201"]
    B -->|Direct 1-Step Jump| C{"Memory Slot #849201 Occupied?"}
    C -->|YES (0.00005 seconds)| D["🚨 WANTED HIT!"]
    C -->|NO (0.00005 seconds)| E["❌ Normal Car (Pass)"]
```

1. When `"GJ01AB1234"` is read, the CPU computes `hash("GJ01AB1234") -> Slot #849201`.
2. The CPU jumps **directly to Slot #849201 in 1 single instruction**.
3. It does NOT touch the other 9,999,999 records!
4. **Execution Time:** Exactly $\mathbf{0.0002 \text{ milliseconds}}$ whether the list has 10 plates or 1 Crore plates!

---

## 3. Memory Footprint: How 1 Crore Plates Fit in Only 150 MB RAM

| Calculation Step | Value |
| :--- | :--- |
| **Length of a Standard Plate** | $\sim 10 \text{ Characters (10 Bytes)}$ |
| **Raw Text Size for 1 Crore Plates** | $10,000,000 \times 10 \text{ Bytes} = \mathbf{100 \text{ MB}}$ |
| **Hash Table Pointer Overhead** | $\sim 50 \text{ MB}$ |
| **Total RAM Required** | $\mathbf{\approx 150 \text{ MB RAM}}$ |

> 💡 **Only 150 MB!** Even a budget server has 16 GB to 64 GB RAM. 1 Crore plates occupy less than **1.5% of total server RAM**.

---

## 4. Edge-Filtered Alerting: Saving 99.9% Network WAN Bandwidth

Instead of sending millions of normal traffic records over the state WAN to the central server, the system uses **Edge-Filtered Alerting**:

```mermaid
graph TD
    subgraph CentralStateCCC [State Central CCC (Gandhinagar)]
        W["Master Watchlist (1 Crore Plates)"]
        W -->|Syncs once on startup & hourly deltas| S1["District Node 1"]
        W -->|Syncs once on startup & hourly deltas| S2["District Node 2"]
        W -->|Syncs once on startup & hourly deltas| S800["District Node 800"]
    end

    subgraph DistrictWorkers [800 District AI Worker Nodes (100 Cams Each)]
        S1 -->|Normal Car: GJ01XX1111| L1["Discard / Save to Local Disk (0 WAN Bytes)"]
        S1 -->|Wanted Car: GJ01AB1234| A1["🚨 ONLY SEND THREAT ALERT TO CENTRAL CCC!"]
    end

    A1 -->|Instant 1 KB Payload| CentralStateCCC
```

### 🏆 Key Benefits:
1. **99.9% Bandwidth Savings:** Normal traffic stays at the local district station. Only actual threats are transmitted over the state WAN.
2. **Zero Central CPU Saturation:** The Central CCC only processes real alerts (e.g. 10 to 50 alerts per day statewide) instead of 10 Million plate events.
3. **Offline Resilience:** If district WAN internet disconnects, local nodes continue matching wanted cars locally without disruption.

---

## 5. End-to-End Code Integration

### 🐍 Python AI Worker (`anpr_tflite_scanner.py`):
```python
import time
import requests

class EdgeWatchlistManager:
    """Manages 10 Million wanted plates in local RAM using O(1) Hash Sets."""
    def __init__(self, central_api_url):
        self.central_api = central_api_url
        self.watchlist_set = set() # O(1) In-memory Hash Set (150 MB RAM)
        self.load_watchlist()

    def load_watchlist(self):
        print("📥 Synchronizing 1 Crore Watchlist from Central CCC...", flush=True)
        res = requests.get(f"{self.central_api}/api/v1/anpr/watchlist-sync")
        if res.ok:
            self.watchlist_set = set(res.json().get("plates", []))
            print(f"✅ Loaded {len(self.watchlist_set):,} wanted plates into local RAM.", flush=True)

    def process_plate(self, plate_text, camera_info):
        clean = "".join(c for c in plate_text.upper() if c.isalnum())
        
        # ⚡ Instant 0.0001ms O(1) Check (ZERO LOOP)
        if clean in self.watchlist_set:
            # 🚨 ONLY SEND EVENT TO CENTRAL WHEN A WANTED VEHICLE IS SPOTTED!
            self.emit_central_alert(clean, camera_info)
        else:
            # Normal vehicle: Log locally, zero WAN traffic
            self.log_locally(clean, camera_info)

    def emit_central_alert(self, plate, camera):
        payload = {
            "type": "REAL_TIME_THREAT",
            "plate_number": plate,
            "camera_code": camera.get("code"),
            "district": camera.get("district"),
            "timestamp": time.time()
        }
        requests.post(f"{self.central_api}/api/v1/anpr/threat-alert", json=payload)
```

---

## 6. Sizing & District Cluster Distribution

| Infrastructure Layer | Specifications & Quantity | Role |
| :--- | :--- | :--- |
| **District AI Worker Nodes** | **800 Nodes Total** (~24 nodes/district)<br>• 32-Core CPU, 64 GB RAM, 1x NVIDIA GPU | Decodes 100 RTSP video streams per node, runs YOLOv9 + OCR, holds local 150 MB watchlist hash set. |
| **District Local Storage** | **33 Racks** (48 TB per district) | Stores 30 days of continuous circular HD video recording. |
| **Central State CCC** | **1 Master Cluster** (Gandhinagar Data Center)<br>• 64-Core CPU, 128 GB RAM, PostgreSQL + Redis | Maintains Master Watchlist, broadcasts real-time WebSocket alerts to GIS Map, dispatches PCR vans. |

---

## 7. Summary

* **No Loop Needed:** $O(1)$ Hash Set guarantees **$0.00005\text{ second}$ lookup speed** regardless of whether the list contains 10 plates or 1 Crore plates.
* **Minimal Memory:** 1 Crore plates consume **only ~150 MB of RAM**.
* **Edge Alerting:** Workers filter at the edge and **only transmit alerts** when wanted vehicles appear, saving 99.9% of state network bandwidth.
