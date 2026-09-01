# 🛡️ GujRaksha (ગુજ રક્ષા) — Complete Project Documentation Index

Welcome to the **GujRaksha Sentinel CCTV & ANPR Platform** documentation hub. The project has been architected and divided into **3 independent, modular parts**:

---

## 📚 3-Tier Distributed Architecture Documentation

| Part | Component | Description & Key Tech | Documentation Link |
| :---: | :--- | :--- | :--- |
| **1** | **`1_STREAM_GATEWAY`** | **MediaMTX Standalone Video Stream Server**<br>• Protocol Gateway (RTSP, WebRTC/WHEP, HLS)<br>• Ingests IP Cameras & Webcams | 📄 [PART1_STREAM_GATEWAY_DOC.md](file:///home/dell-i5/nxon-projects/GujRaksha/sentinel-cctv-platform/docs/PART1_STREAM_GATEWAY_DOC.md) |
| **2** | **`2_CENTRAL_PLATFORM`** | **Statewide Central Command & Control Platform**<br>• 80,000+ CCTV Camera GIS Map & Video Wall<br>• Watchlist & Threat Ingestion Engine<br>• AI Worker Cluster Orchestrator | 📄 [PART2_CENTRAL_PLATFORM_DOC.md](file:///home/dell-i5/nxon-projects/GujRaksha/sentinel-cctv-platform/docs/PART2_CENTRAL_PLATFORM_DOC.md) |
| **3** | **`3_ANPR_EDGE_WORKER`** | **Distributed Python AI ANPR Edge Worker Node**<br>• YOLOv9 Plate Detector + CCT Transformer OCR<br>• $O(1)$ In-Memory 10M Watchlist (150 MB RAM)<br>• Edge-Filtered Alerting (99.9% Bandwidth Saving) | 📄 [PART3_ANPR_EDGE_WORKER_DOC.md](file:///home/dell-i5/nxon-projects/GujRaksha/sentinel-cctv-platform/docs/PART3_ANPR_EDGE_WORKER_DOC.md) |

---

## 🌐 End-to-End System Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Officer as CCC Police Officer (Browser)
    participant Central as Part 2: Central Platform
    participant Worker as Part 3: Python AI Worker
    participant Gateway as Part 1: Stream Gateway
    actor Suspect as Passing Suspect Vehicle

    Note over Gateway: Physical CCTV / Webcam starts streaming
    Worker->>Central: 1. Register Worker Node (Capacity: 100 Cams)
    Central-->>Worker: 2. Worker state: STANDBY + Syncs Watchlist into RAM
    Central->>Worker: 3. Central auto-assigns 100 RTSP streams
    Worker->>Gateway: 4. Connects RTSP (rtsp://host:8554/stream/:id)
    Gateway-->>Worker: 5. Raw H.264 video frames
    
    Suspect->>Gateway: Vehicle passes in front of camera
    Worker->>Worker: 6. YOLOv9 Plate Detection + CCT OCR
    Worker->>Worker: 7. O(1) in-memory hash check (0.0001 ms)
    
    alt Watchlist Target Hit (Wanted Vehicle)
        Worker->>Central: 8. POST /api/v1/anpr/ingest (Threat Event)
        Central->>Officer: 9. Real-Time Alert Siren + Red Pin on GIS Map
    else Normal Traffic Vehicle
        Worker->>Worker: 10. Local Log (Zero WAN network traffic)
    end

    Officer->>Gateway: 11. Clicks camera on GIS Map -> Instant WebRTC WHEP Stream Playback
```
