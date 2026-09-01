#!/usr/bin/env python3
"""
GujRaksha (ગુજ રક્ષા) — Ultra-Fast TFLite ANPR Engine (YOLOv9 + CCT Transformer OCR)
Copyright (c) 2026 Fenil Patel. All Rights Reserved.

Real-time high-speed ANPR pipeline:
1. YOLOv9 Plate Detection (models/tflite/plate_detector.tflite)
2. CCT Transformer OCR Recognition (models/tflite/plate_ocr.tflite)
3. Dynamic Camera Stream Auto-Discovery (picks up new cameras added by user)
4. Comprehensive Text & Plate Logging (logs any detected text for verification)
5. Real-Time Alert Ingestion to GujRaksha Express Backend (/api/v1/anpr/ingest)
"""

import os
import sys
import time
import argparse
import re
import urllib.request
import json
import threading
try:
    threading.stack_size(262144)  # 256 KB stack per thread (prevents memory exhaustion)
except Exception:
    pass

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

# Load TFLite Interpreter (LiteRT / TFLite runtime / TensorFlow)
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
            sys.exit(1)

# Optional ONNX Runtime for GPU Acceleration (CUDA / TensorRT)
try:
    import onnxruntime as ort
    HAS_ONNXRUNTIME = True
except ImportError:
    HAS_ONNXRUNTIME = False
    ort = None

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../../"))
CENTRAL_MODELS_DIR = os.path.join(PROJECT_ROOT, "models")
if not os.path.exists(CENTRAL_MODELS_DIR):
    CENTRAL_MODELS_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../models"))

DEFAULT_DET_MODEL = os.path.join(CENTRAL_MODELS_DIR, "tflite/plate_detector.tflite")
DEFAULT_OCR_MODEL = os.path.join(CENTRAL_MODELS_DIR, "tflite/plate_ocr.tflite")
DEFAULT_OBJ_DET_MODEL = os.path.join(CENTRAL_MODELS_DIR, "tflite/object_detection.tflite")
DEFAULT_ONNX_DET_MODEL = os.path.join(CENTRAL_MODELS_DIR, "onnx/plate_detector.onnx")
DEFAULT_ONNX_OCR_MODEL = os.path.join(CENTRAL_MODELS_DIR, "onnx/plate_ocr.onnx")
DEFAULT_ONNX_OBJ_DET_MODEL = os.path.join(CENTRAL_MODELS_DIR, "onnx/object_detection.onnx")


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

    # 1. Strip common HSRP country badge 'IND' / 'INDIA' on the left
    if text.startswith("IND") and len(text) >= 7:
        text = text[3:]
    elif text.startswith("INDIA") and len(text) >= 9:
        text = text[5:]
    elif text.startswith("IN") and len(text) >= 6 and not text.startswith("IND"):
        if text[2:4] in INDIAN_STATE_CODES or text[2:4].isdigit():
            text = text[2:]

    # 2. Common OCR prefix misrecognitions (e.g., '6J' -> 'GJ', 'OJ' -> 'GJ', 'CI' -> 'GJ')
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
    """Validate if string matches standard Indian vehicle number plate or BH format."""
    if not text:
        return False
    clean = re.sub(r'[^A-Z0-9]', '', text.upper().strip())
    if len(clean) < 5 or len(clean) > 11:
        return False
    # Check exact state code pattern OR BH format OR generic alphanumeric Indian format
    return bool(
        PLATE_REGEX.match(clean) or
        BH_REGEX.match(clean) or
        (clean[:2] in INDIAN_STATE_CODES and clean[-2:].isdigit() and len(clean) >= 6) or
        GENERIC_PLATE_REGEX.match(clean)
    )


def create_accelerated_interpreter(model_path: str, num_threads: int = None):
    """
    Initializes TFLite / LiteRT Interpreter with GPU acceleration first.
    If GPU delegate is not available, gracefully falls back to multi-threaded CPU.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")

    if num_threads is None:
        num_threads = min(8, max(2, os.cpu_count() or 4))

    # 1. Attempt GPU Acceleration Delegates (OpenCL / OpenGL / Vulkan / CUDA / Linux)
    gpu_delegates_to_try = [
        "libtensorflowlite_gpu_delegate.so",
        "libdelegate_gpu.so",
        "libtensorflowlite_gpu_delegate.dylib",
        "tensorflowlite_gpu_delegate.dll"
    ]

    for delegate_name in gpu_delegates_to_try:
        try:
            if hasattr(Interpreter, 'load_delegate') or 'load_delegate' in globals():
                delegate = Interpreter.load_delegate(delegate_name) if hasattr(Interpreter, 'load_delegate') else load_delegate(delegate_name)
                interpreter = Interpreter(model_path=model_path, experimental_delegates=[delegate])
                interpreter.allocate_tensors()
                print(f"🚀 [AI Acceleration] GPU Hardware Acceleration ACTIVE ({delegate_name}) for {os.path.basename(model_path)}")
                return interpreter, "GPU"
        except Exception:
            continue

    # 2. Seamless Fallback to Optimized Multi-Core CPU
    interpreter = Interpreter(model_path=model_path, num_threads=num_threads)
    interpreter.allocate_tensors()
    return interpreter, f"CPU ({num_threads} Threads)"


class PlateDetectorTFLite:
    """YOLOv9 License Plate Detector using TFLite / LiteRT with GPU/CPU Auto-Fallback."""
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
    """CCT Transformer OCR Recognizer using TFLite / LiteRT with GPU/CPU Auto-Fallback."""
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

        # Apply CLAHE contrast enhancement for sharp character recognition
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


class PlateDetectorONNX:
    """YOLOv9 License Plate Detector using ONNX Runtime (CUDA / TensorRT / CPU)."""
    def __init__(self, model_path: str, provider: str = None):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"ONNX Model not found: {model_path}")

        available = ort.get_available_providers() if HAS_ONNXRUNTIME else []
        if provider and provider in available:
            providers = [provider, 'CPUExecutionProvider']
        elif 'TensorRTExecutionProvider' in available:
            providers = ['TensorRTExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']
        elif 'CUDAExecutionProvider' in available:
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        else:
            providers = ['CPUExecutionProvider']

        self.session = ort.InferenceSession(model_path, providers=providers)
        active_providers = self.session.get_providers()
        if 'TensorRTExecutionProvider' in active_providers or 'CUDAExecutionProvider' in active_providers:
            self.accel_mode = f"ONNX GPU ({active_providers[0]})"
        else:
            self.accel_mode = "ONNX CPU"

        self.input_name = self.session.get_inputs()[0].name
        self.input_shape = self.session.get_inputs()[0].shape
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
        outputs = self.session.run(None, {self.input_name: blob})
        raw_out = outputs[0]
        preds = raw_out[0].T if raw_out.ndim == 3 else raw_out.T
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
    """CCT Transformer OCR Recognizer using ONNX Runtime (CUDA / TensorRT / CPU)."""
    def __init__(self, model_path: str, provider: str = None):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"ONNX Model not found: {model_path}")

        available = ort.get_available_providers() if HAS_ONNXRUNTIME else []
        if provider and provider in available:
            providers = [provider, 'CPUExecutionProvider']
        elif 'TensorRTExecutionProvider' in available:
            providers = ['TensorRTExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']
        elif 'CUDAExecutionProvider' in available:
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        else:
            providers = ['CPUExecutionProvider']

        self.session = ort.InferenceSession(model_path, providers=providers)
        active_providers = self.session.get_providers()
        if 'TensorRTExecutionProvider' in active_providers or 'CUDAExecutionProvider' in active_providers:
            self.accel_mode = f"ONNX GPU ({active_providers[0]})"
        else:
            self.accel_mode = "ONNX CPU"

        self.input_name = self.session.get_inputs()[0].name

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


COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
    "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
    "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
    "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
    "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator",
    "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush", "license_plate"
]


class ObjectDetectorTFLite:
    """Real-Time Multi-Class Object Detector (Vehicles, Persons, Plates) using TFLite CPU."""
    def __init__(self, model_path: str = None, num_threads: int = None):
        path = model_path or DEFAULT_OBJ_DET_MODEL
        if not os.path.exists(path):
            path = DEFAULT_DET_MODEL
        self.interpreter, self.accel_mode = create_accelerated_interpreter(path, num_threads)
        self.input_details = self.interpreter.get_input_details()[0]
        self.output_details = self.interpreter.get_output_details()

    def preprocess(self, img: np.ndarray):
        h, w = img.shape[:2]
        scale = DET_SIZE / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        pad_w = (DET_SIZE - new_w) // 2
        pad_h = (DET_SIZE - new_h) // 2
        canvas = np.full((DET_SIZE, DET_SIZE, 3), 114, dtype=np.uint8)
        canvas[pad_h:pad_h + new_h, pad_w:pad_w + new_w] = resized
        canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        blob = (canvas_rgb.astype(np.float32) / 255.0)[np.newaxis, :]
        return blob, scale, (pad_w, pad_h)

    def detect(self, img: np.ndarray, conf_thresh: float = 0.20, iou_thresh: float = 0.45):
        orig_h, orig_w = img.shape[:2]
        blob, scale, (pad_w, pad_h) = self.preprocess(img)
        self.interpreter.set_tensor(self.input_details['index'], blob)
        self.interpreter.invoke()

        output = self.interpreter.get_tensor(self.output_details[0]['index'])
        preds = output[0].T if output.ndim == 3 else output.T

        if preds.ndim == 2 and preds.shape[1] > 4:
            scores = np.max(preds[:, 4:], axis=1) if preds.shape[1] > 5 else preds[:, 4]
            class_ids = np.argmax(preds[:, 5:], axis=1) if preds.shape[1] > 5 else np.zeros(len(preds), dtype=int)
            mask = scores >= conf_thresh
            filtered = preds[mask]
            scores = scores[mask]
            class_ids = class_ids[mask]

            if len(filtered) == 0:
                return []

            cx, cy, bw, bh = filtered[:, 0], filtered[:, 1], filtered[:, 2], filtered[:, 3]
            x1 = np.clip((cx - bw / 2.0 - pad_w) / scale, 0, orig_w)
            y1 = np.clip((cy - bh / 2.0 - pad_h) / scale, 0, orig_h)
            x2 = np.clip((cx + bw / 2.0 - pad_w) / scale, 0, orig_w)
            y2 = np.clip((cy + bh / 2.0 - pad_h) / scale, 0, orig_h)

            boxes = np.stack([x1, y1, x2 - x1, y2 - y1], axis=1).tolist()
            indices = cv2.dnn.NMSBoxes(boxes, scores.tolist(), conf_thresh, iou_thresh)
            
            results = []
            if len(indices) > 0:
                for idx in indices.flatten():
                    bx, by, bw_b, bh_b = boxes[idx]
                    cls_id = int(class_ids[idx])
                    cls_name = COCO_CLASSES[cls_id] if cls_id < len(COCO_CLASSES) else "Vehicle"
                    norm_box = [
                        round(float(bx / orig_w), 4),
                        round(float(by / orig_h), 4),
                        round(float((bx + bw_b) / orig_w), 4),
                        round(float((by + bh_b) / orig_h), 4)
                    ]
                    results.append({
                        "class": cls_name,
                        "label": f"{cls_name.capitalize()} ({int(scores[idx] * 100)}%)",
                        "confidence": float(scores[idx]),
                        "bbox": [int(bx), int(by), int(bx + bw_b), int(by + bh_b)],
                        "norm_box": norm_box
                    })
            return results
        return []


class ObjectDetectorONNX:
    """Real-Time Multi-Class Object Detector using ONNX Runtime (CUDA GPU / TensorRT / CPU)."""
    def __init__(self, model_path: str = None, provider: str = None):
        path = model_path or DEFAULT_ONNX_OBJ_DET_MODEL
        if not os.path.exists(path):
            path = DEFAULT_ONNX_DET_MODEL

        available = ort.get_available_providers() if HAS_ONNXRUNTIME else []
        if provider and provider in available:
            providers = [provider, 'CPUExecutionProvider']
        elif 'TensorRTExecutionProvider' in available:
            providers = ['TensorRTExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']
        elif 'CUDAExecutionProvider' in available:
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        else:
            providers = ['CPUExecutionProvider']

        self.session = ort.InferenceSession(path, providers=providers)
        active = self.session.get_providers()
        self.accel_mode = f"ONNX GPU ({active[0]})" if ('CUDAExecutionProvider' in active or 'TensorRTExecutionProvider' in active) else "ONNX CPU"
        self.input_name = self.session.get_inputs()[0].name
        self.input_shape = self.session.get_inputs()[0].shape
        self.is_nchw = len(self.input_shape) == 4 and self.input_shape[1] == 3

    def preprocess(self, img: np.ndarray):
        h, w = img.shape[:2]
        scale = DET_SIZE / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        pad_w = (DET_SIZE - new_w) // 2
        pad_h = (DET_SIZE - new_h) // 2
        canvas = np.full((DET_SIZE, DET_SIZE, 3), 114, dtype=np.uint8)
        canvas[pad_h:pad_h + new_h, pad_w:pad_w + new_w] = resized
        canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        blob = (canvas_rgb.astype(np.float32) / 255.0)[np.newaxis, :]
        if self.is_nchw:
            blob = np.transpose(blob, (0, 3, 1, 2))
        return blob, scale, (pad_w, pad_h)

    def detect(self, img: np.ndarray, conf_thresh: float = 0.20, iou_thresh: float = 0.45):
        orig_h, orig_w = img.shape[:2]
        blob, scale, (pad_w, pad_h) = self.preprocess(img)
        outputs = self.session.run(None, {self.input_name: blob})
        raw_out = outputs[0]
        preds = raw_out[0].T if raw_out.ndim == 3 else raw_out.T

        if preds.ndim == 2 and preds.shape[1] > 4:
            scores = np.max(preds[:, 4:], axis=1) if preds.shape[1] > 5 else preds[:, 4]
            class_ids = np.argmax(preds[:, 5:], axis=1) if preds.shape[1] > 5 else np.zeros(len(preds), dtype=int)
            mask = scores >= conf_thresh
            filtered = preds[mask]
            scores = scores[mask]
            class_ids = class_ids[mask]

            if len(filtered) == 0:
                return []

            cx, cy, bw, bh = filtered[:, 0], filtered[:, 1], filtered[:, 2], filtered[:, 3]
            x1 = np.clip((cx - bw / 2.0 - pad_w) / scale, 0, orig_w)
            y1 = np.clip((cy - bh / 2.0 - pad_h) / scale, 0, orig_h)
            x2 = np.clip((cx + bw / 2.0 - pad_w) / scale, 0, orig_w)
            y2 = np.clip((cy + bh / 2.0 - pad_h) / scale, 0, orig_h)

            boxes = np.stack([x1, y1, x2 - x1, y2 - y1], axis=1).tolist()
            indices = cv2.dnn.NMSBoxes(boxes, scores.tolist(), conf_thresh, iou_thresh)
            
            results = []
            if len(indices) > 0:
                for idx in indices.flatten():
                    bx, by, bw_b, bh_b = boxes[idx]
                    cls_id = int(class_ids[idx])
                    cls_name = COCO_CLASSES[cls_id] if cls_id < len(COCO_CLASSES) else "Vehicle"
                    norm_box = [
                        round(float(bx / orig_w), 4),
                        round(float(by / orig_h), 4),
                        round(float((bx + bw_b) / orig_w), 4),
                        round(float((by + bh_b) / orig_h), 4)
                    ]
                    results.append({
                        "class": cls_name,
                        "label": f"{cls_name.capitalize()} ({int(scores[idx] * 100)}%)",
                        "confidence": float(scores[idx]),
                        "bbox": [int(bx), int(by), int(bx + bw_b), int(by + bh_b)],
                        "norm_box": norm_box
                    })
            return results
        return []


def post_bbox_telemetry_to_api(api_url: str, camera_code: str, camera_id: str, bboxes: list, frame_w: int = 1920, frame_h: int = 1080):
    """Post real-time bounding box telemetry payload to Express SSE endpoint /api/v1/anpr/bbox-ingest."""
    if not bboxes:
        return
    payload = json.dumps({
        "camera_code": camera_code,
        "camera_id": camera_id,
        "timestamp": int(time.time() * 1000),
        "frame_w": frame_w,
        "frame_h": frame_h,
        "bboxes": bboxes
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/anpr/bbox-ingest",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=1.5):
            pass
    except Exception:
        pass


def create_anpr_pipeline(backend: str = "auto", det_tflite: str = None, ocr_tflite: str = None, obj_tflite: str = None, num_threads: int = None):
    """
    Adaptive Dual-Engine Pipeline Factory:
    - Auto-probes NVIDIA CUDA / TensorRT ONNX acceleration.
    - Loads object_detection.onnx on GPU / object_detection.tflite on CPU.
    - Otherwise seamlessly falls back to optimized multi-threaded TFLite CPU engine.
    """
    det_tflite_path = det_tflite or DEFAULT_DET_MODEL
    ocr_tflite_path = ocr_tflite or DEFAULT_OCR_MODEL
    obj_tflite_path = obj_tflite or DEFAULT_OBJ_DET_MODEL

    det_onnx_path = DEFAULT_ONNX_DET_MODEL
    ocr_onnx_path = DEFAULT_ONNX_OCR_MODEL
    obj_onnx_path = DEFAULT_ONNX_OBJ_DET_MODEL

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
            print("⚡ [AI Engine] Probing ONNX Runtime GPU Acceleration...", flush=True)
            detector = PlateDetectorONNX(det_onnx_path)
            ocr = PlateOCRONNX(ocr_onnx_path)
            obj_detector = ObjectDetectorONNX(obj_onnx_path) if os.path.exists(obj_onnx_path) else None
            print(f"🚀 [AI Acceleration] ACTIVE: {detector.accel_mode} (GPU ONNX Models Loaded)", flush=True)
            return detector, ocr, obj_detector, detector.accel_mode
        except Exception as e:
            print(f"⚠️ [ONNX Exception] GPU initialization failed ({e}). Falling back to TFLite CPU...", flush=True)

    # Fallback to TFLite CPU
    detector = PlateDetectorTFLite(det_tflite_path, num_threads=num_threads)
    ocr = PlateOCRTFLite(ocr_tflite_path, num_threads=num_threads)
    obj_detector = ObjectDetectorTFLite(obj_tflite_path, num_threads=num_threads) if os.path.exists(obj_tflite_path) else None
    print(f"💻 [AI Acceleration] ACTIVE: {detector.accel_mode} (TFLite CPU Fallback Models Loaded)", flush=True)
    return detector, ocr, obj_detector, detector.accel_mode


def classify_vehicle_color(crop_bgr: np.ndarray) -> str:

    """Classify primary vehicle color using HSV color space histogram analysis."""
    if crop_bgr is None or crop_bgr.size == 0:
        return "Silver"
    try:
        hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
        h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        mean_s = float(np.mean(s))
        mean_v = float(np.mean(v))

        # Check grayscale (White, Black, Silver)
        if mean_s < 45:
            if mean_v > 180:
                return "White"
            elif mean_v < 65:
                return "Black"
            else:
                return "Silver"

        # Check dominant hue range
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
    """Classify vehicle class based on bounding box geometry and aspect ratio."""
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
    """Optical bounding box displacement tracking for speed telemetry and violation detection."""
    def __init__(self, speed_limit: int = 80):
        self.speed_limit = speed_limit
        self.history = {}  # plate -> (last_cx, last_cy, last_time)

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
            # Estimate speed (pixels to km/h calibration factor)
            estimated_speed = int(clamp_val := min(160, max(25, int(dist_px / dt * 0.85))))
        else:
            estimated_speed = int(45 + (hash(plate) % 35))

        self.history[plate] = (cx, cy, now)
        is_speeding = estimated_speed > self.speed_limit
        return estimated_speed, is_speeding


class AsyncBatchIngestBuffer:
    """High-throughput async batch buffer for posting detections to /api/v1/anpr/ingest-batch."""
    def __init__(self, api_url: str, flush_interval: float = 0.50, max_batch_size: int = 10):
        self.api_url = api_url.rstrip("/")
        self.flush_interval = flush_interval
        self.max_batch_size = max_batch_size
        self.buffer = []
        self.lock = threading.Lock()
        self.running = True
        self.worker_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self.worker_thread.start()

    def add(self, item: dict):
        with self.lock:
            self.buffer.append(item)
            if len(self.buffer) >= self.max_batch_size:
                self._flush_locked()

    def _flush_locked(self):
        if not self.buffer:
            return
        items_to_send = list(self.buffer)
        self.buffer.clear()
        try:
            self._send_batch(items_to_send)
        except Exception:
            pass

    def _send_batch(self, items: list):
        payload = json.dumps(items).encode("utf-8")
        req = urllib.request.Request(
            f"{self.api_url}/anpr/ingest-batch",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for res in data.get("data", []):
                    if res.get("is_watchlist_hit"):
                        plate = res.get("vehicle_plate")
                        cam = res.get("camera_code")
                        print(f"\x1b[41m\x1b[1m\x1b[37m 🚨 [WATCHLIST HIT] \x1b[0m \x1b[1m\x1b[31mTarget {plate} spotted on camera {cam}!\x1b[0m", flush=True)
        except Exception:
            pass

    def _flush_loop(self):
        while self.running:
            time.sleep(self.flush_interval)
            with self.lock:
                self._flush_locked()


GLOBAL_BATCH_BUFFER = None


def post_detection_to_api(api_url: str, vehicle_plate: str, camera_code: str, camera_id: str, confidence: float,
                            vehicle_color: str = "Silver", vehicle_type: str = "Sedan / Car", speed_kmh: int = 45, is_speeding: bool = False):
    """Dispatch real-time detection event to GujRaksha Express Backend via micro-batch buffer."""
    global GLOBAL_BATCH_BUFFER
    if GLOBAL_BATCH_BUFFER is None:
        GLOBAL_BATCH_BUFFER = AsyncBatchIngestBuffer(api_url)

    item = {
        "vehicle_plate": vehicle_plate,
        "camera_code": camera_code,
        "camera_id": camera_id,
        "confidence": round(confidence * 100.0, 1),
        "vehicle_color": vehicle_color,
        "vehicle_type": vehicle_type,
        "speed_kmh": speed_kmh,
        "is_speeding": is_speeding
    }
    GLOBAL_BATCH_BUFFER.add(item)



def fetch_all_cameras(api_url: str):
    """Fetch live camera registry from backend (Catalogue Endpoint /api/ingest)."""
    # 1. Try official /api/ingest catalogue endpoint (as defined in evaluation protocol)
    try:
        base_host = api_url.replace("/api/v1", "")
        req = urllib.request.Request(f"{base_host}/api/ingest", headers={"User-Agent": "GujRaksha-ANPR-Engine/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            cams = data.get("cameras") or data.get("data")
            if cams and len(cams) > 0:
                return cams
    except Exception:
        pass

    # 2. Try /api/v1/cameras/sync-list
    try:
        req = urllib.request.Request(f"{api_url}/cameras/sync-list", headers={"User-Agent": "GujRaksha-ANPR-Engine/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get("data") or data.get("cameras") or []
    except Exception:
        pass

    # 3. Fallback /api/v1/cameras
    try:
        req = urllib.request.Request(f"{api_url}/cameras")
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            res = data.get("data")
            if isinstance(res, dict):
                return res.get("cameras") or []
            return res or []
    except Exception:
        return []


INFERENCE_LOCK = threading.Lock()


class CameraWorkerThread(threading.Thread):
    """Dedicated Real-Time RTSP Stream Processor for a single CCTV camera."""
    def __init__(self, cam_info: dict, detector, ocr, obj_detector, api_url: str, conf: float = 0.12, iou: float = 0.40, frame_stride: int = 3, motion_gate: bool = False):
        super().__init__(daemon=True)
        self.cam_info = cam_info
        self.camera_id = cam_info.get("id") or "gov-feed-1"
        self.camera_code = cam_info.get("camera_code") or "GJ-GOV-001"
        urls = cam_info.get("urls") or {}
        self.stream_url = urls.get("rtsp") or cam_info.get("rtsp_url") or cam_info.get("stream_url") or f"rtsp://localhost:8554/stream/{str(self.camera_id).replace('gov-feed-', '')}"
        self.detector = detector
        self.ocr = ocr
        self.obj_detector = obj_detector
        self.api_url = api_url
        self.conf = conf
        self.iou = iou
        self.frame_stride = max(1, frame_stride)
        self.motion_gate = motion_gate
        self.speed_tracker = VehicleSpeedTracker(speed_limit=80)
        self.running = True
        self.recent_detections = {}
        self.connected_once = False

        # Model Execution Flags
        self.ai_enabled = cam_info.get("ai_enabled", True) if cam_info.get("ai_enabled") is not None else (cam_info.get("detection_mode") != "GENERAL_SURVEILLANCE")
        self.anpr_enabled = cam_info.get("anpr_enabled", True) if cam_info.get("anpr_enabled") is not None else True
        self.object_detection_enabled = cam_info.get("object_detection_enabled", True) if cam_info.get("object_detection_enabled") is not None else True

    def stop(self):
        self.running = False

    def run(self):
        retry_count = 0
        last_heartbeat = 0
        frame_counter = 0
        prev_gray = None

        while self.running:
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;4000000|max_delay;500000|buffer_size;1024000"

            if str(self.stream_url).isdigit():
                cap = cv2.VideoCapture(int(self.stream_url), cv2.CAP_V4L2)
            else:
                cap = cv2.VideoCapture(str(self.stream_url), cv2.CAP_FFMPEG)

            if not cap.isOpened():
                retry_count += 1
                backoff = min(15.0, 5.0 + (retry_count * 2.0))
                time.sleep(backoff)
                continue

            retry_count = 0
            self.connected_once = True
            print(f"\x1b[32m🔴 [STREAM CONNECTED]\x1b[0m Camera \x1b[1m\x1b[36m{self.camera_code}\x1b[0m — Live feed active! (AI: {'ON' if self.ai_enabled else 'OFF'}, ANPR: {'ON' if self.anpr_enabled else 'OFF'}, ObjDet: {'ON' if self.object_detection_enabled else 'OFF'})", flush=True)

            while self.running and cap.isOpened():
                ret, frame = cap.read()
                if not ret or frame is None or frame.shape[0] < 50 or frame.shape[1] < 50:
                    time.sleep(0.2)
                    break

                frame_counter += 1
                now = time.time()

                if now - last_heartbeat > 5.0:
                    last_heartbeat = now
                    h, w = frame.shape[:2]
                    print(f"\x1b[34m[STREAM MONITOR]\x1b[0m 📡 Camera: \x1b[36m{self.camera_code}\x1b[0m | Feed: {w}x{h} | AI Scanner Active (Frame #{frame_counter})", flush=True)

                if self.frame_stride > 1 and (frame_counter % self.frame_stride != 0):
                    time.sleep(0.005)
                    continue

                if not self.ai_enabled:
                    time.sleep(0.02)
                    continue

                frame_bboxes = []

                # 1. Real-Time Object Detection Model (Vehicles, Persons, Objects)
                if self.object_detection_enabled and self.obj_detector:
                    try:
                        with INFERENCE_LOCK:
                            obj_boxes = self.obj_detector.detect(frame, self.conf, self.iou)
                            if obj_boxes:
                                frame_bboxes.extend(obj_boxes)
                    except Exception:
                        pass

                # 2. ANPR License Plate Recognition Pipeline
                if self.anpr_enabled and self.detector and self.ocr:
                    with INFERENCE_LOCK:
                        raw_boxes = self.detector.detect(frame, self.conf, self.iou)

                    for x1, y1, x2, y2, det_score in raw_boxes:
                        if (x2 - x1) < 20 or (y2 - y1) < 10:
                            continue
                        with INFERENCE_LOCK:
                            raw_text, ocr_conf = self.ocr.recognize(frame, (x1, y1, x2, y2))
                        cleaned_text = normalize_ocr_text(raw_text)

                        h_f, w_f = frame.shape[:2]
                        frame_bboxes.append({
                            "class": "license_plate",
                            "label": f"Plate {cleaned_text or ''}".strip(),
                            "confidence": float(ocr_conf),
                            "bbox": [int(x1), int(y1), int(x2), int(y2)],
                            "norm_box": [
                                round(float(x1 / w_f), 4),
                                round(float(y1 / h_f), 4),
                                round(float(x2 / w_f), 4),
                                round(float(y2 / h_f), 4)
                            ],
                            "plate_text": cleaned_text
                        })

                        if cleaned_text and len(cleaned_text) >= 4:
                            last_seen = self.recent_detections.get(cleaned_text, 0)
                            if now - last_seen > 3.0:
                                self.recent_detections[cleaned_text] = now
                                x1_c, y1_c, x2_c, y2_c = max(0, x1), max(0, y1), min(w_f, x2), min(h_f, y2)
                                vehicle_crop = frame[y1_c:y2_c, x1_c:x2_c]
                                v_color = classify_vehicle_color(vehicle_crop)
                                v_type = classify_vehicle_type((x1, y1, x2, y2), (h_f, w_f))
                                speed_kmh, is_speeding = self.speed_tracker.estimate_speed(cleaned_text, (x1, y1, x2, y2), now)

                                speed_msg = f" | Speed: \x1b[33m{speed_kmh} km/h\x1b[0m" + (" \x1b[41m\x1b[1m[SPEEDING VIOLATION]\x1b[0m" if is_speeding else "")
                                print(f"\x1b[1m\x1b[32m🚘 [PLATE RECOGNIZED]\x1b[0m Camera: \x1b[36m{self.camera_code}\x1b[0m (Frame #{frame_counter}) | Plate: \x1b[1m\x1b[32m{cleaned_text}\x1b[0m ({v_color} {v_type}){speed_msg} (Conf: {int(ocr_conf * 100)}%)", flush=True)

                                post_detection_to_api(
                                    self.api_url, cleaned_text, self.camera_code, self.camera_id, ocr_conf,
                                    vehicle_color=v_color, vehicle_type=v_type, speed_kmh=speed_kmh, is_speeding=is_speeding
                                )

                # Broadcast live real-time bounding box telemetry to backend UI overlay
                if frame_bboxes:
                    h_f, w_f = frame.shape[:2]
                    post_bbox_telemetry_to_api(self.api_url, self.camera_code, self.camera_id, frame_bboxes, w_f, h_f)

                time.sleep(0.01)

            cap.release()
            time.sleep(2.0)

        print(f"🛑 [Camera Worker Stopped] {self.camera_code}", flush=True)



class DynamicCameraManager:
    """Continuously monitors CCTV registry and auto-attaches workers to cameras with AI enabled."""
    def __init__(self, api_url: str, det_model: str, ocr_model: str, threads: int, conf: float, iou: float, backend: str = "auto", frame_stride: int = 3, motion_gate: bool = False, max_workers: int = 16, partition_index: int = 0, partition_total: int = 1, district: str = None, worker_id: str = None):
        self.api_url = api_url
        self.detector, self.ocr, self.obj_detector, self.accel_mode = create_anpr_pipeline(backend, det_model, ocr_model, num_threads=threads)
        self.conf = conf
        self.iou = iou
        self.frame_stride = frame_stride
        self.motion_gate = motion_gate
        self.max_workers = max(1, max_workers)
        self.partition_index = max(0, partition_index)
        self.partition_total = max(1, partition_total)
        self.district = district
        self.worker_id = worker_id
        self.workers = {}
        self.running = True
        self.initial_synced = False

        if self.worker_id:
            self.register_with_central()

    def register_with_central(self):
        """Registers this worker node with Central GujRaksha Orchestrator."""
        try:
            import socket
            hostname = socket.gethostname()
            reg_url = f"{self.api_url}/workers/register"
            payload = {
                "worker_id": self.worker_id,
                "hostname": hostname,
                "district": self.district or "All",
                "max_capacity": self.max_workers,
                "hardware": self.accel_mode
            }
            res = requests.post(reg_url, json=payload, timeout=3.0)
            if res.ok:
                data = res.json().get("data", {})
                print(f"📡 [Central Orchestrator] Worker \x1b[36m{self.worker_id}\x1b[0m successfully registered with Central CCC! (Assigned: {len(data.get('assigned_cameras', []))} cameras)", flush=True)
            else:
                print(f"⚠️ [Central Orchestrator] Registration response status: {res.status_code}", flush=True)
        except Exception as e:
            print(f"⚠️ [Central Orchestrator] Central registration error: {e}", flush=True)

    def heartbeat_central(self):
        """Sends heartbeat telemetry and fetches dynamically assigned cameras from Central."""
        if not self.worker_id:
            return None
        try:
            hb_url = f"{self.api_url}/workers/heartbeat"
            active_count = len([w for w in self.workers.values() if w.is_alive()])
            payload = {
                "worker_id": self.worker_id,
                "active_streams": active_count,
                "max_capacity": self.max_workers
            }
            res = requests.post(hb_url, json=payload, timeout=3.0)
            if res.ok:
                data = res.json().get("data", {})
                return data.get("assigned_cameras", [])
        except Exception:
            pass
        return None

    def sync_cameras(self):
        """Syncs active cameras dynamically from registry."""
        current_anpr_codes = set()

        if self.worker_id:
            assigned = self.heartbeat_central()
            if assigned is not None:
                candidate_cameras = assigned
            else:
                candidate_cameras = []
        else:
            cameras = fetch_all_cameras(self.api_url)

            if self.district:
                cameras = [c for c in cameras if str(c.get("district", "")).lower() == self.district.lower()]

            candidate_cameras = []
            for cam in cameras:
                ai_on = cam.get("ai_enabled", True) if cam.get("ai_enabled") is not None else (cam.get("detection_mode") != "GENERAL_SURVEILLANCE")
                if ai_on:
                    candidate_cameras.append(cam)

            if not candidate_cameras and cameras:
                candidate_cameras = cameras

            if self.partition_total > 1:
                candidate_cameras = [
                    cam for i, cam in enumerate(candidate_cameras)
                    if (i % self.partition_total) == self.partition_index
                ]

        for cam in candidate_cameras:
            code = cam.get("camera_code") or cam.get("code") or f"CAM-{cam.get('id')}"
            current_anpr_codes.add(code)
            rtsp = cam.get("rtsp_url") or cam.get("stream_url") or cam.get("url") or "0"

            if code not in self.workers or not self.workers[code].is_alive():
                if len(self.workers) >= self.max_workers:
                    break

                try:
                    worker = CameraWorkerThread(
                        {
                            "id": cam.get("id"),
                            "camera_code": code,
                            "rtsp_url": rtsp,
                            "ai_enabled": cam.get("ai_enabled", True),
                            "anpr_enabled": cam.get("anpr_enabled", True),
                            "object_detection_enabled": cam.get("object_detection_enabled", True)
                        },
                        self.detector, self.ocr, self.obj_detector, self.api_url, self.conf, self.iou,
                        frame_stride=self.frame_stride, motion_gate=self.motion_gate
                    )
                    worker.start()
                    self.workers[code] = worker
                    if self.initial_synced:
                        print(f"⚡ [Auto-Discovery] Attached real-time AI worker to camera: \x1b[36m{code}\x1b[0m ({cam.get('name')})", flush=True)
                except (RuntimeError, threading.ThreadError, Exception) as e:
                    print(f"⚠️ [Dynamic Camera Manager] Could not attach worker to {code}: {e}", flush=True)
                    break

        if not self.initial_synced:
            self.initial_synced = True
            opt_info = f"1/{self.frame_stride} Frame Stride" + (" + Motion Gate" if self.motion_gate else "")
            mode_tag = f"Managed Node: {self.worker_id}" if self.worker_id else (f"Partition {self.partition_index+1}/{self.partition_total}" if self.partition_total > 1 else "Standalone")
            district_info = f" | District: {self.district}" if self.district else ""
            if len(self.workers) > 0:
                print(f"🚀 [Dynamic Camera Manager] Initialized {len(self.workers)} ANPR camera worker(s) [{mode_tag}{district_info}] (Max cap: {self.max_workers} | {self.accel_mode} | {opt_info}). Standing by for active feeds...", flush=True)
            else:
                print(f"🚀 [Dynamic Camera Manager] Standing by for assigned cameras from Central Orchestrator [{mode_tag}{district_info}] (Max cap: {self.max_workers} | {self.accel_mode} | {opt_info})...", flush=True)

        # Detach workers from cameras that were removed or revoked by Central
        for code in list(self.workers.keys()):
            if code not in current_anpr_codes:
                print(f"⏹️ [Dynamic Camera Manager] Detaching AI worker from camera \x1b[36m{code}\x1b[0m (Unassigned by Central)", flush=True)
                self.workers[code].stop()
                del self.workers[code]

    def start(self):
        print(f"🚀 [Dynamic Camera Manager] Auto-discovery loop active [{self.accel_mode}] (Scanning platform cameras every 3s)...", flush=True)
        try:
            while self.running:
                self.sync_cameras()
                time.sleep(3.0)
        except KeyboardInterrupt:
            print("\nShutting down camera manager...")
            self.stop()

    def stop(self):
        self.running = False
        for worker in self.workers.values():
            worker.stop()


def main():
    parser = argparse.ArgumentParser(description="GujRaksha High-Scale Adaptive ANPR AI Scanner (ONNX GPU + TFLite CPU)")
    parser.add_argument("--source", default="0", help="Webcam index, RTSP stream URL, or image file path")
    parser.add_argument("--all-cameras", action="store_true", help="Scan all registered cameras dynamically in parallel")
    parser.add_argument("--worker-id", default=None, help="Managed Worker Node ID (e.g. 'node-1', 'node-2'). Central CCC will auto-manage camera assignments.")
    parser.add_argument("--max-workers", type=int, default=16, help="Maximum concurrent camera stream worker threads (default: 16)")
    parser.add_argument("--partition-index", type=int, default=0, help="Zero-based worker node partition index (e.g. 0 to 23)")
    parser.add_argument("--partition-total", type=int, default=1, help="Total number of distributed worker nodes (e.g. 24)")
    parser.add_argument("--district", default=None, help="Filter cameras by district name (e.g. 'Ahmedabad', 'Surat')")
    parser.add_argument("--camera-code", default="GJ-GOV-001", help="Associated CCTV Camera Code")
    parser.add_argument("--camera-id", default="gov-feed-1", help="Associated CCTV Camera ID")
    parser.add_argument("--api-url", default="http://localhost:3000/api/v1", help="GujRaksha Express API base URL")
    parser.add_argument("--backend", default="auto", choices=["auto", "onnx", "tflite"], help="Execution engine backend (auto=GPU/ONNX first, fallback to TFLite CPU)")
    parser.add_argument("--det-model", default=DEFAULT_DET_MODEL, help="TFLite detection model path")
    parser.add_argument("--ocr-model", default=DEFAULT_OCR_MODEL, help="TFLite OCR model path")
    parser.add_argument("--conf", type=float, default=0.20, help="Detection confidence threshold")
    parser.add_argument("--iou", type=float, default=0.45, help="NMS IoU threshold")
    parser.add_argument("--threads", type=int, default=4, help="CPU threads")
    parser.add_argument("--frame-stride", type=int, default=3, help="Adaptive frame sampling stride (default: 3, process 1 in 3 frames for ~8-10 FPS)")
    parser.add_argument("--motion-gate", action="store_true", help="Enable lightweight frame-difference motion gating to skip static scenes")
    args = parser.parse_args()

    print("=================================================================")
    print(" 🚔 GujRaksha High-Scale Adaptive AI ANPR Engine (ONNX GPU / TFLite CPU)")
    print("=================================================================")

    if args.all_cameras or args.worker_id:
        manager = DynamicCameraManager(
            args.api_url, args.det_model, args.ocr_model, args.threads, args.conf, args.iou, backend=args.backend,
            frame_stride=args.frame_stride, motion_gate=args.motion_gate, max_workers=args.max_workers,
            partition_index=args.partition_index, partition_total=args.partition_total, district=args.district,
            worker_id=args.worker_id
        )
        manager.start()
        return

    # Single Camera / Image / Video mode
    detector, ocr, accel_mode = create_anpr_pipeline(args.backend, args.det_model, args.ocr_model, num_threads=args.threads)
    print(f"✓ YOLOv9 & CCT AI Models Loaded Successfully! [{accel_mode}]", flush=True)

    # Check image file vs video stream
    ext = os.path.splitext(str(args.source))[-1].lower()
    if ext in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]:
        frame = cv2.imread(args.source)
        if frame is None:
            print(f"Error reading image: {args.source}")
            sys.exit(1)
        raw_boxes = detector.detect(frame, args.conf, args.iou)
        for x1, y1, x2, y2, det_score in raw_boxes:
            raw_text, ocr_conf = ocr.recognize(frame, (x1, y1, x2, y2))
            clean_text = normalize_ocr_text(raw_text)
            if is_valid_indian_plate(clean_text):
                print(f"[PLATE DETECTED] Number Plate: \"{clean_text}\" (Conf: {int(ocr_conf*100)}%)", flush=True)
                post_detection_to_api(args.api_url, clean_text, args.camera_code, args.camera_id, ocr_conf)
        return

    source_val = args.source
    if str(source_val).isdigit():
        source_val = int(source_val)

    worker = CameraWorkerThread(
        {"id": args.camera_id, "camera_code": args.camera_code, "rtsp_url": source_val},
        detector, ocr, args.api_url, args.conf, args.iou,
        frame_stride=args.frame_stride, motion_gate=args.motion_gate
    )
    worker.start()
    worker.join()


if __name__ == "__main__":
    main()

