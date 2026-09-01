# NVIDIA Triton Model Repository Structure

This directory serves as the **Model Repository** for NVIDIA Triton Inference Server.

## Directory Layout:

```
triton_repository/
└── yolo_detector/
    ├── config.pbtxt      <-- Triton model configuration (Dynamic Batching + TensorRT FP16)
    └── 1/
        └── model.onnx    <-- Place your exported ONNX model here
```

## Quick Setup Instructions:

1. Copy your ONNX model into version folder `1`:
   ```bash
   mkdir -p triton_repository/yolo_detector/1
   cp 3_ANPR_EDGE_WORKER/models/yolov9_anpr.onnx triton_repository/yolo_detector/1/model.onnx
   ```

2. Verify file presence:
   ```bash
   ls -la triton_repository/yolo_detector/1/model.onnx
   ```

3. Launch Triton Server:
   ```bash
   ./start_triton.sh
   ```
