#!/usr/bin/env bash
# ==============================================================================
# GujRaksha (ગુજ રક્ષા) — Master 1-Click Setup Script
# Configures Node.js dependencies, Python AI environment, MediaMTX & Models
# Copyright (c) 2026 Fenil Patel. All Rights Reserved.
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN} 🛡️ GUJRAKSHA CCTV PLATFORM — MASTER 1-CLICK SYSTEM SETUP ${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

# 1. Check System Prerequisites
echo -e "${YELLOW}🔍 [1/5] Checking System Prerequisites...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js is required (v18+). Please install Node.js.${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ npm is required. Please install npm.${NC}"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo -e "${RED}❌ Python 3 is required (v3.10+). Please install Python 3.${NC}"; exit 1; }

echo -e "   • Node.js version : $(node -v)"
echo -e "   • npm version     : $(npm -v)"
echo -e "   • Python version  : $(python3 --version)"

if command -v nvidia-smi &>/dev/null; then
    echo -e "   • NVIDIA GPU      : ${GREEN}$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)${NC}"
else
    echo -e "   • NVIDIA GPU      : ${YELLOW}Not detected / Using CPU acceleration${NC}"
fi

# 2. Setup Stream Gateway (MediaMTX Binary)
echo -e "\n${YELLOW}📡 [2/5] Setting up Stream Gateway (MediaMTX)...${NC}"
MEDIAMTX_DIR="$PROJECT_ROOT/1_STREAM_GATEWAY/tools/mediamtx"
mkdir -p "$MEDIAMTX_DIR"
if [ ! -f "$MEDIAMTX_DIR/mediamtx" ]; then
    echo -e "   • Downloading MediaMTX v1.9.3..."
    curl -L -s "https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_amd64.tar.gz" -o "$MEDIAMTX_DIR/mediamtx.tar.gz"
    tar -xzf "$MEDIAMTX_DIR/mediamtx.tar.gz" -C "$MEDIAMTX_DIR"
    rm -f "$MEDIAMTX_DIR/mediamtx.tar.gz"
    chmod +x "$MEDIAMTX_DIR/mediamtx"
    echo -e "${GREEN}   • MediaMTX streaming binary installed.${NC}"
else
    echo -e "${GREEN}   • MediaMTX binary already installed.${NC}"
fi

# 3. Setup Central Platform (Node.js & React Frontend)
echo -e "\n${YELLOW}📦 [3/5] Setting up Central Platform (Node.js/React)...${NC}"
if [ -d "2_CENTRAL_PLATFORM" ]; then
    cd 2_CENTRAL_PLATFORM
    npm install --silent || npm install
    echo -e "   • Building production frontend bundle..."
    npm run build
    cd "$PROJECT_ROOT"
fi
echo -e "${GREEN}✅ Central Platform dependencies installed & built.${NC}"

# 4. Setup Python AI Edge Worker
echo -e "\n${YELLOW}🐍 [4/5] Setting up Python AI Edge Worker Environment...${NC}"
mkdir -p 3_ANPR_EDGE_WORKER/models/onnx
if [ -d "2_CENTRAL_PLATFORM/models/onnx" ]; then
    cp -r 2_CENTRAL_PLATFORM/models/onnx/* 3_ANPR_EDGE_WORKER/models/onnx/ 2>/dev/null || true
fi

if [ -d "3_ANPR_EDGE_WORKER" ]; then
    cd 3_ANPR_EDGE_WORKER
    if [ -f "setup_env.sh" ]; then
        bash setup_env.sh
    else
        pip3 install -r requirements.txt --quiet || pip install -r requirements.txt
    fi
    cd "$PROJECT_ROOT"
fi
echo -e "${GREEN}✅ Python AI Edge Worker dependencies installed.${NC}"

# 5. NVIDIA Triton Model Repository & ONNX Model Sync
echo -e "\n${YELLOW}⚡ [5/5] Configuring NVIDIA Triton Model Repository & AI Model Sync...${NC}"
mkdir -p triton_repository/yolo_detector/1
mkdir -p triton_repository/object_detector/1
mkdir -p triton_repository/plate_ocr/1

if [ -f "2_CENTRAL_PLATFORM/models/onnx/plate_detector.onnx" ]; then
    cp 2_CENTRAL_PLATFORM/models/onnx/plate_detector.onnx triton_repository/yolo_detector/1/model.onnx 2>/dev/null || true
fi
if [ -f "2_CENTRAL_PLATFORM/models/onnx/object_detection.onnx" ]; then
    cp 2_CENTRAL_PLATFORM/models/onnx/object_detection.onnx triton_repository/object_detector/1/model.onnx 2>/dev/null || true
fi
if [ -f "2_CENTRAL_PLATFORM/models/onnx/plate_ocr.onnx" ]; then
    cp 2_CENTRAL_PLATFORM/models/onnx/plate_ocr.onnx triton_repository/plate_ocr/1/model.onnx 2>/dev/null || true
fi
echo -e "${GREEN}✅ AI models synchronized across Central, Worker, and Triton repositories.${NC}"

# Grant execution permissions to all scripts
chmod +x start_all.sh setup_all.sh start_triton.sh 1_STREAM_GATEWAY/start_gateway.sh 2_CENTRAL_PLATFORM/start_central.sh 3_ANPR_EDGE_WORKER/start_worker.sh 3_ANPR_EDGE_WORKER/setup_env.sh 2>/dev/null || true

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🎉 GUJRAKSHA 1-CLICK MASTER SETUP COMPLETED SUCCESSFULLY! ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "To launch the entire platform in full harmony, simply run:"
echo -e "${CYAN}   ./start_all.sh${NC}\n"
