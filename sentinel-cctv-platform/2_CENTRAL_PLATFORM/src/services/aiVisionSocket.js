/**
 * GujRaksha (ગુજ રક્ષા) — Single Shared WebSocket Manager for AI Vision
 * Maintains ONE continuous WebSocket connection for the entire application.
 */

class VisionSocketClient {
  constructor() {
    this.ws = null;
    this.subscribers = new Map(); // cameraCode -> Set of callback functions
    this.activeCameraCode = "GJ-GOV-001";
    this.isConnected = false;
    this.reconnectTimer = null;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = typeof window !== "undefined" ? (window.location.host || "localhost:3000") : "localhost:3000";
      const wsUrl = `${protocol}//${host}/ws/ai-vision`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        if (this.activeCameraCode) {
          this.send({ type: "SUBSCRIBE", camera_code: this.activeCameraCode });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === "STREAM_AI_DETECTIONS") {
            const camCode = (data.camera_code || "").toUpperCase();
            const camId = (data.camera_id || "").toUpperCase();
            const getDigits = (str) => String(str || '').replace(/\D/g, '');
            const camCodeNum = getDigits(camCode);
            const camIdNum = getDigits(camId);

            const totalSubs = this.subscribers.size;

            for (const [code, callbacks] of this.subscribers.entries()) {
              const upperCode = (code || "").toUpperCase();
              const codeNum = getDigits(upperCode);

              const isMatch = totalSubs === 1 ||
                              upperCode === camCode || upperCode === camId || upperCode === "ALL" ||
                              (camCode && camCode.includes(upperCode)) || (upperCode && upperCode.includes(camCode)) ||
                              (camId && camId.includes(upperCode)) || (upperCode && upperCode.includes(camId)) ||
                              (codeNum && (codeNum === camCodeNum || codeNum === camIdNum));

              if (isMatch) {
                callbacks.forEach(cb => {
                  try {
                    cb(data.detections || [], data.counts || null);
                  } catch (err) {
                    console.error("Error in AI vision callback:", err);
                  }
                });
              }
            }
          }
        } catch (err) {
          console.error("Error parsing WebSocket message in aiVisionSocket:", err);
        }
      };

      this.ws.onerror = () => {};

      this.ws.onclose = () => {
        this.isConnected = false;
        this.ws = null;
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 2000);
        }
      };
    } catch (_) {
      this.isConnected = false;
      this.ws = null;
    }
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  subscribe(cameraCode, callback) {
    if (!cameraCode || !callback) return;
    this.connect();

    this.activeCameraCode = cameraCode;
    const currentSubs = this.subscribers.get(cameraCode) || new Set();
    currentSubs.add(callback);
    this.subscribers.set(cameraCode, currentSubs);

    this.send({ type: "SUBSCRIBE", camera_code: cameraCode });
  }

  unsubscribe(cameraCode, callback) {
    if (!cameraCode) return;
    const currentSubs = this.subscribers.get(cameraCode);
    if (currentSubs) {
      currentSubs.delete(callback);
      if (currentSubs.size === 0) {
        this.subscribers.delete(cameraCode);
      }
    }
  }
}

const aiVisionSocket = new VisionSocketClient();
export default aiVisionSocket;
