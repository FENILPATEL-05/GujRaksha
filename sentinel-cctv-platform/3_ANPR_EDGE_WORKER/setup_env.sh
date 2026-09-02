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

if command -v nvidia-smi &>/dev/null; then
  IS_GPU_OK=$("$VENV_DIR/bin/python" -c "import onnxruntime as ort; print('CUDAExecutionProvider' in ort.get_available_providers())" 2>/dev/null || echo "False")
  if [ "$IS_GPU_OK" == "True" ]; then
    echo "✅ GPU Acceleration already active (CUDAExecutionProvider verified)."
  else
    echo "⚡ NVIDIA GPU Detected! Installing GPU-accelerated ONNX Runtime..."
    "$VENV_DIR/bin/pip" uninstall -y onnxruntime 2>/dev/null || true
    "$VENV_DIR/bin/pip" install onnxruntime-gpu
    echo "✅ GPU acceleration packages successfully installed."
  fi
fi

echo "======================================================================"
echo " ✅ Environment ready! You can now run ./start_worker.sh"
echo "======================================================================"
