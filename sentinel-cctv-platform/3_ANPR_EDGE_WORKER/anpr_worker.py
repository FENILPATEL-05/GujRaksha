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

# Suppress noisy OpenCV / FFMPEG probing logs and force zero-latency RTSP over TCP
os.environ["OPENCV_LOG_LEVEL"] = "ERROR"
os.environ["OPENCV_FFMPEG_LOGLEVEL"] = "-8"
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay|max_delay;50000|reorder_queue_size;0|buffer_size;102400"

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

try:
    import websocket
    HAS_WEBSOCKET = True
except ImportError:
    HAS_WEBSOCKET = False

# Import Modular Tracking and Anomaly Detection Engines
try:
    from movement_tracking import TrailTracker
    from anomaly_detection import DwellTracker
    from intrusion_detection import IntrusionZone
    from bytetrack_tracker import ByteTrackTracker
except ImportError:
    from .movement_tracking import TrailTracker
    from .anomaly_detection import DwellTracker
    from .intrusion_detection import IntrusionZone
    from .bytetrack_tracker import ByteTrackTracker

class VisionWebSocketClient:
    """Thread-safe WebSocket publisher & target synchronization with Central Command Platform."""
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self.ws = None
        self.lock = threading.Lock()
        self.last_attempt = 0
        self.active_camera_target = "GJ-GOV-001"
        if HAS_WEBSOCKET:
            self._connect()

    def _connect(self):
        if not HAS_WEBSOCKET:
            return
        now = time.time()
        if now - self.last_attempt < 2.0:
            return
        self.last_attempt = now
        try:
            self.ws = websocket.create_connection(self.ws_url, timeout=1.5)
            # Background listener to receive active camera target updates from UI
            threading.Thread(target=self._read_loop, daemon=True).start()
        except Exception:
            self.ws = None

    def _read_loop(self):
        while self.ws is not None:
            try:
                msg = self.ws.recv()
                if msg:
                    data = json.loads(msg)
                    if data.get("type") == "ACTIVE_VISION_TARGET":
                        target = data.get("active_camera_code")
                        if target:
                            self.active_camera_target = str(target).strip()
            except Exception:
                break

    def is_camera_active_target(self, camera_code: str, camera_id: str) -> bool:
        target = getattr(self, 'active_camera_target', None)
        if not target:
            return True
        t = str(target).strip().upper()
        cc = str(camera_code or '').strip().upper()
        ci = str(camera_id or '').strip().upper()
        return t == cc or t == ci or (cc and cc in t) or (t and t in cc) or (ci and ci in t) or (t and t in ci)

    def send_frame(self, payload: dict) -> bool:
        if not HAS_WEBSOCKET:
            return False
        with self.lock:
            if self.ws is None:
                self._connect()
            if self.ws is not None:
                try:
                    payload["type"] = "DETECTIONS_FRAME"
                    self.ws.send(json.dumps(payload))
                    return True
                except Exception:
                    try:
                        self.ws.close()
                    except Exception:
                        pass
                    self.ws = None
            return False

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DET_TFLITE = os.path.join(SCRIPT_DIR, "models/tflite/plate_detector.tflite")
DEFAULT_OCR_TFLITE = os.path.join(SCRIPT_DIR, "models/tflite/plate_ocr.tflite")
DEFAULT_OBJ_TFLITE = os.path.join(SCRIPT_DIR, "models/tflite/object_detection.tflite")
DEFAULT_DET_ONNX = os.path.join(SCRIPT_DIR, "models/onnx/plate_detector.onnx")
DEFAULT_OCR_ONNX = os.path.join(SCRIPT_DIR, "models/onnx/plate_ocr.onnx")
DEFAULT_OBJ_ONNX = os.path.join(SCRIPT_DIR, "models/onnx/object_detection.onnx")

DET_SIZE = 384
OCR_W, OCR_H = 128, 64
OCR_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

COCO_CLASSES = (
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
    'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
    'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
    'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
    'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
    'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
    'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
    'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
    'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
)

# Mandatory Surveillance Target Classes: Strictly Person, Car, Motorcycle, Bus, Truck
SURVEILLANCE_TARGET_CLASSES = {'person', 'car', 'motorcycle', 'bus', 'truck'}


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
        
        providers = ['CUDAExecutionProvider', 'TensorRTExecutionProvider', 'CPUExecutionProvider']
        avail = ort.get_available_providers()
        valid_providers = [p for p in providers if p in avail]
        
        sess_opts = ort.SessionOptions()
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=valid_providers)
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        
        active_provider = self.session.get_providers()[0]
        if "CUDA" not in active_provider and "TensorRT" not in active_provider:
            raise RuntimeError(f"ONNX session loaded on CPU ({active_provider}). CPU execution requires TFLite engine.")
        self.accel_mode = "GPU (NVIDIA CUDA)" if "CUDA" in active_provider else "GPU (TensorRT)"

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
        
        providers = ['CUDAExecutionProvider', 'TensorRTExecutionProvider', 'CPUExecutionProvider']
        avail = ort.get_available_providers()
        valid_providers = [p for p in providers if p in avail]
        
        sess_opts = ort.SessionOptions()
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=valid_providers)
        self.input_name = self.session.get_inputs()[0].name
        
        active_provider = self.session.get_providers()[0]
        if "CUDA" not in active_provider and "TensorRT" not in active_provider:
            raise RuntimeError(f"ONNX session loaded on CPU ({active_provider}). CPU execution requires TFLite engine.")
        self.accel_mode = "GPU (NVIDIA CUDA)" if "CUDA" in active_provider else "GPU (TensorRT)"

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


class ObjectDetectorONNX:
    """YOLO Object & Vehicle Detector using ONNX Runtime (CUDA / TensorRT GPU)."""
    def __init__(self, model_path: str):
        if not HAS_ONNXRUNTIME:
            raise RuntimeError("onnxruntime is not installed.")
        providers = ['CUDAExecutionProvider', 'TensorRTExecutionProvider', 'CPUExecutionProvider']
        avail = ort.get_available_providers()
        valid_providers = [p for p in providers if p in avail]
        sess_opts = ort.SessionOptions()
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=valid_providers)
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.input_shape = self.session.get_inputs()[0].shape
        self.input_size = 640 if (len(self.input_shape) >= 3 and self.input_shape[2] in [640, '640']) else 320
        
        active_provider = self.session.get_providers()[0]
        if "CUDA" not in active_provider and "TensorRT" not in active_provider:
            raise RuntimeError(f"ONNX session loaded on CPU ({active_provider}). CPU execution requires TFLite engine.")
        self.accel_mode = "GPU (NVIDIA CUDA)" if "CUDA" in active_provider else "GPU (TensorRT)"

    def preprocess(self, img: np.ndarray):
        h, w = img.shape[:2]
        scale = self.input_size / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        pad_w = (self.input_size - new_w) // 2
        pad_h = (self.input_size - new_h) // 2
        canvas = np.full((self.input_size, self.input_size, 3), 114, dtype=np.uint8)
        canvas[pad_h : pad_h + new_h, pad_w : pad_w + new_w] = resized
        canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        blob = (canvas_rgb.astype(np.float32) / 255.0)
        blob = np.transpose(blob, (2, 0, 1))[np.newaxis, :]
        return blob, scale, (pad_w, pad_h)

    def detect(self, img: np.ndarray, conf_thresh: float = 0.30, iou_thresh: float = 0.45):
        if img is None or img.size == 0:
            return []
        h, w = img.shape[:2]
        blob, scale, (pad_w, pad_h) = self.preprocess(img)
        outputs = self.session.run([self.output_name], {self.input_name: blob})
        raw = outputs[0][0]
        preds = raw.T if raw.shape[0] < raw.shape[1] else raw
        if len(preds) == 0:
            return []

        if preds.shape[1] >= 84:
            if preds.shape[1] == 84:
                class_probs = preds[:, 4:]
                class_ids = np.argmax(class_probs, axis=1)
                scores = class_probs[np.arange(len(preds)), class_ids]
            else:
                obj_conf = preds[:, 4]
                class_probs = preds[:, 5:]
                class_ids = np.argmax(class_probs, axis=1)
                scores = obj_conf * class_probs[np.arange(len(preds)), class_ids]

            mask = scores >= conf_thresh
            filtered = preds[mask]
            filtered_scores = scores[mask]
            filtered_classes = class_ids[mask]
            if len(filtered) == 0:
                return []

            cx, cy, bw, bh = filtered[:, 0], filtered[:, 1], filtered[:, 2], filtered[:, 3]
            if np.max(cx) <= 1.05:
                cx = cx * self.input_size
                cy = cy * self.input_size
                bw = bw * self.input_size
                bh = bh * self.input_size

            x1 = np.clip((cx - bw / 2.0 - pad_w) / scale, 0, w)
            y1 = np.clip((cy - bh / 2.0 - pad_h) / scale, 0, h)
            x2 = np.clip((cx + bw / 2.0 - pad_w) / scale, 0, w)
            y2 = np.clip((cy + bh / 2.0 - pad_h) / scale, 0, h)

            boxes = np.stack([x1, y1, x2 - x1, y2 - y1], axis=1).tolist()
            scores_list = filtered_scores.tolist()

            indices = cv2.dnn.NMSBoxes(boxes, scores_list, conf_thresh, iou_thresh)
            detections = []
            if len(indices) > 0:
                for idx in indices.flatten():
                    bx, by, bw_b, bh_b = boxes[idx]
                    cid = int(filtered_classes[idx])
                    cname = COCO_CLASSES[cid] if cid < len(COCO_CLASSES) else f'object_{cid}'
                    if cname not in SURVEILLANCE_TARGET_CLASSES:
                        continue
                    detections.append({
                        'box': [int(bx), int(by), int(bx + bw_b), int(by + bh_b)],
                        'class_id': cid,
                        'label': cname,
                        'confidence': float(scores_list[idx])
                    })
            return detections

        return []


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


class ObjectDetectorTFLite:
    """TFLite / LiteRT Object & Vehicle Detector (YOLO COCO 80 classes)."""
    def __init__(self, model_path: str, num_threads: int = None):
        self.interpreter, self.accel_mode = create_accelerated_interpreter(model_path, num_threads)
        self.input_details = self.interpreter.get_input_details()[0]
        self.output_details = self.interpreter.get_output_details()[0]
        self.input_shape = self.input_details['shape']
        self.input_size = int(self.input_shape[1]) if len(self.input_shape) >= 2 else 320

    def preprocess(self, img: np.ndarray):
        h, w = img.shape[:2]
        scale = min(self.input_size / h, self.input_size / w)
        new_w, new_h = int(round(w * scale)), int(round(h * scale))

        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        pad_w = (self.input_size - new_w) / 2.0
        pad_h = (self.input_size - new_h) / 2.0

        canvas = np.full((self.input_size, self.input_size, 3), 114, dtype=np.uint8)
        top, left = int(pad_h), int(pad_w)
        canvas[top : top + new_h, left : left + new_w] = resized

        canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        blob = (canvas_rgb.astype(np.float32) / 255.0)[np.newaxis, :]
        return blob, scale, (pad_w, pad_h)

    def detect(self, img: np.ndarray, conf_thresh: float = 0.30, iou_thresh: float = 0.45):
        if img is None or img.size == 0:
            return []
        h, w = img.shape[:2]
        blob, scale, (pad_w, pad_h) = self.preprocess(img)
        self.interpreter.set_tensor(self.input_details['index'], blob)
        self.interpreter.invoke()

        preds = self.interpreter.get_tensor(self.output_details['index'])[0]
        if len(preds) == 0:
            return []

        obj_conf = preds[:, 4]
        class_probs = preds[:, 5:]
        class_ids = np.argmax(class_probs, axis=1)
        class_scores = class_probs[np.arange(len(preds)), class_ids]
        scores = obj_conf * class_scores

        mask = scores >= conf_thresh
        filtered = preds[mask]
        filtered_scores = scores[mask]
        filtered_classes = class_ids[mask]

        if len(filtered) == 0:
            return []

        cx, cy, bw, bh = filtered[:, 0], filtered[:, 1], filtered[:, 2], filtered[:, 3]
        if np.max(cx) <= 1.05:
            cx_pix = cx * self.input_size
            cy_pix = cy * self.input_size
            bw_pix = bw * self.input_size
            bh_pix = bh * self.input_size
        else:
            cx_pix, cy_pix, bw_pix, bh_pix = cx, cy, bw, bh

        x1 = np.clip((cx_pix - bw_pix / 2.0 - pad_w) / scale, 0, w)
        y1 = np.clip((cy_pix - bh_pix / 2.0 - pad_h) / scale, 0, h)
        x2 = np.clip((cx_pix + bw_pix / 2.0 - pad_w) / scale, 0, w)
        y2 = np.clip((cy_pix + bh_pix / 2.0 - pad_h) / scale, 0, h)

        boxes = np.stack([x1, y1, x2 - x1, y2 - y1], axis=1).tolist()
        scores_list = filtered_scores.tolist()

        indices = cv2.dnn.NMSBoxes(boxes, scores_list, conf_thresh, iou_thresh)
        detections = []
        if len(indices) > 0:
            for idx in indices.flatten():
                bx, by, bw_b, bh_b = boxes[idx]
                cid = int(filtered_classes[idx])
                cname = COCO_CLASSES[cid] if cid < len(COCO_CLASSES) else f'object_{cid}'
                if cname not in SURVEILLANCE_TARGET_CLASSES:
                    continue
                detections.append({
                    'box': [int(bx), int(by), int(bx + bw_b), int(by + bh_b)],
                    'class_id': cid,
                    'label': cname,
                    'confidence': float(scores_list[idx])
                })
        return detections


class PlateDetectorTriton:
    """YOLO License Plate Detector using NVIDIA Triton Inference Server (gRPC)."""
    def __init__(self, triton_url: str = "localhost:8001", model_name: str = "yolo_detector"):
        from triton_client import TritonInferenceClient
        self.triton_client = TritonInferenceClient(url=triton_url, model_name=model_name, use_grpc=True)
        self.accel_mode = f"GPU Cluster (NVIDIA Triton Server @ {triton_url})"

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
        try:
            preds_raw = self.triton_client.infer(blob, input_name="images", output_name="output0")
            preds = preds_raw[0].T if preds_raw.ndim == 3 else preds_raw.T
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
        except Exception:
            return []


def create_anpr_pipeline(backend: str = "auto", num_threads: int = 4, triton_url: str = "localhost:8001"):
    """
    Adaptive GPU-First Pipeline Factory:
    - If backend is 'triton', connects to NVIDIA Triton Server via gRPC.
    - Auto-probes NVIDIA CUDA / TensorRT ONNX GPU acceleration.
    - Fallback to multi-threaded TFLite CPU engine if GPU is unavailable.
    """
    det_onnx_path = DEFAULT_DET_ONNX
    ocr_onnx_path = DEFAULT_OCR_ONNX
    obj_onnx_path = DEFAULT_OBJ_ONNX
    det_tflite_path = DEFAULT_DET_TFLITE
    ocr_tflite_path = DEFAULT_OCR_TFLITE
    obj_tflite_path = DEFAULT_OBJ_TFLITE

    if backend == "triton":
        try:
            detector = PlateDetectorTriton(triton_url=triton_url)
            ocr = PlateOCRTFLite(ocr_tflite_path, num_threads=num_threads)
            obj_det = ObjectDetectorTFLite(obj_tflite_path, num_threads=num_threads) if os.path.exists(obj_tflite_path) else None
            return detector, ocr, obj_det, detector.accel_mode
        except Exception as err:
            print(f"⚠️ Triton Server connection failed ({err}). Falling back to local engine...")

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
            obj_det = ObjectDetectorONNX(obj_onnx_path) if os.path.exists(obj_onnx_path) else (
                ObjectDetectorTFLite(obj_tflite_path, num_threads=num_threads) if os.path.exists(obj_tflite_path) else None
            )
            return detector, ocr, obj_det, detector.accel_mode
        except Exception:
            pass

    detector = PlateDetectorTFLite(det_tflite_path, num_threads=num_threads)
    ocr = PlateOCRTFLite(ocr_tflite_path, num_threads=num_threads)
    obj_det = ObjectDetectorTFLite(obj_tflite_path, num_threads=num_threads) if os.path.exists(obj_tflite_path) else None
    return detector, ocr, obj_det, detector.accel_mode


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


GLOBAL_VISION_WS = None
GLOBAL_VISION_WS_LOCK = threading.Lock()

def get_shared_vision_ws(central_url: str):
    global GLOBAL_VISION_WS
    with GLOBAL_VISION_WS_LOCK:
        if GLOBAL_VISION_WS is None:
            ws_host = central_url.replace("http://", "ws://").replace("https://", "wss://").replace("/api/v1", "").replace("/api", "").rstrip("/")
            GLOBAL_VISION_WS = VisionWebSocketClient(f"{ws_host}/ws/ai-vision")
        return GLOBAL_VISION_WS


class CameraWorkerThread(threading.Thread):
    """
    Worker processing a single assigned camera RTSP stream.
    Features:
    - Quiet background retry if stream is unreachable/offline (no error log spam).
    - Throttled clean ANPR logs when scanning normal traffic.
    - High-visibility alert when Watchlist Target is spotted.
    """
    def __init__(self, cam_info: dict, detector, ocr, object_detector, central_url: str, watchlist_mgr: CentralWatchlistManager,
                 conf: float = 0.20, iou: float = 0.45, frame_stride: int = 3):
        super().__init__(daemon=True)
        self.cam_info = cam_info
        self.camera_id = cam_info.get("id") or "gov-feed-1"
        self.camera_code = cam_info.get("camera_code") or "GJ-GOV-001"
        self.stream_url = cam_info.get("rtsp_url") or cam_info.get("stream_url") or "0"
        self.detector = detector
        self.ocr = ocr
        self.object_detector = object_detector
        self.central_url = central_url.rstrip("/")
        self.watchlist_mgr = watchlist_mgr
        self.conf = conf
        self.iou = iou
        self.frame_stride = max(1, frame_stride)
        self.speed_tracker = VehicleSpeedTracker(speed_limit=80)
        self.byte_tracker = ByteTrackTracker(max_lost=25, iou_thresh=0.25, high_conf_thresh=0.25)
        self.trail_tracker = TrailTracker(max_trail_length=45)
        self.dwell_tracker = DwellTracker(dwell_threshold=8.0)
        self.intrusion_zone = None
        self.running = True
        self.recent_detections = {}
        self.is_connected = False
        self.last_live_dispatch = 0
        self.last_obj_log = 0
        
        # Single shared WebSocket connection for the entire edge worker process
        self.ws_client = get_shared_vision_ws(self.central_url)

    def stop(self):
        self.running = False

    def open_capture(self):
        try:
            if str(self.stream_url).isdigit():
                cap = cv2.VideoCapture(int(self.stream_url), cv2.CAP_V4L2)
            else:
                cap = cv2.VideoCapture(str(self.stream_url), cv2.CAP_FFMPEG)
            
            if cap and cap.isOpened():
                try:
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                except Exception:
                    pass
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

            # 2. Frame Processing Loop (Synchronized Real-Time Capture)
            try:
                # Flush buffer for live network streams so inference is always on the latest frame
                if str(self.stream_url).startswith("rtsp://") or str(self.stream_url).startswith("rtsps://") or "stream" in str(self.stream_url):
                    for _ in range(4):
                        cap.grab()

                ret, frame = cap.read()
                if not ret or frame is None or frame.shape[0] < 50:
                    cap.release()
                    cap = None
                    GLOBAL_STATS.set_status(self.camera_code, "OFFLINE")
                    time.sleep(0.5)
                    continue

                frame_counter += 1
                now = time.time()

                is_selected_vision_cam = self.ws_client.is_camera_active_target(self.camera_code, self.camera_id) if self.ws_client else True
                effective_stride = 1 if is_selected_vision_cam else self.frame_stride

                if effective_stride > 1 and (frame_counter % effective_stride != 0):
                    continue

                h, w = frame.shape[:2]

                cam_mode = str(self.cam_info.get("detection_mode") or "").upper()
                is_anpr_cam = (cam_mode != "GENERAL_SURVEILLANCE") and (self.detector is not None)
                is_obj_cam = (self.object_detector is not None)

                # 3. License Plate Detection (ANPR & Vehicle OCR)
                raw_boxes = []
                if is_anpr_cam and self.detector is not None:
                    if hasattr(self.detector, "triton_client") or getattr(self.detector, "accel_mode", "").startswith("GPU"):
                        raw_boxes = self.detector.detect(frame, self.conf, self.iou)
                    else:
                        with INFERENCE_LOCK:
                            raw_boxes = self.detector.detect(frame, self.conf, self.iou)

                # 4. Target-Specific Object & Vehicle Detection (Person, Car, Motorcycle, Bus, Truck)
                raw_objects = []
                is_selected_vision_cam = self.ws_client.is_camera_active_target(self.camera_code, self.camera_id) if self.ws_client else True

                if (is_obj_cam or is_selected_vision_cam) and self.object_detector is not None:
                    if hasattr(self.object_detector, "triton_client") or getattr(self.object_detector, "accel_mode", "").startswith("GPU"):
                        raw_objects = self.object_detector.detect(frame, conf_thresh=0.25, iou_thresh=0.45)
                    else:
                        with INFERENCE_LOCK:
                            raw_objects = self.object_detector.detect(frame, conf_thresh=0.25, iou_thresh=0.45)



                # Initialize default virtual intrusion security perimeter zone if not present
                if self.intrusion_zone is None and (w > 0 and h > 0):
                    default_pts = [
                        [int(w * 0.15), int(h * 0.45)],
                        [int(w * 0.85), int(h * 0.45)],
                        [int(w * 0.95), int(h * 0.88)],
                        [int(w * 0.05), int(h * 0.88)]
                    ]
                    self.intrusion_zone = IntrusionZone(default_pts)

                # 4.2. ByteTrack Multi-Object Association & Persistent Tracking
                tracked_objects = self.byte_tracker.update(raw_objects) if len(raw_objects) > 0 else []

                # 4.3. Movement Trail Tracking, Dwell Loitering & Perimeter Intrusion Checks
                active_track_keys = []
                for obj in tracked_objects:
                    bx = obj["box"]
                    lbl = obj["label"]
                    track_id = obj.get("track_id")
                    x1, y1, x2, y2 = bx
                    cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
                    norm_cx, norm_cy = cx / max(1, w), cy / max(1, h)

                    if track_id is not None:
                        key = (lbl, track_id)
                        active_track_keys.append(key)
                        
                        # 1. Update Motion Trajectory History
                        self.trail_tracker.update(lbl, track_id, cx, cy, norm_cx, norm_cy, now)
                        
                        # 2. Check Loitering Anomaly (Dwell > 8.0s)
                        is_loitering, dwell_time = self.dwell_tracker.update(lbl, track_id, inside=True)
                        obj["is_loitering"] = is_loitering
                        obj["dwell_time"] = round(dwell_time, 1)

                        # 3. Check Virtual Perimeter Intrusion Zone
                        if self.intrusion_zone is not None:
                            is_inside, entered, _ = self.intrusion_zone.check(lbl, track_id, (x1, y1, x2, y2))
                            obj["is_intrusion"] = is_inside
                        else:
                            obj["is_intrusion"] = False

                        # Attach normalized movement trail points for frontend canvas HUD
                        obj["trail_points"] = self.trail_tracker.get_normalized_points(lbl, track_id)

                self.dwell_tracker.cleanup_stale(active_track_keys)
                self.trail_tracker.cleanup_stale(max_age_seconds=8.0)

                # 4.5. Terminal Log for Detected & Tracked Objects (Only for active vision camera)
                if (is_selected_vision_cam or is_obj_cam) and len(tracked_objects) > 0 and (now - self.last_obj_log >= 1.5):
                    self.last_obj_log = now
                    obj_counts = {}
                    for obj in tracked_objects:
                        lbl = obj["label"].capitalize()
                        obj_counts[lbl] = obj_counts.get(lbl, 0) + 1
                    details_str = ", ".join([f"{cnt}x {lbl}" for lbl, cnt in obj_counts.items()])
                    time_str = time.strftime('%H:%M:%S')
                    print(f"\x1b[35m[AI TRACK]\x1b[0m 🎯 \x1b[33m[{self.camera_code}]\x1b[0m ByteTrack: \x1b[1m\x1b[37m{details_str}\x1b[0m (Active Tracks: {len(tracked_objects)}) | Time: {time_str}", flush=True)

                # 5. Process Plate OCR & Watchlist Ingestion
                plate_detections_for_frame = []
                for x1, y1, x2, y2, det_score in raw_boxes:
                    if (x2 - x1) < 20 or (y2 - y1) < 10:
                        continue

                    if getattr(self.ocr, "accel_mode", "").startswith("GPU"):
                        raw_text, ocr_conf = self.ocr.recognize(frame, (x1, y1, x2, y2))
                    else:
                        with INFERENCE_LOCK:
                            raw_text, ocr_conf = self.ocr.recognize(frame, (x1, y1, x2, y2))
                    cleaned_text = normalize_ocr_text(raw_text)

                    if cleaned_text and len(cleaned_text) >= 4:
                        last_seen = self.recent_detections.get(cleaned_text, 0)
                        if now - last_seen > 3.0:
                            self.recent_detections[cleaned_text] = now

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

                        plate_detections_for_frame.append({
                            "box": [x1, y1, x2, y2],
                            "normalized_box": [round(y1 / h, 4), round(x1 / w, 4), round(y2 / h, 4), round(x2 / w, 4)],
                            "label": f"PLATE: {cleaned_text}" if cleaned_text else "LICENSE_PLATE",
                            "plate": cleaned_text,
                            "confidence": round(ocr_conf * 100.0, 1),
                            "type": "PLATE"
                        })
                    else:
                        plate_detections_for_frame.append({
                            "box": [x1, y1, x2, y2],
                            "normalized_box": [round(y1 / h, 4), round(x1 / w, 4), round(y2 / h, 4), round(x2 / w, 4)],
                            "label": "LICENSE_PLATE",
                            "confidence": round(det_score * 100.0, 1),
                            "type": "PLATE"
                        })

                # 6. Stream Live AI Bounding Boxes (Objects + Plates) to Central Platform for Live Surveillance Feed
                if (now - self.last_live_dispatch >= 0.025) and (len(tracked_objects) > 0 or len(plate_detections_for_frame) > 0 or frame_counter % 5 == 0):
                    self.last_live_dispatch = now
                    live_boxes = []

                    for obj in tracked_objects:
                        lbl_lower = str(obj.get("label", "")).lower()
                        if lbl_lower not in SURVEILLANCE_TARGET_CLASSES:
                            continue

                        bx = obj["box"]
                        track_id = obj.get("track_id")
                        label_str = obj["label"].upper() + (f" #{track_id}" if track_id is not None else "")
                        if obj.get("is_loitering"):
                            label_str += f" [LOITERING {obj.get('dwell_time', 0):.0f}s]"
                        elif obj.get("is_intrusion"):
                            label_str += " [INTRUSION]"

                        live_boxes.append({
                            "box": bx,
                            "normalized_box": [round(bx[1] / h, 4), round(bx[0] / w, 4), round(bx[3] / h, 4), round(bx[2] / w, 4)],
                            "label": label_str,
                            "class_name": obj["label"],
                            "class_id": obj.get("class_id", 0),
                            "confidence": round(obj.get("confidence", 0.0) * 100.0, 1),
                            "track_id": track_id,
                            "trail_points": obj.get("trail_points", []),
                            "is_loitering": bool(obj.get("is_loitering")),
                            "dwell_time": obj.get("dwell_time", 0.0),
                            "is_intrusion": bool(obj.get("is_intrusion")),
                            "type": "OBJECT"
                        })

                    live_boxes.extend(plate_detections_for_frame)


                    live_payload = {
                        "camera_code": self.camera_code,
                        "camera_id": self.camera_id,
                        "frame_width": w,
                        "frame_height": h,
                        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                        "detections": live_boxes
                    }
                    # Fast low-latency transmission over WebSocket
                    sent_ws = False
                    if self.ws_client is not None:
                        sent_ws = self.ws_client.send_frame(live_payload)

                    if not sent_ws:
                        try:
                            live_bytes = json.dumps(live_payload).encode('utf-8')
                            req_live = urllib.request.Request(
                                f"{self.central_url}/anpr/live-detections",
                                data=live_bytes,
                                headers={"Content-Type": "application/json"},
                                method="POST"
                            )
                            with urllib.request.urlopen(req_live, timeout=1.0) as resp:
                                pass
                        except Exception:
                            pass

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
    def __init__(self, central_url: str, worker_id: str, max_capacity: int = 100, threads: int = 4, backend: str = "auto", triton_url: str = "localhost:8001"):
        self.central_url = central_url.rstrip("/")
        self.worker_id = worker_id or f"node-{socket.gethostname()[:8]}"
        self.max_capacity = max_capacity
        self.threads = threads
        self.triton_url = triton_url
        self.detector, self.ocr, self.object_detector, self.accel_mode = create_anpr_pipeline(backend, num_threads=threads, triton_url=triton_url)
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
                print(f"📡 [Central Orchestrator] Worker \x1b[36m{self.worker_id}\x1b[0m connected to Central CCC", flush=True)
                print(f"   🧠 AI Vision Engine: \x1b[1m\x1b[32mACTIVE\x1b[0m (YOLOv9 Object Detection & ANPR OCR Pipeline | {self.accel_mode})", flush=True)
                print(f"   📋 Watchlist Database: \x1b[33m{len(self.watchlist_mgr.watchlist_map)} suspect targets\x1b[0m loaded", flush=True)
                print(f"   📊 Node Status: \x1b[35mSTANDBY / READY\x1b[0m (Awaiting Central camera dispatch)", flush=True)
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
                    cam, self.detector, self.ocr, self.object_detector, self.central_url, self.watchlist_mgr,
                    conf=0.20, iou=0.45, frame_stride=3
                )
                worker.start()
                self.workers[code] = worker
                newly_attached += 1

        if newly_attached > 0:
            obj_cams = [c for c in assigned_cameras if c.get("detection_mode") == "OBJECT_DETECTION"]
            anpr_cams = [c for c in assigned_cameras if c.get("detection_mode") != "OBJECT_DETECTION"]

            print(f"\n⚡ \x1b[1m\x1b[32m[Cluster Dispatch] {len(assigned_cameras)} Cameras Auto-Assigned by Central CCC\x1b[0m", flush=True)
            if len(obj_cams) > 0:
                obj_codes = ", ".join([c.get("camera_code") or c.get("id") for c in obj_cams[:4]])
                print(f"   🎯 \x1b[35m[AI OBJECT DETECTION]\x1b[0m {len(obj_cams)} Feeds Active ({obj_codes})", flush=True)
            if len(anpr_cams) > 0:
                print(f"   🚗 \x1b[36m[ANPR SCANNER]\x1b[0m {len(anpr_cams)} Feeds Active (License Plate Recognition & Watchlist)", flush=True)
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
            print(f"⏹️ [Cluster Dispatch] Revoked {detached} cameras (Active feeds: {len(assigned_cameras)}).", flush=True)

    def start(self):
        print("======================================================================")
        print(" 🚔 GUJRAKSHA DISTRIBUTED AI ANPR & OBJECT DETECTION WORKER NODE")
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
    parser.add_argument("--backend", default="auto", choices=["auto", "triton", "onnx", "tflite"], help="AI inference backend (auto probes GPU first)")
    parser.add_argument("--triton-url", default="localhost:8001", help="NVIDIA Triton Server gRPC URL (e.g. 'localhost:8001')")
    parser.add_argument("--threads", type=int, default=4, help="CPU threads for AI inference")
    args = parser.parse_args()

    if args.source:
        # Standalone direct stream mode
        detector, ocr, obj_det, accel_mode = create_anpr_pipeline(args.backend, num_threads=args.threads, triton_url=args.triton_url)
        print(f"🚀 [AI Engine Active] Mode: {accel_mode}")
        watchlist_mgr = CentralWatchlistManager(args.central_url)
        watchlist_mgr.fetch_from_api()

        worker = CameraWorkerThread(
            {"id": "gov-feed-1", "camera_code": args.camera_code, "rtsp_url": args.source},
            detector, ocr, obj_det, args.central_url, watchlist_mgr
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
            args.central_url, node_id, max_capacity=args.max_capacity, threads=args.threads, backend=args.backend, triton_url=args.triton_url
        )
        manager.start()


if __name__ == "__main__":
    main()
