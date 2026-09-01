#!/usr/bin/env bash
# ==============================================================================
# GujRaksha — NVIDIA Triton Inference Server 1-Click Startup Script
# Starts Triton container with GPU acceleration, Dynamic Batching & TensorRT
# ==============================================================================

set -e

echo "🚀 Checking GPU Availability..."
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
    echo "⚠️ WARNING: nvidia-smi not found. Ensure NVIDIA CUDA drivers are installed."
fi

mkdir -p triton_repository/yolo_detector/1

if [ ! -f "triton_repository/yolo_detector/1/model.onnx" ]; then
    echo "💡 Model file not found at triton_repository/yolo_detector/1/model.onnx"
    echo "Copying sample/dummy ONNX or default model if present..."
    if [ -f "3_ANPR_EDGE_WORKER/models/yolov9_anpr.onnx" ]; then
        cp 3_ANPR_EDGE_WORKER/models/yolov9_anpr.onnx triton_repository/yolo_detector/1/model.onnx
        echo "✅ Copied yolov9_anpr.onnx to triton_repository/yolo_detector/1/model.onnx"
    else
        echo "ℹ️ Please place your trained ONNX model in 'triton_repository/yolo_detector/1/model.onnx'."
    fi
fi

echo "⚡ Starting NVIDIA Triton Server Container..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.triton.yml up -d
elif docker compose version &> /dev/null; then
    docker compose -f docker-compose.triton.yml up -d
else
    echo "⚙️ Running standard docker run..."
    docker run -d --gpus all \
        --name gujraksha_triton_server \
        -p 8000:8000 -p 8001:8001 -p 8002:8002 \
        -v "$(pwd)/triton_repository:/models" \
        nvcr.io/nvidia/tritonserver:24.01-py3 \
        tritonserver --model-repository=/models --strict-model-config=false
fi

echo ""
echo "================================================================================"
echo "✅ NVIDIA Triton Server launched successfully!"
echo "   • HTTP API Port:       http://localhost:8000/v2/health/ready"
echo "   • gRPC API Port:       localhost:8001 (For Python AI Workers)"
echo "   • Prometheus Metrics:  http://localhost:8002/metrics"
echo "================================================================================"
