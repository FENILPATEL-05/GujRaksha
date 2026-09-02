#!/usr/bin/env python3
"""
GujRaksha AI Video Stream Service (Replicating Sentinel CCTV Registry Core AI Engine)
Reference: /home/dell-i5/sentinel/cctv-registry/backend/app/api/ai_stream.py

Provides:
- Real-time video frame grabbing (RTSP/Webcam/HTTP)
- ByteTrack & IoU Persistent Multi-Object Tracking
- Movement Trails (Neon Trajectory Paths)
- Virtual Intrusion Security Perimeter Zone (Polygonal Fence)
- Loitering / Dwell Anomaly Detection (> 8.0s)
- Top Performance & Stats HUD (FPS, Inference Latency, Live Object Counts)
- High-Performance MJPEG Stream Endpoint (/api/v1/ai/video_feed)
- Live Telemetry Stats Endpoint (/api/v1/ai/stats)
"""

import os
import sys
import time
import json
import logging
import threading
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from typing import Optional, List, Dict, Any

import cv2
import numpy as np

# Add worker directory to path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from movement_tracking import TrailTracker
from intrusion_detection import IntrusionZone
from anomaly_detection import DwellTracker
from bytetrack_tracker import ByteTrackTracker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AIStreamService")

# Force RTSP over TCP
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

# Strictly filtered 5 surveillance target classes (+ COCO class IDs)
COCO_TARGET_CLASSES = {
    0: "person",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}
SURVEILLANCE_TARGET_NAMES = set(COCO_TARGET_CLASSES.values())

# Global AI Stats
current_ai_stats: Dict[str, Any] = {
    "camera_id": "unknown",
    "is_active": False,
    "backend_engine": "OpenCV DNN (ONNX GPU/CPU)",
    "current_frame_counts": {},
    "total_unique_counts": {},
    "active_dwell_alerts": [],
    "intrusion_alerts": [],
    "last_pts_ms": 0.0,
    "infer_time_ms": 0.0
}


class OpenCVONNXDetector:
    """High-Performance YOLOv8 Detector using OpenCV DNN (Zero external pip deps)"""
    def __init__(self, model_path: Optional[str] = None, conf_thresh: float = 0.30, iou_thresh: float = 0.45):
        if model_path is None or not os.path.exists(model_path):
            candidates = [
                os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/models/onnx/object_detection.onnx"),
                os.path.join(SCRIPT_DIR, "models/object_detection.onnx"),
                "/home/dell-i5/nxon-projects/GujRaksha/sentinel-cctv-platform/2_CENTRAL_PLATFORM/models/onnx/object_detection.onnx"
            ]
            for c in candidates:
                if os.path.exists(c):
                    model_path = os.path.abspath(c)
                    break

        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.net = None
        self.input_size = 640

        if model_path and os.path.exists(model_path):
            try:
                self.net = cv2.dnn.readNetFromONNX(model_path)
                # Try CUDA backend first, fallback to CPU
                try:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                    current_ai_stats["backend_engine"] = "OpenCV DNN (CUDA GPU)"
                    logger.info("✅ ONNX Model running on CUDA GPU")
                except Exception:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                    current_ai_stats["backend_engine"] = "OpenCV DNN (CPU)"
                    logger.info("✅ ONNX Model running on CPU")
            except Exception as e:
                logger.error(f"❌ Failed to load ONNX model: {e}")

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if self.net is None or frame is None or frame.size == 0:
            return []

        h, w = frame.shape[:2]
        # Letterbox / resize for YOLO input (640x640)
        blob = cv2.dnn.blobFromImage(frame, 1/255.0, (self.input_size, self.input_size), swapRB=True, crop=False)
        self.net.setInput(blob)
        outputs = self.net.forward()

        # Parse YOLOv8 output [1, 84, 8400]
        preds = outputs[0]
        if preds.shape[0] < preds.shape[1]:
            preds = preds.T

        boxes = []
        scores = []
        class_ids = []

        x_scale = w / self.input_size
        y_scale = h / self.input_size

        for row in preds:
            cx, cy, bw, bh = row[0:4]
            class_scores = row[4:]
            cls_id = int(np.argmax(class_scores))
            score = float(class_scores[cls_id])

            if cls_id in COCO_TARGET_CLASSES and score >= self.conf_thresh:
                x1 = int((cx - bw / 2) * x_scale)
                y1 = int((cy - bh / 2) * y_scale)
                x2 = int((cx + bw / 2) * x_scale)
                y2 = int((cy + bh / 2) * y_scale)

                x1 = max(0, min(w - 1, x1))
                y1 = max(0, min(h - 1, y1))
                x2 = max(0, min(w - 1, x2))
                y2 = max(0, min(h - 1, y2))

                boxes.append([x1, y1, x2 - x1, y2 - y1])
                scores.append(score)
                class_ids.append(cls_id)

        if not boxes:
            return []

        indices = cv2.dnn.NMSBoxes(boxes, scores, self.conf_thresh, self.iou_thresh)
        detections = []
        for idx in indices:
            i = idx if isinstance(idx, (int, np.integer)) else idx[0]
            x, y, bw, bh = boxes[i]
            cls_id = class_ids[i]
            detections.append({
                "box": [x, y, x + bw, y + bh],
                "confidence": scores[i],
                "class_id": cls_id,
                "label": COCO_TARGET_CLASSES[cls_id]
            })

        return detections


# Initialize Global Object Detector
detector = OpenCVONNXDetector()

# Initialize Global Plate Detector and OCR
plate_detector = None
plate_ocr = None

try:
    from anpr_worker import PlateDetectorONNX, PlateOCRONNX, normalize_ocr_text, HAS_ONNXRUNTIME
    p_det_path = os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/models/onnx/plate_detector.onnx")
    p_ocr_path = os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/models/onnx/plate_ocr.onnx")
    if not os.path.exists(p_det_path):
        p_det_path = "/home/dell-i5/nxon-projects/GujRaksha/sentinel-cctv-platform/2_CENTRAL_PLATFORM/models/onnx/plate_detector.onnx"
    if not os.path.exists(p_ocr_path):
        p_ocr_path = "/home/dell-i5/nxon-projects/GujRaksha/sentinel-cctv-platform/2_CENTRAL_PLATFORM/models/onnx/plate_ocr.onnx"

    if HAS_ONNXRUNTIME and os.path.exists(p_det_path):
        plate_detector = PlateDetectorONNX(p_det_path)
        logger.info("✅ AI Stream: Plate Detector Loaded")
    if HAS_ONNXRUNTIME and os.path.exists(p_ocr_path):
        plate_ocr = PlateOCRONNX(p_ocr_path)
        logger.info("✅ AI Stream: Plate OCR Model Loaded")
except Exception as e:
    logger.warning(f"Plate models not loaded in AI stream: {e}")


def create_placeholder_frame(text: str) -> np.ndarray:

    """Creates a placeholder frame for connection/error states."""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    y0, dy = 180, 35
    for i, line in enumerate(text.split('\n')):
        y = y0 + i * dy
        cv2.putText(frame, line, (40, y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2)
    return frame


def generate_frames(
    source: str,
    enable_trails: bool = True,
    enable_dwell: bool = False,
    enable_zone: bool = False,
    zone_polygon: Optional[List[List[int]]] = None
):

    """
    Generator yielding multipart MJPEG frames with full OpenCV HUD annotations.
    Replicates exact reference logic from sentinel-cctv-registry.
    """
    global current_ai_stats

    stream_trail_tracker = TrailTracker(max_trail_length=45)
    stream_dwell_tracker = DwellTracker(dwell_threshold=8.0)
    byte_tracker = ByteTrackTracker(max_lost=25, iou_thresh=0.25, high_conf_thresh=0.25)

    if str(source).isdigit():
        cap = cv2.VideoCapture(int(source), cv2.CAP_V4L2)
    else:
        cap = cv2.VideoCapture(str(source), cv2.CAP_FFMPEG)

    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    backoff = 2
    max_backoff = 30
    current_ai_stats["is_active"] = True
    intrusion_zone = None

    while True:
        if not cap.isOpened():
            logger.info(f"[AI Stream] Reconnecting to {source} in {backoff}s...")
            frame = create_placeholder_frame(f"Stream Connecting...\nReconnecting in {backoff}s")
            ret, buffer = cv2.imencode('.jpg', frame)
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

            time.sleep(backoff)
            if str(source).isdigit():
                cap = cv2.VideoCapture(int(source), cv2.CAP_V4L2)
            else:
                cap = cv2.VideoCapture(str(source), cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            backoff = min(backoff * 2, max_backoff)
            continue

        # Flush buffer for live stream
        if str(source).startswith("rtsp://") or str(source).startswith("rtsps://"):
            cap.grab()

        success, frame = cap.read()
        if not success or frame is None or frame.shape[0] < 50:
            logger.warning("[AI Stream] Frame grab failed. Reconnecting...")
            cap.release()
            time.sleep(1.0)
            if str(source).isdigit():
                cap = cv2.VideoCapture(int(source), cv2.CAP_V4L2)
            else:
                cap = cv2.VideoCapture(str(source), cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            backoff = 2
            continue

        backoff = 2
        pts_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        current_ai_stats["last_pts_ms"] = pts_ms
        current_epoch = time.time()

        h, w = frame.shape[:2]

        # 1. Initialize Intrusion Zone (Only if explicitly enabled and polygon provided)
        if enable_zone and intrusion_zone is None and zone_polygon and len(zone_polygon) >= 3:
            intrusion_zone = IntrusionZone(zone_polygon)
        elif not enable_zone or not zone_polygon:
            intrusion_zone = None


        annotated_frame = frame.copy()
        dwell_alerts_list = []
        intrusion_active = False
        intrusion_events = []
        tracked_objects = []

        # 2. Run Object Detection & ByteTrack
        t_start = time.time()
        raw_dets = detector.detect(frame)
        infer_time_ms = (time.time() - t_start) * 1000.0

        if raw_dets:
            tracked_objects = byte_tracker.update(raw_dets)

        frame_counts = {}

        # 3. Process Tracked Detections (Trails, Zone Breaches, Loitering, Bounding Boxes)
        for obj in tracked_objects:
            x1, y1, x2, y2 = map(int, obj["box"])
            cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
            cls_name = obj["label"]
            track_id = obj.get("track_id")

            frame_counts[cls_name] = frame_counts.get(cls_name, 0) + 1

            # 3.1. Movement Trajectory Trails
            if enable_trails and track_id is not None:
                stream_trail_tracker.update(cls_name, track_id, cx, cy, epoch=current_epoch)
                trail_pts = stream_trail_tracker.get_points(cls_name, track_id)
                if len(trail_pts) > 1:
                    for i in range(1, len(trail_pts)):
                        cv2.line(annotated_frame, trail_pts[i - 1], trail_pts[i], (0, 215, 255), 2)
                    cv2.circle(annotated_frame, (cx, cy), 4, (0, 255, 255), -1)

            # 3.2. Intrusion Zone Perimeter Breach Check
            is_inside_zone = False
            if intrusion_zone and track_id is not None:
                inside, entered, center_pt = intrusion_zone.check(cls_name, track_id, (x1, y1, x2, y2))
                if inside:
                    intrusion_active = True
                    is_inside_zone = True
                    intrusion_events.append(f"{cls_name} #{track_id}")
                    cv2.circle(annotated_frame, center_pt, 7, (0, 0, 255), -1)

            # 3.3. Dwell Loitering Anomaly Check
            is_loitering = False
            dwell_time = 0.0
            if enable_dwell and track_id is not None:
                is_loitering, dwell_time = stream_dwell_tracker.update(cls_name, track_id, inside=True)
                if is_loitering or dwell_time > 8.0:
                    is_loitering = True
                    dwell_alerts_list.append(f"{cls_name} #{track_id} ({dwell_time:.1f}s)")

            # 3.4. Draw Crisp Bounding Box & Label Badge
            if is_loitering or is_inside_zone:
                box_color = (0, 0, 255)  # Red for Alert
            elif cls_name == "person":
                box_color = (255, 128, 0)  # Orange/Blue for Person
            elif cls_name == "motorcycle":
                box_color = (255, 0, 200)  # Magenta for 2-Wheeler
            else:
                box_color = (0, 255, 0)  # Green for Vehicles

            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), box_color, 2)

            label = f"{cls_name.upper()}" + (f" #{track_id}" if track_id is not None else "")
            if is_loitering:
                label += f" [LOITERING {dwell_time:.0f}s]"
            elif is_inside_zone:
                label += " [INTRUSION]"

            (w_txt, h_txt), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
            cv2.rectangle(annotated_frame, (x1, max(y1 - 20, 0)), (x1 + w_txt + 6, max(y1, 20)), box_color, -1)
            cv2.putText(annotated_frame, label, (x1 + 3, max(y1 - 5, 15)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1)

        # 3.5. License Plate Detection & High-Contrast ANPR Tag Drawing
        if plate_detector is not None:
            try:
                raw_plates = plate_detector.detect(frame, conf_thresh=0.20, iou_thresh=0.45)
                if raw_plates:
                    frame_counts["plates"] = len(raw_plates)
                for px1, py1, px2, py2, pconf in raw_plates:
                    p_text = ""
                    if plate_ocr is not None:
                        p_text, _ = plate_ocr.recognize(frame, (px1, py1, px2, py2))
                    cleaned_p = normalize_ocr_text(p_text) if p_text else ""

                    # Draw Bright Yellow Box on Plate
                    cv2.rectangle(annotated_frame, (px1, py1), (px2, py2), (0, 230, 255), 2)

                    p_label = f"PLATE: {cleaned_p}" if cleaned_p else "LICENSE_PLATE"
                    (pw, ph), _ = cv2.getTextSize(p_label, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
                    cv2.rectangle(annotated_frame, (px1, max(py1 - 20, 0)), (px1 + pw + 8, max(py1, 20)), (0, 230, 255), -1)
                    cv2.putText(annotated_frame, p_label, (px1 + 4, max(py1 - 5, 15)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 0, 0), 2)
            except Exception:
                pass

        # 4. Draw Intrusion Zone (Virtual Security Fence)

        if intrusion_zone:
            intrusion_zone.draw(annotated_frame, active=intrusion_active)
            zone_label = "RESTRICTED PERIMETER ZONE" if not intrusion_active else "!!! PERIMETER BREACH DETECTED !!!"
            z_color = (0, 0, 255) if intrusion_active else (0, 255, 0)
            cv2.putText(annotated_frame, zone_label, (int(w * 0.18), int(h * 0.43)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.52, z_color, 2)

        # 5. Top Left HUD: Engine & Performance
        engine_tag = current_ai_stats["backend_engine"]
        obj_total = len(tracked_objects)
        hud_text = f"[{engine_tag}] {infer_time_ms:.1f}ms | PTS: {pts_ms:.0f}ms | Active: {obj_total}"
        cv2.rectangle(annotated_frame, (5, 5), (460, 36), (0, 0, 0), -1)
        cv2.putText(annotated_frame, hud_text, (10, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 0), 2)

        # 6. Top Right HUD: Live Object Counts Summary
        counts_str = " | ".join([f"{k.upper()}: {v}" for k, v in frame_counts.items()]) or "SCANNING..."
        (cw, ch), _ = cv2.getTextSize(counts_str, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(annotated_frame, (w - cw - 25, 5), (w - 5, 36), (0, 0, 0), -1)
        cv2.putText(annotated_frame, counts_str, (w - cw - 18, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # 7. Bottom Alert Banners
        if dwell_alerts_list:
            cv2.rectangle(annotated_frame, (5, 42), (460, 72), (0, 0, 180), -1)
            cv2.putText(annotated_frame, f"LOITERING ANOMALY: {', '.join(dwell_alerts_list[:2])}",
                        (10, 63), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

        if intrusion_events:
            cv2.rectangle(annotated_frame, (5, 78), (460, 108), (0, 0, 220), -1)
            cv2.putText(annotated_frame, f"PERIMETER BREACH: {', '.join(intrusion_events[:2])}",
                        (10, 99), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

        # Update telemetry stats
        current_ai_stats["current_frame_counts"] = frame_counts
        current_ai_stats["active_dwell_alerts"] = dwell_alerts_list
        current_ai_stats["intrusion_alerts"] = intrusion_events
        current_ai_stats["infer_time_ms"] = infer_time_ms

        ret, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 78])
        if not ret:
            continue

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

    cap.release()
    current_ai_stats["is_active"] = False


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


class AIStreamRequestHandler(BaseHTTPRequestHandler):
    """Handles HTTP MJPEG streaming and stats requests"""
    def log_message(self, format, *args):
        # Suppress routine log spam
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path in ["/api/v1/ai/video_feed", "/ai/video_feed"]:
            source = params.get("source", ["0"])[0]
            trails = params.get("trails", ["true"])[0].lower() == "true"
            dwell = params.get("dwell", ["false"])[0].lower() == "true"
            zone = params.get("zone", ["false"])[0].lower() == "true"
            zone_pts_raw = params.get("zone_pts", [None])[0]


            zone_pts = None
            if zone_pts_raw:
                try:
                    zone_pts = json.loads(zone_pts_raw)
                except Exception:
                    pass

            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            try:
                for frame_bytes in generate_frames(source, trails, dwell, zone, zone_pts):
                    self.wfile.write(frame_bytes)
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception as e:
                logger.error(f"Stream client disconnected: {e}")

        elif path in ["/api/v1/ai/stats", "/ai/stats"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(current_ai_stats).encode("utf-8"))

        elif path in ["/health", "/api/health"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "UP", "service": "AI Stream Service"}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()


def start_ai_stream_server(host: str = "0.0.0.0", port: int = 8090):
    """Launches the threaded AI video stream server"""
    server = ThreadedHTTPServer((host, port), AIStreamRequestHandler)
    logger.info(f"🚀 GujRaksha AI Video Stream Server running on http://{host}:{port}/api/v1/ai/video_feed")
    server.serve_forever()


if __name__ == "__main__":
    port = 8090
    for arg in sys.argv[1:]:
        if arg.isdigit():
            port = int(arg)
        elif arg.startswith("--port="):
            try:
                port = int(arg.split("=")[1])
            except ValueError:
                pass
    start_ai_stream_server(port=port)

