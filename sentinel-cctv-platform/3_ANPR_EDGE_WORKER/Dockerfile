# ==============================================================================
# GujRaksha (ગુજ રક્ષા) — Distributed AI Edge Worker Dockerfile
# Python-based ANPR, ByteTrack Vehicle Tracking & AI Analytics Engine
# ==============================================================================

FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system libraries required by OpenCV, FFmpeg, and ONNX Runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements manifest
COPY requirements.txt ./

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker application code
COPY . .

# Set default environment variables
ENV CENTRAL_URL="http://central-platform:3000/api/v1"
ENV TRITON_BACKEND="auto"
ENV MAX_CAPACITY=100

# Run Distributed AI ANPR Worker Engine
CMD ["python3", "anpr_worker.py", "--central-url", "http://central-platform:3000/api/v1", "--backend", "auto", "--max-capacity", "100"]
