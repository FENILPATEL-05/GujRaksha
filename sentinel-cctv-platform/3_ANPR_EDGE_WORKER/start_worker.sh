#!/usr/bin/env bash
# ==============================================================================
# GujRaksha AI Edge Worker Runner
#
# Mode 1: Central Cluster Managed Mode (Default - Receives up to 100 cameras & Watchlist from Central):
#   ./start_worker.sh [CENTRAL_API_URL] [WORKER_ID] [MAX_CAMERAS]
#   Example: ./start_worker.sh http://192.168.1.100:3000/api/v1 node-1 100
#
# Mode 2: Direct Single Stream / Webcam Mode:
#   ./start_worker.sh --source rtsp://192.168.1.50:8554/stream/1 http://192.168.1.100:3000/api/v1 GJ-GOV-001
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$SCRIPT_DIR/venv/bin/python"

if [ -f "$VENV_PYTHON" ]; then
  PY_BIN="$VENV_PYTHON"
elif command -v python3 &>/dev/null; then
  PY_BIN="python3"
else
  echo "❌ Error: Python 3 not found. Please install Python 3.10+."
  exit 1
fi

if [ "$1" == "--source" ]; then
  # Direct single source mode
  SOURCE="$2"
  CENTRAL_URL="${3:-http://localhost:3000/api/v1}"
  CAM_CODE="${4:-GJ-GOV-001}"
  echo "======================================================================"
  echo " 🚔 STARTING GUJRAKSHA AI WORKER (SINGLE STREAM MODE)"
  echo "======================================================================"
  echo " 📡 Source       : $SOURCE"
  echo " 🏢 Central API  : $CENTRAL_URL"
  echo " 🎥 Camera Code  : $CAM_CODE"
  echo "======================================================================"
  exec "$PY_BIN" "$SCRIPT_DIR/anpr_worker.py" --source "$SOURCE" --central-url "$CENTRAL_URL" --camera-code "$CAM_CODE"
else
  # Central Cluster Managed Mode (Dynamic 100-Camera Dispatch & Watchlist Sync)
  CENTRAL_URL="${1:-http://localhost:3000/api/v1}"
  WORKER_ID="${2:-node-1}"
  MAX_CAPACITY="${3:-100}"

  echo "======================================================================"
  echo " 🚔 STARTING GUJRAKSHA DISTRIBUTED AI CLUSTER NODE"
  echo "======================================================================"
  echo " 🏢 Central Server  : $CENTRAL_URL"
  echo " 🆔 Worker Node ID  : $WORKER_ID"
  echo " 🚀 Max Capacity    : $MAX_CAPACITY Cameras"
  echo " 🐍 Python Runtime  : $PY_BIN"
  echo "======================================================================"
  echo "Connecting to Central CCC... Node will appear in Central UI in STANDBY."
  echo "Central Admin can assign up to $MAX_CAPACITY cameras dynamically from web UI."
  echo "======================================================================"
  exec "$PY_BIN" "$SCRIPT_DIR/anpr_worker.py" --central-url "$CENTRAL_URL" --worker-id "$WORKER_ID" --max-capacity "$MAX_CAPACITY"
fi
