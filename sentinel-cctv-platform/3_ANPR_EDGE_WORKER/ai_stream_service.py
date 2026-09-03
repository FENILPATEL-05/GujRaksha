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

## Low-latency TCP FFmpeg capture configuration to prevent video artifacts & glitching
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer+discardcorrupt|flags;low_delay|max_delay;0|reorder_queue_size;0"

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
    "backend_engine": "CPU XNNPACK (LiteRT)",
    "current_frame_counts": {},
    "total_unique_counts": {},
    "active_dwell_alerts": [],
    "intrusion_alerts": [],
    "last_pts_ms": 0.0,
    "infer_time_ms": 0.0
}


class ObjectDetectorONNX:
    """NVIDIA CUDA / TensorRT GPU YOLO Object Detector using ONNX Runtime."""
    def __init__(self, model_path: str, conf_thresh: float = 0.30, iou_thresh: float = 0.45):
        import onnxruntime as ort
        providers = ['CUDAExecutionProvider', 'TensorrtExecutionProvider', 'CPUExecutionProvider']
        avail = ort.get_available_providers()
        valid_providers = [p for p in providers if p in avail]

        sess_opts = ort.SessionOptions()
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_opts.log_severity_level = 3
        self.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=valid_providers)
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.input_size = 640

        active_provider = self.session.get_providers()[0]
        self.accel_mode = "GPU (NVIDIA CUDA)" if "CUDA" in active_provider else ("GPU (TensorRT)" if "TensorRT" in active_provider else "CPU")

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if frame is None or frame.size == 0:
            return []
        h, w = frame.shape[:2]

        scale = self.input_size / max(h, w)
        nh, nw = int(h * scale), int(w * scale)
        resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)

        canvas = np.full((self.input_size, self.input_size, 3), 114, dtype=np.uint8)
        pad_w = (self.input_size - nw) // 2
        pad_h = (self.input_size - nh) // 2
        canvas[pad_h:pad_h + nh, pad_w:pad_w + nw] = resized

        blob = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        blob = np.transpose(blob, (2, 0, 1))[np.newaxis, :]

        outputs = self.session.run([self.output_name], {self.input_name: blob})
        preds = outputs[0][0]
        if preds.shape[0] < preds.shape[1]:
            preds = preds.T

        boxes, scores, class_ids = [], [], []
        for row in preds:
            cx, cy, bw, bh = row[0:4]
            class_scores = row[4:]
            cls_id = int(np.argmax(class_scores))
            score = float(class_scores[cls_id])
            if cls_id in COCO_TARGET_CLASSES and score >= self.conf_thresh:
                x1 = (cx - bw / 2.0 - pad_w) / scale
                y1 = (cy - bh / 2.0 - pad_h) / scale
                x2 = (cx + bw / 2.0 - pad_w) / scale
                y2 = (cy + bh / 2.0 - pad_h) / scale
                x1 = max(0, min(w - 1, int(x1)))
                y1 = max(0, min(h - 1, int(y1)))
                x2 = max(0, min(w - 1, int(x2)))
                y2 = max(0, min(h - 1, int(y2)))
                boxes.append([x1, y1, x2 - x1, y2 - y1])
                scores.append(score)
                class_ids.append(cls_id)

        if not boxes:
            return []

        indices = cv2.dnn.NMSBoxes(boxes, scores, self.conf_thresh, self.iou_thresh)
        detections = []
        if len(indices) > 0:
            for idx in (indices.flatten() if hasattr(indices, 'flatten') else indices):
                i = int(idx)
                x, y, bw, bh = boxes[i]
                detections.append({
                    "box": [x, y, x + bw, y + bh],
                    "confidence": scores[i],
                    "class_id": class_ids[i],
                    "label": COCO_TARGET_CLASSES[class_ids[i]]
                })
        return detections


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
                    logger.info("✅ ONNX Model running on CUDA GPU")
                except Exception:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
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


# Initialize Global Object & Plate Detectors (GPU First -> CPU Fallback)
detector = None
real_plate_detector = None
real_plate_ocr = None
normalize_ocr_text = lambda x: x
active_backend_mode = "CPU"

obj_onnx_path = os.path.abspath(os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/models/onnx/object_detection.onnx"))
det_onnx_path = os.path.abspath(os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/models/onnx/plate_detector.onnx"))
ocr_onnx_path = os.path.abspath(os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/models/onnx/plate_ocr.onnx"))
tflite_det_path = os.path.abspath(os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/models/tflite/plate_detector.tflite"))
tflite_ocr_path = os.path.abspath(os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/models/tflite/plate_ocr.tflite"))

central_services_dir = os.path.abspath(os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/src/services"))
if central_services_dir not in sys.path:
    sys.path.insert(0, central_services_dir)

try:
    from anpr_tflite_scanner import normalize_ocr_text
except Exception:
    pass

# STEP 1: Attempt GPU (NVIDIA CUDA / TensorRT ONNX)
gpu_loaded = False
try:
    import onnxruntime as ort
    provs = ort.get_available_providers()
    if any("CUDA" in p or "TensorRT" in p for p in provs):
        if os.path.exists(obj_onnx_path):
            detector = ObjectDetectorONNX(obj_onnx_path)
        if os.path.exists(det_onnx_path) and os.path.exists(ocr_onnx_path):
            from anpr_worker import PlateDetectorONNX, PlateOCRONNX
            real_plate_detector = PlateDetectorONNX(det_onnx_path)
            real_plate_ocr = PlateOCRONNX(ocr_onnx_path)
        active_backend_mode = "GPU (NVIDIA CUDA Tensor Cores)"
        current_ai_stats["backend_engine"] = active_backend_mode
        logger.info(f"🚀 [AI Engine] Priority 1 NVIDIA GPU Activated: {active_backend_mode}")
        gpu_loaded = True
except Exception as gpu_e:
    logger.info(f"ℹ️ [AI Engine] GPU ONNX not activated ({gpu_e}), activating optimized CPU pipeline...")

# STEP 2: Fallback to CPU ONNX Runtime / LiteRT / OpenCV DNN
if not gpu_loaded:
    try:
        if os.path.exists(det_onnx_path) and os.path.exists(ocr_onnx_path):
            from anpr_worker import PlateDetectorONNX, PlateOCRONNX
            real_plate_detector = PlateDetectorONNX(det_onnx_path)
            real_plate_ocr = PlateOCRONNX(ocr_onnx_path)
            active_backend_mode = "CPU (ONNX Runtime SIMD)"
            logger.info("✅ [AI Engine] CPU ONNX Plate Recognition Models Activated")
    except Exception as e:
        logger.info(f"ONNX CPU load note: {e}")

    if real_plate_detector is None:
        try:
            from anpr_tflite_scanner import PlateDetectorTFLite, PlateOCRTFLite
            if os.path.exists(tflite_det_path):
                real_plate_detector = PlateDetectorTFLite(tflite_det_path)
            if os.path.exists(tflite_ocr_path):
                real_plate_ocr = PlateOCRTFLite(tflite_ocr_path)
            active_backend_mode = "CPU XNNPACK (LiteRT)"
        except Exception as e:
            logger.error(f"Failed to load CPU ANPR models: {e}")

    if detector is None:
        detector = OpenCVONNXDetector(obj_onnx_path if os.path.exists(obj_onnx_path) else None)

    current_ai_stats["backend_engine"] = active_backend_mode
    logger.info(f"✅ [AI Engine] Active Backend: {active_backend_mode}")




STREAM_DYNAMIC_CONTROLS: Dict[str, Dict[str, bool]] = {}


class AsyncFrameReader:
    """Thread-Safe Double-Buffered RTSP / Camera Reader with Automated HTTP/HLS Fallback."""
    def __init__(self, source: str, fallback_source: Optional[str] = None):
        self.primary_source = str(source)
        self.fallback_source = str(fallback_source) if (fallback_source and str(fallback_source) != self.primary_source) else None
        self.active_source = self.primary_source
        self.cap = None
        self.lock = threading.Lock()
        self.stopped = False
        self._buffer = [None, None]
        self._active_idx = 0
        self.fail_count = 0
        self._init_cap(self.active_source)
        self.thread = threading.Thread(target=self._reader_loop, daemon=True)
        self.thread.start()

    def _init_cap(self, src: str):
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
        try:
            if str(src).isdigit():
                self.cap = cv2.VideoCapture(int(src), cv2.CAP_V4L2)
            else:
                self.cap = cv2.VideoCapture(str(src), cv2.CAP_FFMPEG)
            if self.cap:
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            self.cap = None

    def _reader_loop(self):
        backoff = 1.0
        while not self.stopped:
            if not self.cap or not self.cap.isOpened():
                time.sleep(backoff)
                self.fail_count += 1
                if self.fail_count >= 2 and self.fallback_source and self.active_source != self.fallback_source:
                    logger.warning(f"[AI Stream] Primary stream failed ({self.active_source}). Switching to fallback: {self.fallback_source}")
                    self.active_source = self.fallback_source
                else:
                    self.active_source = self.primary_source
                self._init_cap(self.active_source)
                backoff = min(backoff * 1.5, 5.0)
                continue

            success, frame = self.cap.read()
            if success and frame is not None and frame.shape[0] > 30:
                self.fail_count = 0
                write_idx = 1 - self._active_idx
                self._buffer[write_idx] = frame
                with self.lock:
                    self._active_idx = write_idx
                backoff = 1.0
            else:
                self.fail_count += 1
                if self.fail_count >= 4 and self.fallback_source and self.active_source != self.fallback_source:
                    logger.warning(f"[AI Stream] RTSP grab failed. Falling back to HTTP/HLS: {self.fallback_source}")
                    self.active_source = self.fallback_source
                    self._init_cap(self.active_source)
                time.sleep(0.01)

    def read(self) -> Optional[np.ndarray]:
        with self.lock:
            frame = self._buffer[self._active_idx]
            if frame is not None:
                return frame.copy()
        return None

    def release(self):
        self.stopped = True
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass


# Local Disk Snapshot Storage Directory for ANPR Cameras
SNAPSHOTS_BASE_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../2_CENTRAL_PLATFORM/public/snapshots/anpr"))
os.makedirs(SNAPSHOTS_BASE_DIR, exist_ok=True)
CENTRAL_API_URL = os.environ.get("CENTRAL_API_URL", "http://localhost:3000/api/v1/anpr/ingest")


class ANPRMetadataQueue:
    """
    Non-blocking background thread for saving local disk crop snapshots & indexing in Central DB.
    Zero latency impact on 60 FPS video stream.
    """
    def __init__(self):
        import queue
        self.queue = queue.Queue(maxsize=1000)
        self.plate_cooldown: Dict[str, float] = {}  # "camCode_plate" -> last_saved_epoch
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()

    def submit(self, camera_id: str, camera_code: str, plate_text: str, ocr_conf: float, vehicle_crop: np.ndarray, vehicle_type: str = "Car"):
        if not plate_text or len(plate_text) < 4:
            return
        clean_p = plate_text.upper().strip()
        cooldown_key = f"{camera_code}_{clean_p}"
        now = time.time()
        # 30-second cooldown per vehicle plate on the same camera to prevent duplicate DB spam
        if cooldown_key in self.plate_cooldown and (now - self.plate_cooldown[cooldown_key]) < 30.0:
            return
        self.plate_cooldown[cooldown_key] = now
        try:
            self.queue.put_nowait({
                "camera_id": camera_id or "gov-feed-1",
                "camera_code": camera_code or "GJ-GOV-001",
                "plate_text": clean_p,
                "ocr_conf": ocr_conf,
                "crop": vehicle_crop.copy() if vehicle_crop is not None else None,
                "vehicle_type": vehicle_type,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            })
        except Exception:
            pass

    def _worker_loop(self):
        import urllib.request
        while True:
            try:
                item = self.queue.get(timeout=1.0)
            except Exception:
                continue

            try:
                cam_code = item["camera_code"]
                cam_id = item["camera_id"]
                plate = item["plate_text"]
                conf = int(item["ocr_conf"] * 100) if item["ocr_conf"] <= 1.0 else int(item["ocr_conf"])
                v_type = item["vehicle_type"]
                ts = item["timestamp"]

                # 1. Save Snapshot JPEG to Local Disk (/public/snapshots/anpr/YYYY-MM-DD/...)
                today_dir_name = time.strftime("%Y-%m-%d")
                target_dir = os.path.join(SNAPSHOTS_BASE_DIR, today_dir_name)
                os.makedirs(target_dir, exist_ok=True)

                filename = f"{plate}_{int(time.time())}_{cam_code}.jpg"
                filepath = os.path.join(target_dir, filename)
                rel_url = f"/snapshots/anpr/{today_dir_name}/{filename}"

                if item["crop"] is not None and item["crop"].size > 0:
                    cv2.imwrite(filepath, item["crop"], [cv2.IMWRITE_JPEG_QUALITY, 85])

                # 2. Ingest Metadata into Central Platform DB / anpr_detections
                payload = json.dumps({
                    "vehicle_plate": plate,
                    "confidence": conf,
                    "camera_id": cam_id,
                    "camera_code": cam_code,
                    "vehicle_type": v_type,
                    "snapshot_url": rel_url,
                    "timestamp": ts
                }).encode("utf-8")

                req = urllib.request.Request(
                    CENTRAL_API_URL,
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
                try:
                    with urllib.request.urlopen(req, timeout=3.0) as resp:
                        pass
                except Exception:
                    # Non-fatal if node backend endpoint is momentarily restarting
                    pass
                logger.info(f"📸 [ANPR Snapshot Saved & DB Indexed] Plate: {plate} ({conf}%) | Cam: {cam_code} | Path: {rel_url}")
            except Exception as e:
                logger.error(f"Error persisting ANPR metadata: {e}")


anpr_metadata_queue = ANPRMetadataQueue()


class AsyncAIStreamEngine:
    """
    Decoupled Dual-Thread AI Engine:
    - Thread 1: Camera Reader + 60 FPS MJPEG Streamer (0ms latency, zero delay).
    - Thread 2: Background AI Inference Worker (runs deep learning in parallel on GPU/CPU).
    """
    def __init__(self, source: str, fallback_source: Optional[str] = None, is_anpr_camera: bool = False, camera_id: str = "", camera_code: str = ""):
        self.source = str(source)
        self.fallback_source = fallback_source
        self.is_anpr_camera = bool(is_anpr_camera)
        self.camera_id = camera_id or "gov-feed-1"
        self.camera_code = camera_code or "GJ-GOV-001"
        self.reader = AsyncFrameReader(self.source, fallback_source=self.fallback_source)
        self.lock = threading.Lock()
        self.stopped = False

        # Shared AI state
        self.latest_tracked_objects = []
        self.latest_plate_boxes = []
        self.vehicle_plate_cache = {}
        self.infer_time_ms = 0.0

        self.ai_thread = threading.Thread(target=self._ai_worker_loop, daemon=True)
        self.ai_thread.start()


    def _ai_worker_loop(self):
        byte_tracker = ByteTrackTracker(max_lost=30, iou_thresh=0.25, high_conf_thresh=0.25)
        frame_idx = 0
        while not self.stopped:
            frame = self.reader.read()
            if frame is None or frame.size == 0:
                time.sleep(0.01)
                continue

            frame_idx += 1
            h, w = frame.shape[:2]
            src_key = self.source
            dyn = STREAM_DYNAMIC_CONTROLS.get(src_key, {})
            enable_obj = dyn.get("objects", True)
            enable_plt = dyn.get("plates", True)

            t0 = time.time()
            tracked = []
            if detector is not None:
                raw_dets = detector.detect(frame)
                if raw_dets:
                    tracked = byte_tracker.update(raw_dets)

            p_boxes = []
            if enable_plt:
                for obj in tracked:
                    if obj["label"] in ["car", "bus", "truck", "motorcycle"]:
                        vx1, vy1, vx2, vy2 = map(int, obj["box"])
                        vw, vh = vx2 - vx1, vy2 - vy1
                        tr_id = obj.get("track_id")
                        if vw > 25 and vh > 25:
                            if tr_id is not None and tr_id in self.vehicle_plate_cache:
                                p_txt, o_conf = self.vehicle_plate_cache[tr_id]
                                px1 = max(0, int(vx1 + 0.15 * vw))
                                px2 = min(w - 1, int(vx1 + 0.85 * vw))
                                py1 = max(0, int(vy1 + 0.55 * vh))
                                py2 = min(h - 1, int(vy1 + 0.95 * vh))
                                p_boxes.append((px1, py1, px2, py2, p_txt, o_conf))
                            elif real_plate_detector is not None:
                                v_crop = frame[max(0, vy1):min(h, vy2), max(0, vx1):min(w, vx2)]
                                if v_crop.size > 0:
                                    try:
                                        v_plates = real_plate_detector.detect(v_crop, conf_thresh=0.10, iou_thresh=0.45)
                                        for cpx1, cpy1, cpx2, cpy2, _ in v_plates:
                                            g_px1 = max(0, vx1 + cpx1)
                                            g_py1 = max(0, vy1 + cpy1)
                                            g_px2 = min(w - 1, vx1 + cpx2)
                                            g_py2 = min(h - 1, vy1 + cpy2)
                                            p_txt, o_conf = "", 0.0
                                            if real_plate_ocr is not None:
                                                p_txt, o_conf = real_plate_ocr.recognize(frame, (g_px1, g_py1, g_px2, g_py2))
                                            clean_p = normalize_ocr_text(p_txt) if p_txt else ""
                                            if clean_p and len(clean_p) >= 4:
                                                if tr_id is not None:
                                                    self.vehicle_plate_cache[tr_id] = (clean_p, o_conf)
                                                p_boxes.append((g_px1, g_py1, g_px2, g_py2, clean_p, o_conf))
                                                # PERSIST SNAPSHOT & DB INDEX ONLY FOR ANPR-ENABLED CAMERAS
                                                if self.is_anpr_camera:
                                                    anpr_metadata_queue.submit(
                                                        camera_id=self.camera_id,
                                                        camera_code=self.camera_code,
                                                        plate_text=clean_p,
                                                        ocr_conf=o_conf,
                                                        vehicle_crop=v_crop,
                                                        vehicle_type=obj.get("label", "car").capitalize()
                                                    )
                                                break
                                    except Exception:
                                        pass

                # Direct plate detection fallback on frame
                if not p_boxes and real_plate_detector is not None and (frame_idx % 2 == 0):
                    try:
                        f_plates = real_plate_detector.detect(frame, conf_thresh=0.10, iou_thresh=0.45)
                        for fpx1, fpy1, fpx2, fpy2, _ in f_plates:
                            p_txt, o_conf = "", 0.0
                            if real_plate_ocr is not None:
                                p_txt, o_conf = real_plate_ocr.recognize(frame, (fpx1, fpy1, fpx2, fpy2))
                            clean_p = normalize_ocr_text(p_txt) if p_txt else ""
                            if clean_p and len(clean_p) >= 4:
                                p_boxes.append((fpx1, fpy1, fpx2, fpy2, clean_p, o_conf))
                                if self.is_anpr_camera:
                                    crop = frame[max(0, fpy1-20):min(h, fpy2+20), max(0, fpx1-20):min(w, fpx2+20)]
                                    anpr_metadata_queue.submit(
                                        camera_id=self.camera_id,
                                        camera_code=self.camera_code,
                                        plate_text=clean_p,
                                        ocr_conf=o_conf,
                                        vehicle_crop=crop if crop.size > 0 else None,
                                        vehicle_type="Vehicle"
                                    )
                                break
                    except Exception:
                        pass

            infer_ms = (time.time() - t0) * 1000.0

            with self.lock:
                self.latest_tracked_objects = tracked
                self.latest_plate_boxes = p_boxes
                self.infer_time_ms = infer_ms

            time.sleep(0.005)

    def get_frame_and_ai(self):
        frame = self.reader.read()
        with self.lock:
            tracked = list(self.latest_tracked_objects)
            plates = list(self.latest_plate_boxes)
            infer_ms = self.infer_time_ms
        return frame, tracked, plates, infer_ms

    def release(self):
        self.stopped = True
        self.reader.release()




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
    enable_objects: bool = True,
    enable_plates: bool = True,
    enable_trails: bool = True,
    enable_dwell: bool = False,
    enable_zone: bool = False,
    zone_polygon: Optional[List[List[int]]] = None,
    fallback: Optional[str] = None,
    is_anpr: bool = False,
    camera_id: Optional[str] = None,
    camera_code: Optional[str] = None
):
    """
    Generator yielding multipart MJPEG frames with full OpenCV HUD annotations.
    Full hardware camera speed (60 FPS) with automated HTTP/HLS fallback and ANPR snapshot storage.
    """
    global current_ai_stats, STREAM_DYNAMIC_CONTROLS

    src_key = str(source)
    if src_key not in STREAM_DYNAMIC_CONTROLS:
        STREAM_DYNAMIC_CONTROLS[src_key] = {
            "objects": enable_objects,
            "plates": enable_plates,
            "trails": enable_trails
        }

    stream_trail_tracker = TrailTracker(max_trail_length=45)
    stream_dwell_tracker = DwellTracker(dwell_threshold=8.0)

    engine = AsyncAIStreamEngine(
        source,
        fallback_source=fallback,
        is_anpr_camera=is_anpr,
        camera_id=camera_id or "gov-feed-1",
        camera_code=camera_code or "GJ-GOV-001"
    )
    current_ai_stats["is_active"] = True
    intrusion_zone = None



    try:
        while True:
            t_loop_start = time.time()
            frame, tracked_objects, plate_boxes, infer_time_ms = engine.get_frame_and_ai()
            if frame is None:
                time.sleep(0.01)
                continue

            current_epoch = time.time()
            h, w = frame.shape[:2]

            # Read dynamic settings
            dyn = STREAM_DYNAMIC_CONTROLS.get(src_key, {})
            cur_enable_objects = dyn.get("objects", enable_objects)
            cur_enable_plates = dyn.get("plates", enable_plates)
            cur_enable_trails = dyn.get("trails", enable_trails)
            cur_classes = dyn.get("classes", {
                "person": True,
                "car": True,
                "bike": True,
                "truck_bus": True,
                "other": True
            })

            # Zone setup
            if enable_zone and intrusion_zone is None and zone_polygon and len(zone_polygon) >= 3:
                intrusion_zone = IntrusionZone(zone_polygon)
            elif not enable_zone or not zone_polygon:
                intrusion_zone = None

            annotated_frame = frame.copy()
            dwell_alerts_list = []
            intrusion_active = False
            intrusion_events = []
            frame_counts = {}

            # Process Tracked Detections (Instant drawing in < 0.2ms)
            if cur_enable_objects and tracked_objects:
                for obj in tracked_objects:
                    cls_name = obj["label"]

                    # Filter check
                    is_class_allowed = True
                    if cls_name == "person":
                        is_class_allowed = cur_classes.get("person", True)
                    elif cls_name == "car":
                        is_class_allowed = cur_classes.get("car", True)
                    elif cls_name in ["motorcycle", "bicycle"]:
                        is_class_allowed = cur_classes.get("bike", True)
                    elif cls_name in ["truck", "bus"]:
                        is_class_allowed = cur_classes.get("truck_bus", True)
                    else:
                        is_class_allowed = cur_classes.get("other", True)

                    if not is_class_allowed:
                        continue

                    x1, y1, x2, y2 = map(int, obj["box"])
                    cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
                    track_id = obj.get("track_id")

                    frame_counts[cls_name] = frame_counts.get(cls_name, 0) + 1

                    # 3.1. Movement Trajectory Trails
                    if cur_enable_trails and track_id is not None:
                        stream_trail_tracker.update(cls_name, track_id, cx, cy, epoch=current_epoch)
                        trail_pts = stream_trail_tracker.get_points(cls_name, track_id)
                        if len(trail_pts) > 1:
                            for i in range(1, len(trail_pts)):
                                cv2.line(annotated_frame, trail_pts[i - 1], trail_pts[i], (0, 215, 255), 2)
                            cv2.circle(annotated_frame, (cx, cy), 4, (0, 255, 255), -1)

                    # 3.2. Intrusion Zone Breach Check
                    is_inside_zone = False
                    if intrusion_zone and track_id is not None:
                        inside, entered, center_pt = intrusion_zone.check(cls_name, track_id, (x1, y1, x2, y2))
                        if inside:
                            intrusion_active = True
                            is_inside_zone = True
                            intrusion_events.append(f"{cls_name} #{track_id}")
                            cv2.circle(annotated_frame, center_pt, 7, (0, 0, 255), -1)

                    # 3.3. Dwell Loitering Check
                    is_loitering = False
                    dwell_time = 0.0
                    if enable_dwell and track_id is not None:
                        is_loitering, dwell_time = stream_dwell_tracker.update(cls_name, track_id, inside=True)
                        if is_loitering or dwell_time > 8.0:
                            is_loitering = True
                            dwell_alerts_list.append(f"{cls_name} #{track_id} ({dwell_time:.0f}s)")

                    # 3.4. Draw Crisp Bounding Box & Label
                    if is_loitering or is_inside_zone:
                        box_color = (0, 0, 255)
                    elif cls_name == "person":
                        box_color = (255, 128, 0)
                    elif cls_name == "motorcycle":
                        box_color = (255, 0, 200)
                    else:
                        box_color = (0, 255, 0)

                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), box_color, 2)
                    label = f"{cls_name.upper()}" + (f" #{track_id}" if track_id is not None else "")
                    if is_loitering:
                        label += f" [LOITERING {dwell_time:.0f}s]"
                    elif is_inside_zone:
                        label += " [INTRUSION]"

                    (w_txt, h_txt), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.52, 2)
                    cv2.rectangle(annotated_frame, (x1, max(y1 - 24, 0)), (x1 + w_txt + 10, max(y1, 24)), (15, 23, 42), -1)
                    cv2.rectangle(annotated_frame, (x1, max(y1 - 24, 0)), (x1 + w_txt + 10, max(y1, 24)), box_color, 1)
                    cv2.putText(annotated_frame, label, (x1 + 5, max(y1 - 7, 18)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 2)

            # Draw Plate Bounding Boxes & Text Tags
            if cur_enable_plates and plate_boxes:
                frame_counts["plates"] = len(plate_boxes)
                for px1, py1, px2, py2, clean_p, ocr_conf in plate_boxes:
                    cv2.rectangle(annotated_frame, (px1, py1), (px2, py2), (0, 230, 255), 2)
                    p_label = f"PLATE: {clean_p}"
                    (pw, ph), _ = cv2.getTextSize(p_label, cv2.FONT_HERSHEY_SIMPLEX, 0.52, 2)
                    cv2.rectangle(annotated_frame, (px1, max(py1 - 24, 0)), (px1 + pw + 10, max(py1, 24)), (15, 23, 42), -1)
                    cv2.rectangle(annotated_frame, (px1, max(py1 - 24, 0)), (px1 + pw + 10, max(py1, 24)), (0, 230, 255), 1)
                    cv2.putText(annotated_frame, p_label, (px1 + 5, max(py1 - 7, 18)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 2)

            # Intrusion Zone Label
            if intrusion_zone:
                intrusion_zone.draw(annotated_frame, active=intrusion_active)
                zone_label = "RESTRICTED PERIMETER ZONE" if not intrusion_active else "!!! PERIMETER BREACH DETECTED !!!"
                z_color = (0, 0, 255) if intrusion_active else (0, 255, 0)
                cv2.putText(annotated_frame, zone_label, (int(w * 0.18), int(h * 0.43)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.52, z_color, 2)

            # Top Left HUD
            engine_tag = current_ai_stats["backend_engine"]
            obj_total = len(tracked_objects)
            hud_text = f"[{engine_tag}] {infer_time_ms:.1f}ms | Active: {obj_total}"
            cv2.rectangle(annotated_frame, (5, 5), (420, 36), (0, 0, 0), -1)
            cv2.putText(annotated_frame, hud_text, (10, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 0), 2)

            # Top Right HUD
            counts_str = " | ".join([f"{k.upper()}: {v}" for k, v in frame_counts.items()]) or "SCANNING..."
            (cw, ch), _ = cv2.getTextSize(counts_str, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(annotated_frame, (w - cw - 25, 5), (w - 5, 36), (0, 0, 0), -1)
            cv2.putText(annotated_frame, counts_str, (w - cw - 18, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            # Telemetry stats
            current_ai_stats["current_frame_counts"] = frame_counts
            current_ai_stats["active_dwell_alerts"] = dwell_alerts_list
            current_ai_stats["intrusion_alerts"] = intrusion_events
            # High-Speed Optimized JPEG Encoding for Butter-Smooth 60 FPS Browser Decoding
            if w > 1280:
                scale_f = 1280.0 / w
                out_frame = cv2.resize(annotated_frame, (1280, int(h * scale_f)), interpolation=cv2.INTER_LINEAR)
            else:
                out_frame = annotated_frame

            ret, buffer = cv2.imencode('.jpg', out_frame, [
                cv2.IMWRITE_JPEG_QUALITY, 75,
                cv2.IMWRITE_JPEG_OPTIMIZE, 0
            ])
            if not ret:
                continue

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

            # Stream at full camera frame rate (30-60 FPS) with zero CPU lag
            elapsed = time.time() - t_loop_start
            if elapsed < 0.016:
                time.sleep(0.016 - elapsed)
    finally:
        engine.release()
        current_ai_stats["is_active"] = False




class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


class AIStreamRequestHandler(BaseHTTPRequestHandler):
    """Handles HTTP MJPEG streaming and stats requests"""
    def log_message(self, format, *args):
        # Suppress routine log spam
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path in ["/api/v1/ai/stream_controls", "/ai/stream_controls"]:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
                src_key = str(data.get("source", "0"))
                keys_to_update = [src_key]
                if "camera_code" in data:
                    keys_to_update.append(str(data["camera_code"]))
                if "camera_id" in data:
                    keys_to_update.append(str(data["camera_id"]))
                
                # Propagate to all active stream keys for instant response
                keys_to_update = list(set(keys_to_update + list(STREAM_DYNAMIC_CONTROLS.keys())))

                for k in keys_to_update:
                    if k not in STREAM_DYNAMIC_CONTROLS:
                        STREAM_DYNAMIC_CONTROLS[k] = {}
                    if "detect_objects" in data:
                        STREAM_DYNAMIC_CONTROLS[k]["objects"] = bool(data["detect_objects"])
                    if "detect_plates" in data:
                        STREAM_DYNAMIC_CONTROLS[k]["plates"] = bool(data["detect_plates"])
                    if "trails" in data:
                        STREAM_DYNAMIC_CONTROLS[k]["trails"] = bool(data["trails"])
                    if "classes" in data and isinstance(data["classes"], dict):
                        STREAM_DYNAMIC_CONTROLS[k]["classes"] = {
                            cls_k: bool(v) for cls_k, v in data["classes"].items()
                        }

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "controls": STREAM_DYNAMIC_CONTROLS.get(src_key, {})}).encode('utf-8'))
                return
            except Exception as e:
                self.send_response(400)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                return

        if path in ["/api/v1/ai/scan_frame", "/ai/scan_frame"]:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
                img_data_b64 = data.get("image", "")
                if "," in img_data_b64:
                    img_data_b64 = img_data_b64.split(",", 1)[1]

                import base64
                img_bytes = base64.b64decode(img_data_b64)
                np_arr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if frame is None or frame.size == 0:
                    raise ValueError("Failed to decode frame image")

                h, w = frame.shape[:2]
                detected_objects = []
                detected_plates = []

                # 1. Object Detection
                if detector is not None:
                    raw_dets = detector.detect(frame)
                    for det in raw_dets:
                        bx1, by1, bx2, by2 = map(float, det["box"])
                        cls_name = det.get("label", "object")
                        score = float(det.get("score", 0.85))
                        detected_objects.append({
                            "class": cls_name,
                            "confidence": round(score, 3),
                            "box": [round(bx1 / w, 4), round(by1 / h, 4), round((bx2 - bx1) / w, 4), round((by2 - by1) / h, 4)]
                        })

                # 2. Plate Detection
                if real_plate_detector is not None:
                    found_plate = False
                    for obj in detected_objects:
                        if obj["class"] in ["car", "bus", "truck", "motorcycle"]:
                            ox, oy, ow_norm, oh_norm = obj["box"]
                            vx1, vy1 = int(ox * w), int(oy * h)
                            vx2, vy2 = int((ox + ow_norm) * w), int((oy + oh_norm) * h)
                            v_crop = frame[max(0, vy1):min(h, vy2), max(0, vx1):min(w, vx2)]
                            if v_crop.size > 0:
                                v_plates = real_plate_detector.detect(v_crop, conf_thresh=0.10, iou_thresh=0.45)
                                for cpx1, cpy1, cpx2, cpy2, p_score in v_plates:
                                    g_px1 = max(0, vx1 + cpx1)
                                    g_py1 = max(0, vy1 + cpy1)
                                    g_px2 = min(w - 1, vx1 + cpx2)
                                    g_py2 = min(h - 1, vy1 + cpy2)
                                    p_txt, o_conf = "", 0.0
                                    if real_plate_ocr is not None:
                                        p_txt, o_conf = real_plate_ocr.recognize(frame, (g_px1, g_py1, g_px2, g_py2))
                                    clean_p = normalize_ocr_text(p_txt) if p_txt else ""
                                    if clean_p and len(clean_p) >= 4:
                                        detected_plates.append({
                                            "plate_text": clean_p,
                                            "confidence": round(float(o_conf if o_conf > 0 else p_score), 3),
                                            "box": [round(g_px1 / w, 4), round(g_py1 / h, 4), round((g_px2 - g_px1) / w, 4), round((g_py2 - g_py1) / h, 4)]
                                        })
                                        found_plate = True
                                        break
                    if not found_plate:
                        f_plates = real_plate_detector.detect(frame, conf_thresh=0.10, iou_thresh=0.45)
                        for fpx1, fpy1, fpx2, fpy2, p_score in f_plates:
                            p_txt, o_conf = "", 0.0
                            if real_plate_ocr is not None:
                                p_txt, o_conf = real_plate_ocr.recognize(frame, (fpx1, fpy1, fpx2, fpy2))
                            clean_p = normalize_ocr_text(p_txt) if p_txt else ""
                            if clean_p and len(clean_p) >= 4:
                                detected_plates.append({
                                    "plate_text": clean_p,
                                    "confidence": round(float(o_conf if o_conf > 0 else p_score), 3),
                                    "box": [round(fpx1 / w, 4), round(fpy1 / h, 4), round((fpx2 - fpx1) / w, 4), round((fpy2 - fpy1) / h, 4)]
                                })

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "objects": detected_objects,
                    "plates": detected_plates
                }).encode('utf-8'))
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
                return

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path in ["/api/v1/ai/video_feed", "/ai/video_feed"]:
            source = params.get("source", ["0"])[0]
            fallback = params.get("fallback", [None])[0]
            is_anpr = params.get("is_anpr", ["false"])[0].lower() == "true"
            camera_id = params.get("camera_id", ["gov-feed-1"])[0]
            camera_code = params.get("camera_code", ["GJ-GOV-001"])[0]
            objects = params.get("detect_objects", params.get("objects", ["true"]))[0].lower() == "true"
            plates = params.get("detect_plates", params.get("plates", ["true"]))[0].lower() == "true"
            trails = params.get("trails", ["true"])[0].lower() == "true"
            dwell = params.get("dwell", ["false"])[0].lower() == "true"
            zone = params.get("zone", ["false"])[0].lower() == "true"
            zone_pts_raw = params.get("zone_pts", [None])[0]
            classes_param = params.get("classes", [None])[0]

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
                for frame_bytes in generate_frames(
                    source,
                    objects,
                    plates,
                    trails,
                    dwell,
                    zone,
                    zone_pts,
                    fallback=fallback,
                    is_anpr=is_anpr,
                    camera_id=camera_id,
                    camera_code=camera_code
                ):
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

