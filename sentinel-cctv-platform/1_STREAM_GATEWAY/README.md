# 📡 Part 1: MediaMTX Stream Gateway (Video Streaming Server)

Is folder me sirf **2 Simple Options** hain: **RTSP Camera** ya **Webcam**.

---

## 🚀 Option 1: Physical RTSP Camera Chalana

Camera ka RTSP URL piche pass karein:
```bash
./start_gateway.sh rtsp://admin:123456@192.168.1.188:554/stream 1
```

### 📌 Yeh 3 URLs Dikhayega:
1. 🔴 **RTSP Stream (Python AI Worker ke liye):**
   ```
   rtsp://admin:123456@192.168.1.188:554/stream
   ```
2. 🟢 **WebRTC / WHEP URL (Central Web Browser & Video Wall ke liye):**
   ```
   http://<STREAM_SERVER_IP>:8889/stream/1/whep
   ```
3. 🟡 **HLS Live URL (Mobile ke liye):**
   ```
   http://<STREAM_SERVER_IP>:8888/stream/1/index.m3u8
   ```

---

## 📹 Option 2: Laptop Webcam Chalana

Webcam start karne ke liye:
```bash
./start_gateway.sh webcam 1
```

---

💡 **Note:** `1` camera ka channel number / ID hai. Agar dusra camera ho toh `2` de sakte hain.
