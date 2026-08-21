#!/usr/bin/env python3
"""
=============================================================================
 GujRaksha (ગુજ રક્ષા) — THE ORION Live CCTV ANPR Suspect Detector
 Gujarat Police Innovation Hackathon 2026
=============================================================================

This script specifically targets "THE ORION" CCTV node:
1. Dynamically syncs camera metadata for "THE ORION" from GujRaksha Registry API.
2. Dynamically syncs active Police Watchlist suspect plates from Watchlist API.
3. Connects to the live stream: http://192.168.1.96:5000/
4. Scans passing vehicles at edge with OCR.
5. If Plate matches any Police Watchlist suspect:
   -> Dispatches instant alert (POST /api/v1/anpr/ingest) for THE ORION camera!
   -> Flash alert on GIS Map & AI Threat Radar!
6. Normal public cars are skipped/ignored locally (0 network load).
"""

import os
import sys
import warnings

# Suppress PyTorch CPU pin_memory and non-critical UserWarnings
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

try:
    import cv2
except ImportError:
    cv2 = None

import requests
import time
import re
from datetime import datetime

# =============================================================================
# ⚙️ CONFIGURATION SETTINGS & INDIAN LICENSE PLATE PATTERNS
# =============================================================================
API_BASE = "http://localhost:3000/api/v1"
CAMERAS_API_URL = f"{API_BASE}/cameras/sync-list"
WATCHLIST_SYNC_URL = f"{API_BASE}/watchlist/sync-hotlist"
ANPR_INGEST_URL = f"{API_BASE}/anpr/ingest"

# Target Camera Name Keyword (Filtered dynamically from API)
TARGET_CAMERA_KEYWORD = "ORION"

# Fallback defaults if server is starting up
FALLBACK_CAMERA = {
    "id": "gov-feed-1787137548382",
    "camera_code": "GJ-GOV-382",
    "name": "THE ORION",
    "district": "AHMEDABAD",
    "stream_url": "http://192.168.1.96:5000/"
}

# Valid Indian State Codes
INDIAN_STATE_CODES = {
    "GJ", "MH", "DL", "RJ", "MP", "KA", "UP", "HR", "TN", "KL",
    "AP", "TS", "WB", "PB", "CH", "GA", "OD", "BR", "JH", "UK",
    "HP", "AS", "JK", "LA", "DN", "DD", "PY", "BH"
}

# OSD & Timestamp Noise Words to Ignore
OSD_NOISE_WORDS = [
    "IPCAMERA", "CAMERA", "CCTV", "CAM", "LIVE", "REC", "PLAYBACK",
    "HIKVISION", "DAHUA", "CPPLUS", "CHANNEL", "RESOLUTION", "CH01",
    "CH02", "CH03", "CH04", "STREAM", "FPS", "AM", "PM"
]

# Standard Indian Plate Regex
INDIAN_PLATE_REGEX = re.compile(
    r"^(?:([A-Z]{2})[0-9]{1,2}[A-Z]{0,3}[0-9]{3,4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$"
)

# =============================================================================
# 🚨 POLICE ANPR ENGINE (THE ORION NODE)
# =============================================================================
class OrionANPREngine:
    def __init__(self):
        self.camera = None
        self.hotlist_plates = set()
        self.hotlist_details = {}
        self.last_sync_time = 0
        self.recent_alerts = {}  # { plate: last_alert_timestamp }

        # Initialize EasyOCR if installed
        self.ocr_reader = None
        try:
            import easyocr
            print("🧠 Loading EasyOCR Model for License Plates...")
            self.ocr_reader = easyocr.Reader(["en"], gpu=False)
            print("✅ EasyOCR Neural Model Ready!")
        except ImportError:
            print("ℹ️ Note: 'easyocr' not installed. Run `pip install easyocr` for neural OCR.")

    def fetch_orion_camera(self):
        """Fetches and binds THE ORION camera directly from GujRaksha API"""
        try:
            print(f"📡 Fetching camera metadata from API: {CAMERAS_API_URL}")
            res = requests.get(CAMERAS_API_URL, timeout=4)
            data = res.json()
            if data.get("success"):
                all_cameras = data.get("data", [])
                
                # Find THE ORION specifically
                orion_cam = None
                for c in all_cameras:
                    c_name = (c.get("name") or "").upper()
                    if TARGET_CAMERA_KEYWORD in c_name:
                        orion_cam = c
                        break

                if orion_cam:
                    self.camera = orion_cam
                    print(f"🎯 [AUTO-SELECTED] Target Camera: {self.camera.get('name')} ({self.camera.get('camera_code') or self.camera.get('id')})")
                    print(f"   District:   {self.camera.get('district')}")
                    print(f"   Stream URL: {self.camera.get('stream_url')}")
                    return self.camera
                else:
                    print("⚠️ 'THE ORION' camera not found in API list. Using fallback.")
            else:
                print("⚠️ API response failed. Using fallback.")
        except Exception as e:
            print(f"⚠️ [CAMERA API ERROR]: {e}. Using fallback configuration.")

        self.camera = FALLBACK_CAMERA
        return self.camera

    def sync_watchlist(self):
        """Fetches active police watchlist targets from GujRaksha API"""
        try:
            res = requests.get(WATCHLIST_SYNC_URL, timeout=3)
            data = res.json()
            if data.get("success"):
                plates_list = data.get("plates", [])
                self.hotlist_plates = set(p.upper().replace("-", "").replace(" ", "") for p in plates_list)
                self.hotlist_details = data.get("hotlist", {})
                self.last_sync_time = time.time()
                print(f"🔄 [WATCHLIST SYNC] {len(self.hotlist_plates)} Active Police Targets Synced from Dashboard.")
                if len(self.hotlist_plates) > 0:
                    print(f"   🎯 Active Suspect Targets: {list(plates_list)}")
                else:
                    print("   ℹ️ 0 targets in Watchlist. Add targets via dashboard at /#watchlist")
        except Exception as e:
            print(f"⚠️ [WATCHLIST SYNC ERROR]: {e}")

    def extract_valid_indian_plate(self, raw_text):
        """Filters out camera timestamps & OSD text, returns clean Indian license plate"""
        if not raw_text:
            return None

        cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_text).upper()

        if cleaned.startswith("IND") and len(cleaned) >= 8:
            cleaned = cleaned[3:]

        # Ignore pure numbers (timestamps like 2108202604839)
        if cleaned.isdigit():
            return None

        # Ignore pure words (like IPCAMERAL)
        if cleaned.isalpha():
            return None

        # Ignore OSD keywords
        for noise in OSD_NOISE_WORDS:
            if noise in cleaned:
                return None

        if len(cleaned) < 6 or len(cleaned) > 12:
            return None

        # Direct State code / BH Match
        state_code = cleaned[:2]
        if state_code in INDIAN_STATE_CODES or (cleaned[:2].isdigit() and cleaned[2:4] == "BH"):
            if INDIAN_PLATE_REGEX.match(cleaned):
                return cleaned

        # Substring search for valid plate
        sub_match = re.search(r"([A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{3,4})", cleaned)
        if sub_match:
            candidate = sub_match.group(1)
            if candidate[:2] in INDIAN_STATE_CODES:
                return candidate

        return None

    def is_suspect_match(self, cleaned_plate):
        """Checks locally in edge memory if plate matches any police target"""
        if not cleaned_plate or len(cleaned_plate) < 4:
            return False

        for target in self.hotlist_plates:
            if target in cleaned_plate or cleaned_plate in target:
                return True
        return False

    def send_suspect_alert(self, plate_number):
        """Dispatches suspect detection payload to GujRaksha Command Room for THE ORION"""
        now = time.time()
        # Cooldown: 10s per plate to avoid duplicate spam
        if plate_number in self.recent_alerts and (now - self.recent_alerts[plate_number]) < 10:
            return None

        self.recent_alerts[plate_number] = now

        if not self.camera:
            print("❌ Camera not initialized.")
            return None

        # Clean, pure payload: Only the actual Camera ID and Detected Plate Number
        payload = {
            "camera_id": self.camera["id"],
            "vehicle_plate": plate_number,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        try:
            print(f"\n🚨 [SUSPECT SPOTTED ON {self.camera.get('name')}] Target '{plate_number}' detected!")
            res = requests.post(ANPR_INGEST_URL, json=payload, timeout=3)
            data = res.json()
            if data.get("isWatchlistHit") or data.get("success"):
                print(f"✅ [COMMAND ROOM NOTIFIED] Alert successfully flashed on Police GIS Map & Radar!")
            return data
        except Exception as e:
            print(f"❌ [ALERT ERROR] {e}")
            return None

# =============================================================================
# 🚀 MAIN VIDEO CAPTURE & INGESTION LOOP
# =============================================================================
def main():
    print("================================================================")
    print(" 🚔 GujRaksha Live ANPR Suspect Detector — THE ORION NODE")
    print("================================================================")

    engine = OrionANPREngine()
    
    # 1. Fetch & Bind THE ORION from API
    camera_meta = engine.fetch_orion_camera()

    # 2. Sync Watchlist from Backend API
    engine.sync_watchlist()

    if cv2 is None:
        print("\n❌ OpenCV (cv2) is required for live stream video capture.")
        print("   Run: pip install opencv-python requests easyocr")
        return

    # Stream URL for THE ORION
    stream_url = camera_meta.get("stream_url") or "http://192.168.1.96:5000/"
    print(f"\n🎥 Connecting to Live Camera Stream in Background: {stream_url}")

    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        print(f"❌ Could not open stream at: {stream_url}")
        print("💡 Ensure your IP Camera / Flask stream is running at http://192.168.1.96:5000/")
        return

    print("✅ Background Stream Worker Active! Processing frames headless...")
    print("ℹ️ Scanning passing plates in background. Press Ctrl+C in terminal to stop.")

    frame_count = 0
    consecutive_failures = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                consecutive_failures += 1
                if consecutive_failures % 20 == 0:
                    print(f"⚠️ [STREAM RETRY] Waiting for video frames from {stream_url}...")
                time.sleep(0.5)
                continue

            consecutive_failures = 0
            frame_count += 1

            # Re-sync Watchlist every 30 seconds
            if time.time() - engine.last_sync_time > 30:
                engine.sync_watchlist()

            # Run OCR scan every 4th frame (Background processing)
            if frame_count % 4 == 0 and engine.ocr_reader is not None:
                # Optional resize to speed up inference in background
                h, w = frame.shape[:2]
                if w > 1280:
                    frame = cv2.resize(frame, (1280, int(h * 1280 / w)))

                results = engine.ocr_reader.readtext(frame)
                for (bbox, text, prob) in results:
                    plate = re.sub(r"[^A-Za-z0-9]", "", text or "").upper()
                    if len(plate) >= 3 and prob > 0.25:
                        now = time.time()
                        # Check if plate matches active police watchlist
                        if engine.is_suspect_match(plate):
                            print(f"\n🚨 [🚨 WATCHLIST MATCH DETECTED] Target Plate: '{plate}' (Confidence: {prob * 100:.1f}%) -> DISPATCHING ALERT TO GUJRAKSHA!")
                            # 🚨 Instantly dispatch alert payload to GujRaksha backend
                            engine.send_suspect_alert(plate)
                        else:
                            # Regular / Other vehicle plate -> Print to console with debounce
                            last_seen = engine.recent_alerts.get(plate, 0)
                            if now - last_seen > 2.5:
                                engine.recent_alerts[plate] = now
                                print(f"🔍 [SCANNED TEXT/PLATE] '{plate}' (Confidence: {prob * 100:.1f}%)")

            # Small sleep to prevent 100% CPU thread starvation
            time.sleep(0.01)

    except KeyboardInterrupt:
        print("\n🛑 Stopped background ANPR worker.")
    finally:
        cap.release()
        print("✅ Stream worker released cleanly.")

if __name__ == "__main__":
    main()
