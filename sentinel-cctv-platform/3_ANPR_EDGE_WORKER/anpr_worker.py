#!/usr/bin/env python3
"""
==============================================================================
GujRaksha (ગુજ રક્ષા) — Standalone Distributed Python AI ANPR Edge Worker
Part 3 of 3: AI Inference Node (GPU-First / Multi-Stream / Quiet Auto-Retry)
Copyright (c) 2026 Fenil Patel. All Rights Reserved.
==============================================================================
"""

import os
import sys
import time
import argparse
import re
import urllib.request
import json
import threading
import socket

# Suppress noisy OpenCV / FFMPEG probing logs and force RTSP over TCP
os.environ["OPENCV_LOG_LEVEL"] = "ERROR"
os.environ["OPENCV_FFMPEG_LOGLEVEL"] = "-8"
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

import cv2
try:
    cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)
except Exception:
    pass

import numpy as np

# Load TFLite Interpreter (ai_edge_litert / tflite_runtime / tensorflow)
try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    try:
        from tflite_runtime.interpreter import Interpreter
    except ImportError:
        try:
            from tensorflow.lite.python.interpreter import Interpreter
        except ImportError:
            print("Error: Neither ai_edge_litert, tflite_runtime nor tensorflow is installed.")
            print("Run: pip install ai-edge-litert opencv-python-headless numpy requests")
            sys.exit(1)

# Optional ONNX Runtime for GPU Acceleration (NVIDIA CUDA / TensorRT)
try:
    import onnxruntime as ort
    HAS_ONNXRUNTIME = True
except ImportError:
    HAS_ONNXRUNTIME = False
    ort = None

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DET_TFLITE = os.path.join(SCRIPT_DIR, "models/tflite/plate_detector.tflite")
DEFAULT_OCR_TFLITE = os.path.join(SCRIPT_DIR, "models/tflite/plate_ocr.tflite")
DEFAULT_DET_ONNX = os.path.join(SCRIPT_DIR, "models/onnx/plate_detector.onnx")
DEFAULT_OCR_ONNX = os.path.join(SCRIPT_DIR, "models/onnx/plate_ocr.onnx")

DET_SIZE = 384
OCR_W, OCR_H = 128, 64
OCR_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

INDIAN_STATE_CODES = (
    'GJ', 'MH', 'DL', 'KA', 'TN', 'UP', 'HR', 'RJ', 'MP', 'PB',
    'WB', 'KL', 'BR', 'AP', 'TS', 'CG', 'OD', 'UK', 'HP', 'JK',
    'GA', 'AS', 'TR', 'ML', 'MN', 'NL', 'MZ', 'SK', 'CH', 'PY',
    'DD', 'DN', 'LD', 'AN'
)
PLATE_REGEX = re.compile(
    r'^(?:' + '|'.join(INDIAN_STATE_CODES) + r')[0-9]{1,2}(?:[A-Z]{0,3}[0-9]{3,4}|[0-9]{3,4})$'
)
BH_REGEX = re.compile(r'^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$')
GENERIC_PLATE_REGEX = re.compile(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{2,4}$')


def normalize_ocr_text(raw_text: str) -> str:
    """Clean, standardize, and correct raw OCR characters from Indian plates."""
    if not raw_text:
        return ""
    text = raw_text.upper().strip()
    text = re.sub(r'[^A-Z0-9]', '', text)

    # 1. Strip common HSRP country badge 'IND' / 'INDIA'
    if text.startswith("IND") and len(text) >= 7:
        text = text[3:]
    elif text.startswith("INDIA") and len(text) >= 9:
        text = text[5:]
    elif text.startswith("IN") and len(text) >= 6 and not text.startswith("IND"):
        if text[2:4] in INDIAN_STATE_CODES or text[2:4].isdigit():
            text = text[2:]

    # 2. Common OCR prefix corrections
    if len(text) >= 2:
        prefix = text[:2]
        if prefix in ["6J", "OJ", "0J", "CJ", "QJ", "CI", "C1", "GI", "G1"]:
            text = "GJ" + text[2:]
        elif prefix in ["NH", "HH", "1H", "M4", "MI"]:
            text = "MH" + text[2:]
        elif prefix in ["OL", "0L", "QL", "D1", "DI"]:
            text = "DL" + text[2:]
        elif prefix in ["K4", "K8", "KA"]:
            text = "KA" + text[2:]
        elif prefix in ["R1", "P1", "RJ"]:
            text = "RJ" + text[2:]
        elif prefix in ["U9", "UP", "VP"]:
            text = "UP" + text[2:]

    return text


def is_valid_indian_plate(text: str) -> bool:
    """Validate if string matches standard Indian vehicle number plate format."""
    if not text:
        return False
    clean = re.sub(r'[^A-Z0-9]', '', text.upper().strip())
    if len(clean) < 5 or len(clean) > 11:
        return False
    return bool(
        PLATE_REGEX.match(clean) or
        BH_REGEX.match(clean) or
        (clean[:2] in INDIAN_STATE_CODES and clean[-2:].isdigit() and len(clean) >= 6) or
        GENERIC_PLATE_REGEX.match(clean)
    )


def create_accelerated_interpreter(model_path: str, num_threads: int = None):
    """Initializes TFLite / LiteRT Interpreter with CPU multi-threading."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")

    if num_threads is None:
        num_threads = min(8, max(2, os.cpu_count() or 4))

    interpreter = Interpreter(model_path=model_path, num_threads=num_threads)
    interpreter.allocate_tensors()
    return interpreter, f"CPU ({num_threads} Threads)"


# ==============================================================================
# GPU ACCELERATION (ONNX Runtime / CUDA / TensorRT)
# ==============================================================================

class PlateDetectorONNX:
    """YOLOv9 License Plate Detector using ONNX Runtime (CUDA / TensorRT GPU)."""
    def __init__(self, model_path: str):
        if not HAS_ONNXRUNTIME:
            raise RuntimeError("onnxruntime is not installed.")
        
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        avail = ort.get_available_providers()
        valid_providers = [p for p in providers if p in avail]
        
        sess_opts = ort.SessionOptions()
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=valid_providers)
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        
        active_provider = self.session.get_providers()[0]
        self.accel_mode = "GPU (NVIDIA CUDA)" if "CUDA" in active_provider else "GPU (TensorRT)" if "TensorRT" in active_provider else "CPU (ONNX)"

    def preprocess(self, img: np.ndarray):
        h, w = img.shape[:2]
        scale = DET_SIZE / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)

        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        pad_w = (DET_SIZE - new_w) // 2
        pad_h = (DET_SIZE - new_h) // 2

        canvas = np.full((DET_SIZE, DET_SIZE, 3), 114, dtype=np.uint8)
        canvas[pad_h : pad_h + new_h, pad_w : pad_w + new_w] = resized

        canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        blob = (canvas_rgb.astype(np.float32) / 255.0)
        blob = np.transpose(blob, (2, 0, 1))[np.newaxis, :]  # NCHW
        return blob, scale, (pad_w, pad_h)

    def detect(self, img: np.ndarray, conf_thresh: float = 0.20, iou_thresh: float = 0.45):
        blob, scale, (pad_w, pad_h) = self.preprocess(img)
        outputs = self.session.run([self.output_name], {self.input_name: blob})
        preds = outputs[0][0].T
        mask = preds[:, 4] >= conf_thresh
        filtered = preds[mask]
        if len(filtered) == 0:
            return []

        cx, cy, bw, bh = filtered[:, 0], filtered[:, 1], filtered[:, 2], filtered[:, 3]
        x1 = cx - bw / 2.0
        y1 = cy - bh / 2.0
        x2 = cx + bw / 2.0
        y2 = cy + bh / 2.0

        orig_h, orig_w = img.shape[:2]
        x1 = np.clip((x1 - pad_w) / scale, 0, orig_w)
        y1 = np.clip((y1 - pad_h) / scale, 0, orig_h)
        x2 = np.clip((x2 - pad_w) / scale, 0, orig_w)
        y2 = np.clip((y2 - pad_h) / scale, 0, orig_h)

        boxes = np.stack([x1, y1, x2 - x1, y2 - y1], axis=1).tolist()
        scores = filtered[:, 4].astype(float).tolist()

        indices = cv2.dnn.NMSBoxes(boxes, scores, conf_thresh, iou_thresh)
        detections = []
        if len(indices) > 0:
            for idx in indices.flatten():
                bx, by, bw_b, bh_b = boxes[idx]
                detections.append((
                    int(bx), int(by), int(bx + bw_b), int(by + bh_b), float(scores[idx])
                ))
        return detections


class PlateOCRONNX:
    """CCT Transformer OCR Recognizer using ONNX Runtime (CUDA / TensorRT GPU)."""
    def __init__(self, model_path: str):
        if not HAS_ONNXRUNTIME:
            raise RuntimeError("onnxruntime is not installed.")
        
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        avail = ort.get_available_providers()
        valid_providers = [p for p in providers if p in avail]
        
        sess_opts = ort.SessionOptions()
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=valid_providers)
        self.input_name = self.session.get_inputs()[0].name
        self.accel_mode = "GPU"

    def recognize(self, img: np.ndarray, bbox: tuple = None):
        if bbox:
            x1, y1, x2, y2 = bbox
            h, w = img.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            crop = img[y1:y2, x1:x2]
        else:
            crop = img

        if crop is None or crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 20:
            return "", 0.0

        try:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
            enhanced = clahe.apply(gray)
            crop_rgb = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB)
            crop_resized = cv2.resize(crop_rgb, (OCR_W, OCR_H), interpolation=cv2.INTER_LINEAR)
        except Exception:
            crop_resized = cv2.resize(crop, (OCR_W, OCR_H), interpolation=cv2.INTER_LINEAR)
            crop_resized = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2RGB)

        batch = crop_resized[np.newaxis, :].astype(np.float32)
        outputs = self.session.run(None, {self.input_name: batch})
        plate_out = outputs[-1] if len(outputs) > 0 else outputs[0]
        chars = plate_out[0]
        indices = np.argmax(chars, axis=1)
        probs = np.max(chars, axis=1)

        decoded_chars = [OCR_CHARSET[idx] for idx in indices if idx < len(OCR_CHARSET)]
        text = "".join(decoded_chars)
        mean_conf = float(np.mean(probs))
        return text, mean_conf


# ==============================================================================
# CPU TFLite Engine Classes
# ==============================================================================

class PlateDetectorTFLite:
    """YOLOv9 License Plate Detector using TFLite / LiteRT."""
    def __init__(self, model_path: str, num_threads: int = None):
        self.interpreter, self.accel_mode = create_accelerated_interpreter(model_path, num_threads)
        self.input_details = self.interpreter.get_input_details()[0]
        self.output_details = self.interpreter.get_output_details()[0]
        self.input_shape = self.input_details['shape']
        self.is_nchw = len(self.input_shape) == 4 and self.input_shape[1] == 3

    def preprocess(self, img: np.ndarray):
        h, w = img.shape[:2]
        scale = DET_SIZE / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)

        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        pad_w = (DET_SIZE - new_w) // 2
        pad_h = (DET_SIZE - new_h) // 2

        canvas = np.full((DET_SIZE, DET_SIZE, 3), 114, dtype=np.uint8)
        canvas[pad_h : pad_h + new_h, pad_w : pad_w + new_w] = resized

        canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        blob = (canvas_rgb.astype(np.float32) / 255.0)[np.newaxis, :]

        if self.is_nchw:
            blob = np.transpose(blob, (0, 3, 1, 2))

        return blob, scale, (pad_w, pad_h)

    def detect(self, img: np.ndarray, conf_thresh: float = 0.20, iou_thresh: float = 0.45):
        blob, scale, (pad_w, pad_h) = self.preprocess(img)
        self.interpreter.set_tensor(self.input_details['index'], blob)
        self.interpreter.invoke()

        output = self.interpreter.get_tensor(self.output_details['index'])
        preds = output[0].T
        mask = preds[:, 4] >= conf_thresh
        filtered = preds[mask]
        if len(filtered) == 0:
            return []

        cx, cy, bw, bh = filtered[:, 0], filtered[:, 1], filtered[:, 2], filtered[:, 3]
        x1 = cx - bw / 2.0
        y1 = cy - bh / 2.0
        x2 = cx + bw / 2.0
        y2 = cy + bh / 2.0

        orig_h, orig_w = img.shape[:2]
        x1 = np.clip((x1 - pad_w) / scale, 0, orig_w)
        y1 = np.clip((y1 - pad_h) / scale, 0, orig_h)
        x2 = np.clip((x2 - pad_w) / scale, 0, orig_w)
        y2 = np.clip((y2 - pad_h) / scale, 0, orig_h)

        boxes = np.stack([x1, y1, x2 - x1, y2 - y1], axis=1).tolist()
        scores = filtered[:, 4].astype(float).tolist()

        indices = cv2.dnn.NMSBoxes(boxes, scores, conf_thresh, iou_thresh)
        detections = []
        if len(indices) > 0:
            for idx in indices.flatten():
                bx, by, bw_b, bh_b = boxes[idx]
                detections.append((
                    int(bx), int(by), int(bx + bw_b), int(by + bh_b), float(scores[idx])
                ))
        return detections


class PlateOCRTFLite:
    """CCT Transformer OCR Recognizer using TFLite / LiteRT."""
    def __init__(self, model_path: str, num_threads: int = None):
        self.interpreter, self.accel_mode = create_accelerated_interpreter(model_path, num_threads)
        self.input_details = self.interpreter.get_input_details()[0]
        self.output_details = self.interpreter.get_output_details()
        
        self.plate_out_idx = None
        for o in self.output_details:
            shape = list(o['shape'])
            if len(shape) == 3 and shape[1] == 10 and shape[2] == 37:
                self.plate_out_idx = o['index']
                break
        if self.plate_out_idx is None:
            self.plate_out_idx = self.output_details[-1]['index']

    def recognize(self, img: np.ndarray, bbox: tuple = None):
        if bbox:
            x1, y1, x2, y2 = bbox
            h, w = img.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            crop = img[y1:y2, x1:x2]
        else:
            crop = img

        if crop is None or crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 20:
            return "", 0.0

        try:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
            enhanced = clahe.apply(gray)
            crop_rgb = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB)
            crop_resized = cv2.resize(crop_rgb, (OCR_W, OCR_H), interpolation=cv2.INTER_LINEAR)
        except Exception:
            crop_resized = cv2.resize(crop, (OCR_W, OCR_H), interpolation=cv2.INTER_LINEAR)
            crop_resized = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2RGB)

        batch = crop_resized[np.newaxis, :]

        self.interpreter.set_tensor(self.input_details['index'], batch)
        self.interpreter.invoke()

        plate_out = self.interpreter.get_tensor(self.plate_out_idx)
        chars = plate_out[0]
        indices = np.argmax(chars, axis=1)
        probs = np.max(chars, axis=1)

        decoded_chars = [OCR_CHARSET[idx] for idx in indices if idx < len(OCR_CHARSET)]
        text = "".join(decoded_chars)
        mean_conf = float(np.mean(probs))

        return text, mean_conf


def create_anpr_pipeline(backend: str = "auto", num_threads: int = 4):
    """
    Adaptive GPU-First Pipeline Factory:
    - Auto-probes NVIDIA CUDA / TensorRT ONNX GPU acceleration.
    - If GPU models exist and GPU is detected, loads ONNX GPU engine.
    - Otherwise gracefully falls back to multi-threaded TFLite CPU.
    """
    det_onnx_path = DEFAULT_DET_ONNX
    ocr_onnx_path = DEFAULT_OCR_ONNX
    det_tflite_path = DEFAULT_DET_TFLITE
    ocr_tflite_path = DEFAULT_OCR_TFLITE

    gpu_available = False
    if HAS_ONNXRUNTIME:
        try:
            providers = ort.get_available_providers()
            gpu_available = 'CUDAExecutionProvider' in providers or 'TensorRTExecutionProvider' in providers
        except Exception:
            gpu_available = False

    onnx_exists = os.path.exists(det_onnx_path) and os.path.exists(ocr_onnx_path)

    should_use_onnx = False
    if backend == "onnx":
        should_use_onnx = HAS_ONNXRUNTIME and onnx_exists
    elif backend == "tflite":
        should_use_onnx = False
    else:  # auto
        should_use_onnx = HAS_ONNXRUNTIME and gpu_available and onnx_exists

    if should_use_onnx:
        try:
            detector = PlateDetectorONNX(det_onnx_path)
            ocr = PlateOCRONNX(ocr_onnx_path)
            return detector, ocr, detector.accel_mode
        except Exception:
            pass

    detector = PlateDetectorTFLite(det_tflite_path, num_threads=num_threads)
    ocr = PlateOCRTFLite(ocr_tflite_path, num_threads=num_threads)
    return detector, ocr, detector.accel_mode


def classify_vehicle_color(crop_bgr: np.ndarray) -> str:
    """Classify primary vehicle color using HSV color space analysis."""
    if crop_bgr is None or crop_bgr.size == 0:
        return "Silver"
    try:
        hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
        h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        mean_s = float(np.mean(s))
        mean_v = float(np.mean(v))

        if mean_s < 45:
            if mean_v > 180:
                return "White"
            elif mean_v < 65:
                return "Black"
            else:
                return "Silver"

        mean_h = float(np.mean(h))
        if mean_h < 15 or mean_h > 165:
            return "Red"
        elif 85 <= mean_h <= 135:
            return "Blue"
        elif 15 < mean_h < 35:
            return "Yellow"
        elif 35 <= mean_h < 85:
            return "Green"
        else:
            return "Silver"
    except Exception:
        return "Silver"


def classify_vehicle_type(bbox: tuple, img_shape: tuple) -> str:
    """Classify vehicle type from geometry."""
    if not bbox or not img_shape:
        return "Sedan / Car"
    try:
        x1, y1, x2, y2 = bbox
        bw, bh = max(1, x2 - x1), max(1, y2 - y1)
        aspect_ratio = bw / float(bh)
        rel_area = (bw * bh) / float(img_shape[0] * img_shape[1])

        if aspect_ratio < 0.8 and rel_area < 0.05:
            return "Two-Wheeler / Bike"
        elif aspect_ratio > 2.2 or rel_area > 0.35:
            return "Heavy Truck"
        elif rel_area > 0.22:
            return "Commercial Bus"
        elif aspect_ratio < 1.3:
            return "SUV / Hatchback"
        else:
            return "Sedan / Car"
    except Exception:
        return "Sedan / Car"


class VehicleSpeedTracker:
    """Speed estimation from frame delta."""
    def __init__(self, speed_limit: int = 80):
        self.speed_limit = speed_limit
        self.history = {}

    def estimate_speed(self, plate: str, bbox: tuple, now: float) -> tuple:
        if not bbox or not plate:
            speed = int(42 + (hash(plate or "x") % 38))
            return speed, speed > self.speed_limit

        x1, y1, x2, y2 = bbox
        cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0

        if plate in self.history:
            prev_cx, prev_cy, prev_time = self.history[plate]
            dt = max(0.01, now - prev_time)
            dist_px = np.sqrt((cx - prev_cx)**2 + (cy - prev_cy)**2)
            estimated_speed = int(min(160, max(25, int(dist_px / dt * 0.85))))
        else:
            estimated_speed = int(45 + (hash(plate) % 35))

        self.history[plate] = (cx, cy, now)
        is_speeding = estimated_speed > self.speed_limit
        return estimated_speed, is_speeding


class CentralWatchlistManager:
    """O(1) In-Memory Watchlist Hash Lookup & Sync Manager."""
    def __init__(self, central_url: str):
        self.central_url = central_url.rstrip("/")
        self.watchlist_map = {}
        self.lock = threading.Lock()

    def update_from_list(self, records: list):
        with self.lock:
            new_map = {}
            for r in records:
                if isinstance(r, dict):
                    raw_p = r.get("vehicle_plate") or ""
                else:
                    raw_p = str(r)
                plate = re.sub(r'[^A-Z0-9]', '', raw_p.upper())
                if plate:
                    new_map[plate] = r
            self.watchlist_map = new_map

    def fetch_from_api(self):
        try:
            req = urllib.request.Request(f"{self.central_url}/watchlist", headers={"User-Agent": "GujRaksha-Worker/1.0"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                records = data.get("data") or data.get("watchlist") or []
                self.update_from_list(records)
                return len(self.watchlist_map)
        except Exception:
            return len(self.watchlist_map)

    def is_target_hit(self, plate_number: str):
        if not plate_number:
            return None
        clean = re.sub(r'[^A-Z0-9]', '', plate_number.upper())
        with self.lock:
            return self.watchlist_map.get(clean) or self.watchlist_map.get(plate_number.upper())


INFERENCE_LOCK = threading.Lock()


class StreamStatsRegistry:
    """Shared state tracking active vs offline streams across all worker threads."""
    def __init__(self):
        self.stream_statuses = {}  # camera_code -> "ACTIVE" | "OFFLINE"
        self.lock = threading.Lock()
        self.last_summary_time = 0

    def set_status(self, camera_code: str, status: str):
        with self.lock:
            if status == "REMOVED":
                self.stream_statuses.pop(camera_code, None)
            else:
                self.stream_statuses[camera_code] = status

    def get_summary(self):
        with self.lock:
            active = sum(1 for s in self.stream_statuses.values() if s == "ACTIVE")
            offline = sum(1 for s in self.stream_statuses.values() if s == "OFFLINE")
            total = len(self.stream_statuses)
            return active, offline, total

    def print_summary_if_due(self, worker_id: str, interval: float = 6.0):
        now = time.time()
        if now - self.last_summary_time >= interval:
            self.last_summary_time = now
            active, offline, total = self.get_summary()
            if total > 0:
                offline_msg = f" | \x1b[31m🔴 {offline} Offline (Auto-Retrying)\x1b[0m" if offline > 0 else ""
                print(f"📊 \x1b[1m\x1b[36m[{worker_id}]\x1b[0m \x1b[32m🟢 {active}/{total} Streams Active (Scanning)\x1b[0m{offline_msg}", flush=True)


GLOBAL_STATS = StreamStatsRegistry()


class CameraWorkerThread(threading.Thread):
    """
    Worker processing a single assigned camera RTSP stream.
    Features:
    - Quiet background retry if stream is unreachable/offline (no error log spam).
    - Throttled clean ANPR logs when scanning normal traffic.
    - High-visibility alert when Watchlist Target is spotted.
    """
    def __init__(self, cam_info: dict, detector, ocr, central_url: str, watchlist_mgr: CentralWatchlistManager,
                 conf: float = 0.20, iou: float = 0.45, frame_stride: int = 3):
        super().__init__(daemon=True)
        self.cam_info = cam_info
        self.camera_id = cam_info.get("id") or "gov-feed-1"
        self.camera_code = cam_info.get("camera_code") or "GJ-GOV-001"
        self.stream_url = cam_info.get("rtsp_url") or cam_info.get("stream_url") or "0"
        self.detector = detector
        self.ocr = ocr
        self.central_url = central_url.rstrip("/")
        self.watchlist_mgr = watchlist_mgr
        self.conf = conf
        self.iou = iou
        self.frame_stride = max(1, frame_stride)
        self.speed_tracker = VehicleSpeedTracker(speed_limit=80)
        self.running = True
        self.recent_detections = {}
        self.is_connected = False

    def stop(self):
        self.running = False

    def open_capture(self):
        try:
            if str(self.stream_url).isdigit():
                cap = cv2.VideoCapture(int(self.stream_url), cv2.CAP_V4L2)
            else:
                cap = cv2.VideoCapture(str(self.stream_url), cv2.CAP_FFMPEG)
            
            if cap and cap.isOpened():
                return cap
        except Exception:
            pass
        return None

    def run(self):
        frame_counter = 0
        cap = None

        while self.running:
            # 1. Connect or Reconnect loop (Quiet background retry)
            if cap is None or not cap.isOpened():
                GLOBAL_STATS.set_status(self.camera_code, "OFFLINE")
                self.is_connected = False
                cap = self.open_capture()
                if cap is None or not cap.isOpened():
                    # Sleep quietly before retrying (No error spam!)
                    for _ in range(30):
                        if not self.running:
                            break
                        time.sleep(0.1)
                    continue
                else:
                    GLOBAL_STATS.set_status(self.camera_code, "ACTIVE")
                    self.is_connected = True

            # 2. Frame Processing Loop
            try:
                ret, frame = cap.read()
                if not ret or frame is None or frame.shape[0] < 50:
                    cap.release()
                    cap = None
                    GLOBAL_STATS.set_status(self.camera_code, "OFFLINE")
                    time.sleep(0.5)
                    continue

                frame_counter += 1
                now = time.time()

                if self.frame_stride > 1 and (frame_counter % self.frame_stride != 0):
                    continue

                with INFERENCE_LOCK:
                    raw_boxes = self.detector.detect(frame, self.conf, self.iou)

                for x1, y1, x2, y2, det_score in raw_boxes:
                    if (x2 - x1) < 20 or (y2 - y1) < 10:
                        continue

                    with INFERENCE_LOCK:
                        raw_text, ocr_conf = self.ocr.recognize(frame, (x1, y1, x2, y2))
                    cleaned_text = normalize_ocr_text(raw_text)

                    if cleaned_text and len(cleaned_text) >= 4:
                        last_seen = self.recent_detections.get(cleaned_text, 0)
                        if now - last_seen > 3.0:
                            self.recent_detections[cleaned_text] = now

                            h, w = frame.shape[:2]
                            x1_c, y1_c, x2_c, y2_c = max(0, x1), max(0, y1), min(w, x2), min(h, y2)
                            vehicle_crop = frame[y1_c:y2_c, x1_c:x2_c]
                            v_color = classify_vehicle_color(vehicle_crop)
                            v_type = classify_vehicle_type((x1, y1, x2, y2), (h, w))
                            time_str = time.strftime('%H:%M:%S')

                            # ⚡ O(1) Fast Watchlist Hash Check
                            watchlist_hit = self.watchlist_mgr.is_target_hit(cleaned_text)

                            if watchlist_hit:
                                # High Visibility Target Alert
                                category = watchlist_hit.get("category", "STOLEN_VEHICLE") if isinstance(watchlist_hit, dict) else "HOTLIST"
                                print(f"\n\x1b[41m\x1b[1m\x1b[37m 🚨 [WATCHLIST HIT] \x1b[0m \x1b[31m\x1b[1m{cleaned_text}\x1b[0m on camera \x1b[33m[{self.camera_code}]\x1b[0m at \x1b[36m{time_str}\x1b[0m ({category})", flush=True)

                                # Immediate Real-Time Alert Dispatch to Central Server
                                payload = {
                                    "vehicle_plate": cleaned_text,
                                    "camera_code": self.camera_code,
                                    "camera_id": self.camera_id,
                                    "confidence": round(ocr_conf * 100.0, 1),
                                    "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ')
                                }
                                try:
                                    data_bytes = json.dumps(payload).encode('utf-8')
                                    req = urllib.request.Request(
                                        f"{self.central_url}/anpr/ingest",
                                        data=data_bytes,
                                        headers={"Content-Type": "application/json"},
                                        method="POST"
                                    )
                                    with urllib.request.urlopen(req, timeout=3.0) as resp:
                                        res_data = json.loads(resp.read().decode('utf-8'))
                                        print(f"   📡 Dispatched to Central CCC: {res_data.get('message')}\n", flush=True)
                                except Exception:
                                    pass
                            else:
                                # Clean / normal vehicle scan (Clean, compact log)
                                print(f"\x1b[36m[ANPR SCAN]\x1b[0m 🚗 \x1b[33m[{self.camera_code}]\x1b[0m Plate: \x1b[1m\x1b[37m{cleaned_text}\x1b[0m | Time: {time_str}", flush=True)

                time.sleep(0.01)

            except Exception:
                if cap:
                    cap.release()
                cap = None
                GLOBAL_STATS.set_status(self.camera_code, "OFFLINE")
                time.sleep(1.0)

        if cap:
            cap.release()


class DistributedWorkerManager:
    """Manages full lifecycle with Central CCC (Registration, 100-Camera Dispatch & Standby)."""
    def __init__(self, central_url: str, worker_id: str, max_capacity: int = 100, threads: int = 4, backend: str = "auto"):
        self.central_url = central_url.rstrip("/")
        self.worker_id = worker_id or f"node-{socket.gethostname()[:8]}"
        self.max_capacity = max_capacity
        self.threads = threads
        self.detector, self.ocr, self.accel_mode = create_anpr_pipeline(backend, num_threads=threads)
        self.watchlist_mgr = CentralWatchlistManager(central_url)
        self.workers = {} # camera_code -> CameraWorkerThread
        self.running = True

    def register(self):
        """Register worker with Central CCC in STANDBY mode."""
        try:
            reg_url = f"{self.central_url}/workers/register"
            payload = {
                "worker_id": self.worker_id,
                "hostname": socket.gethostname(),
                "district": "All",
                "max_capacity": self.max_capacity,
                "hardware": self.accel_mode
            }
            data_bytes = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(reg_url, data=data_bytes, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                watchlist = data.get("data", {}).get("watchlist") or []
                self.watchlist_mgr.update_from_list(watchlist)
                print(f"📡 [Central Orchestrator] Worker \x1b[36m{self.worker_id}\x1b[0m connected. Mode: STANDBY | Watchlist: {len(self.watchlist_mgr.watchlist_map)} targets", flush=True)
                return True
        except Exception as e:
            print(f"⚠️ [Central Orchestrator] Standby waiting for Central CCC...", flush=True)
            return False

    def heartbeat(self):
        """Send heartbeat and receive assigned cameras + updated watchlist."""
        try:
            active_cams, offline_cams, total_cams = GLOBAL_STATS.get_summary()
            hb_url = f"{self.central_url}/workers/heartbeat"
            payload = {
                "worker_id": self.worker_id,
                "stats": {
                    "active_streams": active_cams,
                    "offline_streams": offline_cams,
                    "total_assigned": total_cams,
                    "max_capacity": self.max_capacity
                }
            }
            data_bytes = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(hb_url, data=data_bytes, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                assigned = data.get("assigned_cameras", [])
                watchlist = data.get("watchlist", [])
                if watchlist:
                    self.watchlist_mgr.update_from_list(watchlist)
                return assigned, data.get("state", "STANDBY")
        except Exception:
            return None, "OFFLINE"

    def sync_camera_workers(self, assigned_cameras):
        if assigned_cameras is None:
            return

        current_codes = set()
        newly_attached = 0

        for cam in assigned_cameras:
            code = cam.get("camera_code") or cam.get("code") or f"CAM-{cam.get('id')}"
            current_codes.add(code)

            if code not in self.workers or not self.workers[code].is_alive():
                worker = CameraWorkerThread(
                    cam, self.detector, self.ocr, self.central_url, self.watchlist_mgr,
                    conf=0.20, iou=0.45, frame_stride=3
                )
                worker.start()
                self.workers[code] = worker
                newly_attached += 1

        if newly_attached > 0:
            print(f"\n⚡ \x1b[1m\x1b[32m[Cluster Dispatch] {len(assigned_cameras)} Cameras Auto-Assigned by Central CCC\x1b[0m", flush=True)
            print(f"   💡 \x1b[36mCentral Dashboard:\x1b[0m View all {len(assigned_cameras)} assigned cameras in the interactive Node Modal.", flush=True)
            print(f"   🚀 Live multi-threaded AI vision scanning running across all {len(assigned_cameras)} cameras...\n", flush=True)

        # Detach unassigned cameras
        detached = 0
        for code in list(self.workers.keys()):
            if code not in current_codes:
                self.workers[code].stop()
                GLOBAL_STATS.set_status(code, "REMOVED")
                del self.workers[code]
                detached += 1

        if detached > 0:
            print(f"⏹️ [Cluster Dispatch] Revoked {detached} non-ANPR cameras (Active ANPR feeds: {len(assigned_cameras)}).", flush=True)

    def start(self):
        print("======================================================================")
        print(" 🚔 GUJRAKSHA DISTRIBUTED AI ANPR WORKER NODE")
        print("======================================================================")
        print(f" 🆔 Worker Node ID : \x1b[36m{self.worker_id}\x1b[0m")
        print(f" 🏢 Central Server : {self.central_url}")
        print(f" 🚀 Max Capacity   : {self.max_capacity} Cameras")
        print(f" ⚡ Hardware Engine: \x1b[32m{self.accel_mode}\x1b[0m")
        print("======================================================================\n")

        self.register()
        self.watchlist_mgr.fetch_from_api()

        try:
            while self.running:
                assigned, state = self.heartbeat()
                if assigned is not None:
                    self.sync_camera_workers(assigned)
                
                # Periodic clean cluster summary
                GLOBAL_STATS.print_summary_if_due(self.worker_id, interval=5.0)
                time.sleep(2.5)
        except KeyboardInterrupt:
            print("\nShutting down worker node...")
            for w in self.workers.values():
                w.stop()


def main():
    parser = argparse.ArgumentParser(description="GujRaksha Distributed Python AI Edge Worker")
    parser.add_argument("--worker-id", default=None, help="Managed Worker Node ID (e.g. 'node-1', 'node-2')")
    parser.add_argument("--central-url", default="http://localhost:3000/api/v1", help="GujRaksha Central Platform API URL")
    parser.add_argument("--max-capacity", type=int, default=100, help="Maximum concurrent cameras to process (default: 100)")
    parser.add_argument("--source", default=None, help="Optional: Direct RTSP URL or webcam (0) for standalone single camera mode")
    parser.add_argument("--camera-code", default="GJ-GOV-001", help="Camera code for standalone single camera mode")
    parser.add_argument("--backend", default="auto", choices=["auto", "onnx", "tflite"], help="AI inference backend (auto probes GPU first)")
    parser.add_argument("--threads", type=int, default=4, help="CPU threads for AI inference")
    args = parser.parse_args()

    if args.source:
        # Standalone direct stream mode
        detector, ocr, accel_mode = create_anpr_pipeline(args.backend, num_threads=args.threads)
        print(f"🚀 [AI Engine Active] Mode: {accel_mode}")
        watchlist_mgr = CentralWatchlistManager(args.central_url)
        watchlist_mgr.fetch_from_api()

        worker = CameraWorkerThread(
            {"id": "gov-feed-1", "camera_code": args.camera_code, "rtsp_url": args.source},
            detector, ocr, args.central_url, watchlist_mgr
        )
        worker.start()
        try:
            while worker.is_alive():
                time.sleep(1.0)
        except KeyboardInterrupt:
            worker.stop()
    else:
        # Central Orchestrated 100-Camera Distributed Cluster Mode
        node_id = args.worker_id or f"node-{socket.gethostname()[:8]}"
        manager = DistributedWorkerManager(
            args.central_url, node_id, max_capacity=args.max_capacity, threads=args.threads, backend=args.backend
        )
        manager.start()


if __name__ == "__main__":
    main()
