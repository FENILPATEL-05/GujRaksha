#!/usr/bin/env bash
# ==============================================================================
# Setup Python Virtual Environment & Install Dependencies for ANPR AI Worker
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

echo "======================================================================"
echo " 🐍 SETTING UP PYTHON AI ENVIRONMENT (ANPR WORKER NODE)"
echo "======================================================================"

if [ ! -d "$VENV_DIR" ]; then
  echo "📦 Creating Python virtual environment in $VENV_DIR..."
  python3 -m venv "$VENV_DIR" || python3 -m virtualenv "$VENV_DIR"
fi

echo "⚙️  Installing AI packages (OpenCV, LiteRT, NumPy, Requests)..."
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$SCRIPT_DIR/requirements.txt"

echo "======================================================================"
echo " ✅ Environment ready! You can now run ./start_worker.sh"
echo "======================================================================"
