# 📡 PART 1: MediaMTX Stream Gateway (Video Streaming Server)
## Complete Technical Documentation & Operations Guide
### GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial Control Platform

---

## 1. Overview & System Purpose

The **Stream Gateway (Part 1)** serves as the high-throughput, low-latency video streaming foundation of the GujRaksha platform. It handles the ingestion, demuxing, and multi-protocol re-streaming of live CCTV video feeds across the state of Gujarat.

In large-scale surveillance deployments (80,000+ cameras), different consumers require different video protocols:
1. **AI Edge Workers (Python / OpenCV)** need raw, lightweight **RTSP** video streams.
2. **Central Web Control Center (React / Chrome / Firefox)** requires sub-second, zero-plugin **WebRTC / WHEP** live playback.
3. **Mobile & Low-Bandwidth Clients** require adaptive **HLS (HTTP Live Streaming)**.

The Stream Gateway abstracts multi-vendor CCTV hardware (Hikvision, Dahua, Matrix, CP Plus, Axis, Honeywell, and local USB/laptop webcams) and exposes standardized, unified stream endpoints for all platform consumers.

```mermaid
graph TD
    subgraph VideoInput [Video Input Sources]
        CAM1["Physical IP Camera (RTSP / ONVIF)"]
        CAM2["Laptop / USB Webcam (/dev/video0)"]
        CAM3["Recorded CCTV MP4 Video Feeds"]
    end

    subgraph StreamGateway [Part 1: MediaMTX Stream Gateway]
        MTX["MediaMTX Live Video Engine"]
        FFM["FFmpeg Real-Time Video Transcoder"]
        MTX --- FFM
    end

    subgraph MultiProtocolEndpoints [Multi-Protocol Output Endpoints]
        EP_RTSP["🔴 RTSP Stream (Port 8554)\nrtsp://IP:8554/stream/:id"]
        EP_WEBRTC["🟢 WebRTC / WHEP (Port 8889)\nhttp://IP:8889/stream/:id/whep"]
        EP_HLS["🟡 HLS Stream (Port 8888)\nhttp://IP:8888/stream/:id/index.m3u8"]
    end

    subgraph Consumers [Platform Consumers]
        AI["Part 3: Distributed Python AI ANPR Workers"]
        WEB["Part 2: Central Command Web UI & Video Wall"]
        MOB["Field Officer Mobile Tablets & VLC"]
    end

    CAM1 --> MTX
    CAM2 --> FFM --> MTX
    CAM3 --> FFM --> MTX

    MTX --> EP_RTSP --> AI
    MTX --> EP_WEBRTC --> WEB
    MTX --> EP_HLS --> MOB
```

---

## 2. Directory & File Structure

```
1_STREAM_GATEWAY/
├── start_gateway.sh        # Unified startup bash script (Handles Camera, Webcam & Gateway modes)
├── README.md               # Quick-start summary
├── PART1_STREAM_GATEWAY_DOC.md # Complete technical documentation
└── tools/
    └── mediamtx/
        ├── mediamtx        # High-performance compiled MediaMTX Go binary
        ├── mediamtx.tar.gz # Download archive
        └── mediamtx.yml    # Master MediaMTX YAML configuration file
```

---

## 3. Protocol Specifications & Port Mapping

| Protocol | Default Port | Endpoint Path Pattern | Target Consumer | Key Characteristics |
| :--- | :---: | :--- | :--- | :--- |
| **RTSP** (Real-Time Streaming Protocol) | `8554` | `rtsp://<HOST_IP>:8554/stream/<STREAM_ID>` | Part 3: Python AI Worker (OpenCV / PyTorch) | Minimal transport overhead, TCP packet delivery, low CPU footprint on decode. |
| **WebRTC / WHEP** (WebRTC HTTP Egress Protocol) | `8889` | `http://<HOST_IP>:8889/stream/<STREAM_ID>/whep` | Part 2: Central CCC Web UI (React Video Wall) | Ultra-low latency (<200 ms), hardware-accelerated browser rendering, zero plugin requirement. |
| **HLS** (HTTP Live Streaming) | `8888` | `http://<HOST_IP>:8888/stream/<STREAM_ID>/index.m3u8` | Mobile devices, Safari, VLC player | Segmented `.ts`/`.m4s` transport, robust over high packet loss networks. |
| **RTMP** (Real-Time Messaging Protocol) | `1935` | `rtmp://<HOST_IP>:1935/stream/<STREAM_ID>` | Broadcast software (OBS Studio) | Legacy ingest and fallback publishing. |

---

## 4. Operational Modes & Command Execution

The `start_gateway.sh` script automates network discovery, binary management, and dynamic configuration generation.

### Mode A: Physical RTSP IP Camera Streaming
Used when connecting to on-field CCTV cameras (e.g. Hikvision, Dahua, CP Plus, Matrix):

```bash
cd 1_STREAM_GATEWAY
./start_gateway.sh rtsp://admin:password@192.168.1.188:554/stream 1
```

* **Parameter 1:** Complete RTSP URL with authentication credentials.
* **Parameter 2 (Optional):** Stream Channel ID (default: `1`).

#### What happens internally:
1. Detects host machine LAN IP (e.g. `192.168.1.50`).
2. Validates MediaMTX binary existence (auto-downloads v1.9.3 if absent).
3. Generates an active configuration file `/tmp/mediamtx_active_<PID>.yml`.
4. Injects an on-demand proxy route for the camera:
   ```yaml
   paths:
     stream/1:
       source: "rtsp://admin:password@192.168.1.188:554/stream"
       sourceOnDemand: no
       rtspTransport: tcp
     all_others:
   ```
5. Launches MediaMTX in foreground with color-coded endpoint URLs.

---

### Mode B: Local Hardware Webcam Streaming
Used for local testing and live demonstrations using the laptop's integrated camera or USB webcam:

```bash
cd 1_STREAM_GATEWAY
./start_gateway.sh webcam 1
```

*(You can also specify specific device nodes like `./start_gateway.sh /dev/video0 1`)*

#### What happens internally:
1. Locates the Video4Linux device (`/dev/video0`).
2. Configures MediaMTX `runOnInit` hook to launch an ultra-fast FFmpeg pipeline:
   ```bash
   ffmpeg -f v4l2 -framerate 30 -video_size 1280x720 -i /dev/video0 \
     -c:v libx264 -preset ultrafast -tune zerolatency \
     -b:v 2000k -maxrate 2500k -bufsize 800k -an \
     -f rtsp -rtsp_transport tcp rtsp://localhost:8554/stream/1
   ```
3. Hardware video frames from webcam are immediately transcoded to H.264 video and streamed simultaneously across RTSP, WebRTC (WHEP), and HLS.

---

### Mode C: Pure Standalone Gateway Mode
Used when external feeds or AI scripts will push streams into MediaMTX directly:

```bash
cd 1_STREAM_GATEWAY
./start_gateway.sh
```

Provides a ready listener on ports `8554`, `8889`, `8888`, and `1935` for any incoming stream path (`stream/1`, `stream/2`, ..., `stream/80000`).

---

## 5. Integration with Other Laptops & System Parts

### Connecting with Part 2 (Central Command Platform)
When the Stream Gateway runs on **Laptop A** (IP: `192.168.1.50`):
1. In Part 2's `.env` configuration file on **Laptop B**, configure:
   ```env
   STREAM_SERVER_HOST=192.168.1.50
   ```
2. The Central Platform will automatically fetch live WebRTC video feeds from:
   `http://192.168.1.50:8889/stream/1/whep`
   and display them on the **Interactive Video Wall** and **GIS Map Camera Modals**.

### Connecting with Part 3 (Python AI ANPR Worker)
When Python AI Workers run on **Laptop C / D / E**:
1. Run the Python worker with the RTSP URL pointing to Laptop A:
   ```bash
   ./start_worker.sh --source rtsp://192.168.1.50:8554/stream/1 http://192.168.1.100:3000/api/v1 GJ-GOV-001
   ```
2. The AI Worker grabs raw H.264 decoded frames at full speed over TCP with zero browser overhead.

---

## 6. Performance & Scale Considerations

1. **Zero Transcoding Overhead for IP Cameras**: When physical RTSP cameras output H.264/H.265, MediaMTX performs **passthrough muxing** (repackaging NAL units into RTP/WebSockets) consuming less than **1% CPU** per 10 active streams.
2. **TCP Transport by Default**: Forced `rtspTransport: tcp` prevents packet loss, gray frame artifacts, and video tearing on unstable Wi-Fi/LAN networks.
3. **Auto-Recovery**: If a camera stream disconnects or network drops, MediaMTX automatically attempts reconnection without restarting the server daemon.
