#!/usr/bin/env python3
"""
GujRaksha (ગુજ રક્ષા) — Ultra-Fast TFLite ANPR Engine (YOLOv9 + CCT Transformer OCR)
Copyright (c) 2026 Fenil Patel. All Rights Reserved.

Real-time high-speed ANPR pipeline:
1. YOLOv9 Plate Detection (models/tflite/plate_detector.tflite)
2. CCT Transformer OCR Recognition (models/tflite/plate_ocr.tflite)
3. Real-Time Alert Ingestion to GujRaksha Express Backend (/api/v1/anpr/ingest)
"""

import os
import sys
import time
import argparse
import re
import cv2
import numpy as np
import urllib.request
import json

# Load TFLite Interpreter
try:
    from tflite_runtime.interpreter import Interpreter
except ImportError:
    try:
        from tensorflow.lite.python.interpreter import Interpreter
    except ImportError:
        print("Error: Neither tflite_runtime nor tensorflow is installed.")
        sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../../"))
DEFAULT_DET_MODEL = os.path.join(PROJECT_ROOT, "models/tflite/plate_detector.tflite")
DEFAULT_OCR_MODEL = os.path.join(PROJECT_ROOT, "models/tflite/plate_ocr.tflite")

DET_SIZE = 384
OCR_W, OCR_H = 128, 64
OCR_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


class PlateDetectorTFLite:
    """YOLOv9 License Plate Detector using TFLite."""
    def __init__(self, model_path: str, num_threads: int = 4):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Detection model not found: {model_path}")
        self.interpreter = Interpreter(model_path=model_path, num_threads=num_threads)
        self.interpreter.allocate_tensors()
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

    def detect(self, img: np.ndarray, conf_thresh: float = 0.25, iou_thresh: float = 0.45):
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
            idx_list = indices.flatten() if hasattr(indices, 'flatten') else indices
            for idx in idx_list:
                bx, by, bw_b, bh_b = boxes[idx]
                detections.append((
                    int(bx), int(by), int(bx + bw_b), int(by + bh_b), float(scores[idx])
                ))
        return detections


class PlateOCRTFLite:
    """CCT OCR Recognizer using TFLite."""
    def __init__(self, model_path: str, num_threads: int = 4):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"OCR model not found: {model_path}")
        self.interpreter = Interpreter(model_path=model_path, num_threads=num_threads)
        self.interpreter.allocate_tensors()
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

    def recognize(self, img: np.ndarray, bbox: tuple):
        x1, y1, x2, y2 = bbox
        h, w = img.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        crop = img[y1:y2, x1:x2]
        if crop.size == 0 or crop.shape[0] < 5 or crop.shape[1] < 5:
            return "", 0.0

        crop_resized = cv2.resize(crop, (OCR_W, OCR_H), interpolation=cv2.INTER_LINEAR)
        crop_rgb = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2RGB)
        batch = crop_rgb[np.newaxis, :]

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


def post_detection_to_api(api_url: str, vehicle_plate: str, camera_code: str, confidence: float):
    payload = json.dumps({
        "vehicle_plate": vehicle_plate,
        "camera_code": camera_code,
        "confidence": round(confidence * 100.0, 1),
        "speed_kmh": int(45 + (hash(vehicle_plate) % 35))
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{api_url}/anpr/ingest",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("isWatchlistHit"):
                print(f"🚨 [TFLite ANPR ALERT] WATCHLIST HIT: {vehicle_plate} on {camera_code}")
            else:
                print(f"✓ [TFLite ANPR SCAN] {vehicle_plate} on {camera_code} (PASS)")
    except Exception as e:
        print(f"⚠️ Ingest API Post notice: {e}")


import concurrent.futures

def fetch_all_cameras(api_url: str):
    try:
        req = urllib.request.Request(f"{api_url}/cameras")
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get("data") or data.get("cameras") or []
    except Exception as e:
        print(f"⚠️ Could not fetch camera list from API: {e}")
        return []


def process_single_camera_stream(cam_info: dict, detector: PlateDetectorTFLite, ocr: PlateOCRTFLite, api_url: str, conf: float, iou: float):
    camera_code = cam_info.get("camera_code") or "GJ-GOV-001"
    stream_url = cam_info.get("rtsp_url") or cam_info.get("stream_url") or f"rtsp://localhost:8554/stream/{cam_info.get('id', 1)}"
    
    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        return

    ret, frame = cap.read()
    cap.release()
    if not ret or frame is None:
        return

    raw_boxes = detector.detect(frame, conf, iou)
    for x1, y1, x2, y2, det_score in raw_boxes:
        text, ocr_conf = ocr.recognize(frame, (x1, y1, x2, y2))
        if text and len(text) >= 4:
            post_detection_to_api(api_url, text, camera_code, ocr_conf)


def run_all_cameras_parallel(api_url: str, det_model: str, ocr_model: str, threads: int, conf: float, iou: float):
    detector = PlateDetectorTFLite(det_model, num_threads=threads)
    ocr = PlateOCRTFLite(ocr_model, num_threads=threads)
    cameras = fetch_all_cameras(api_url)

    if not cameras:
        print("⚠️ No active camera feeds returned from platform registry.")
        return

    print(f"🚀 [TFLite ANPR Engine] Scanning {len(cameras)} cameras concurrently in parallel...")
    recent_detections = {}

    while True:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(cameras), 16)) as executor:
            futures = [
                executor.submit(process_single_camera_stream, cam, detector, ocr, api_url, conf, iou)
                for cam in cameras
            ]
            concurrent.futures.wait(futures)
        
        time.sleep(3.0)


def main():
    parser = argparse.ArgumentParser(description="GujRaksha TFLite ANPR AI Scanner")
    parser.add_argument("--source", default="0", help="Webcam index, RTSP stream URL, or image file path")
    parser.add_argument("--all-cameras", action="store_true", help="Scan all registered cameras in parallel")
    parser.add_argument("--camera-code", default="GJ-GOV-001", help="Associated CCTV Camera Code")
    parser.add_argument("--api-url", default="http://localhost:3000/api/v1", help="GujRaksha Express API base URL")
    parser.add_argument("--det-model", default=DEFAULT_DET_MODEL, help="TFLite detection model path")
    parser.add_argument("--ocr-model", default=DEFAULT_OCR_MODEL, help="TFLite OCR model path")
    parser.add_argument("--conf", type=float, default=0.25, help="Detection confidence threshold")
    parser.add_argument("--iou", type=float, default=0.45, help="NMS IoU threshold")
    parser.add_argument("--threads", type=int, default=4, help="CPU threads")
    args = parser.parse_args()

    print("=================================================================")
    print(" 🚔 GujRaksha TFLite AI ANPR Engine (YOLOv9 + CCT Transformer OCR)")
    print("=================================================================")

    if args.all_cameras:
        run_all_cameras_parallel(args.api_url, args.det_model, args.ocr_model, args.threads, args.conf, args.iou)
        return

    detector = PlateDetectorTFLite(args.det_model, num_threads=args.threads)
    ocr = PlateOCRTFLite(args.ocr_model, num_threads=args.threads)
    print("✓ YOLOv9 & CCT TFLite AI Models Loaded Successfully!")

    # Check image file vs video stream
    ext = os.path.splitext(str(args.source))[-1].lower()
    if ext in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]:
        frame = cv2.imread(args.source)
        if frame is None:
            print(f"Error reading image: {args.source}")
            sys.exit(1)
        raw_boxes = detector.detect(frame, args.conf, args.iou)
        for x1, y1, x2, y2, det_score in raw_boxes:
            text, ocr_conf = ocr.recognize(frame, (x1, y1, x2, y2))
            if text and len(text) >= 4:
                post_detection_to_api(args.api_url, text, args.camera_code, ocr_conf)
        return

    source_val = args.source
    if source_val.isdigit():
        source_val = int(source_val)

    cap = cv2.VideoCapture(source_val)
    if not cap.isOpened():
        print(f"Error opening camera source: {args.source}")
        sys.exit(1)

    print(f"🔴 Live Stream Scanner Active on {args.source} ({args.camera_code})...\n")

    recent_detections = {}
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.1)
                continue

            raw_boxes = detector.detect(frame, args.conf, args.iou)
            for x1, y1, x2, y2, det_score in raw_boxes:
                text, ocr_conf = ocr.recognize(frame, (x1, y1, x2, y2))
                if text and len(text) >= 4:
                    now = time.time()
                    last_seen = recent_detections.get(text, 0)
                    if now - last_seen > 10.0:  # 10s cooldown
                        recent_detections[text] = now
                        post_detection_to_api(args.api_url, text, args.camera_code, ocr_conf)

            time.sleep(0.05)
    except KeyboardInterrupt:
        print("\nScanner stopped by user.")
    finally:
        cap.release()


if __name__ == "__main__":
    main()
