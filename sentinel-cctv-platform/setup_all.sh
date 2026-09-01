#!/usr/bin/env bash
# ==============================================================================
# GujRaksha (ગુજ રક્ષા) — Master 1-Click Setup Script
# Configures Node.js dependencies, Python AI environment & Triton repository
# Copyright (c) 2026 Fenil Patel. All Rights Reserved.
# ==============================================================================

set -e

GREEN='\031[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN} 🛡️ GUJRAKSHA CCTV PLATFORM — MASTER SYSTEM ENVIRONMENT SETUP ${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 1. Check System Prerequisites
echo -e "${YELLOW}🔍 [1/4] Checking System Prerequisites...${NC}"
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 is required but not installed. Aborting."; exit 1; }

echo -e "   • Node.js version : $(node -v)"
echo -e "   • npm version     : $(npm -v)"
echo -e "   • Python version  : $(python3 --version)"

if command -v nvidia-smi &>/dev/null; then
    echo -e "   • NVIDIA GPU      : ${GREEN}$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)${NC}"
else
    echo -e "   • NVIDIA GPU      : ${YELLOW}Not detected / Using CPU mode${NC}"
fi

# 2. Central Platform Setup (Node.js & React Frontend)
echo -e "\n${YELLOW}📦 [2/4] Installing Central Platform (Node.js/React) Dependencies...${NC}"
if [ -d "2_CENTRAL_PLATFORM" ]; then
    cd 2_CENTRAL_PLATFORM
    npm install --silent || npm install
    cd "$PROJECT_ROOT"
fi

if [ -f "package.json" ]; then
    npm install --silent || npm install
fi
echo -e "${GREEN}✅ Central Platform dependencies installed.${NC}"

# 3. Python AI Edge Worker Setup
echo -e "\n${YELLOW}🐍 [3/4] Setting up Python AI Edge Worker Environment...${NC}"
cd 3_ANPR_EDGE_WORKER
if [ -f "setup_env.sh" ]; then
    bash setup_env.sh
else
    pip3 install -r requirements.txt --quiet || pip install -r requirements.txt
fi
cd "$PROJECT_ROOT"
echo -e "${GREEN}✅ Python AI Edge Worker dependencies installed.${NC}"

# 4. NVIDIA Triton Model Repository Setup
echo -e "\n${YELLOW}⚡ [4/4] Configuring NVIDIA Triton Model Repository...${NC}"
mkdir -p triton_repository/yolo_detector/1
mkdir -p triton_repository/object_detector/1
mkdir -p triton_repository/plate_ocr/1

if [ -f "3_ANPR_EDGE_WORKER/models/onnx/plate_detector.onnx" ]; then
    cp 3_ANPR_EDGE_WORKER/models/onnx/plate_detector.onnx triton_repository/yolo_detector/1/model.onnx
    echo -e "${GREEN}✅ Copied plate_detector.onnx into Triton Repository.${NC}"
fi

if [ -f "3_ANPR_EDGE_WORKER/models/onnx/object_detection.onnx" ]; then
    cp 3_ANPR_EDGE_WORKER/models/onnx/object_detection.onnx triton_repository/object_detector/1/model.onnx
    echo -e "${GREEN}✅ Copied object_detection.onnx into Triton Repository.${NC}"
fi

# Make execution scripts executable
chmod +x start_all.sh start_triton.sh 1_STREAM_GATEWAY/start_gateway.sh 2_CENTRAL_PLATFORM/start_central.sh 3_ANPR_EDGE_WORKER/start_worker.sh 2>/dev/null || true

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🎉 GUJRAKSHA MASTER SETUP COMPLETED SUCCESSFULLY! ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "To start the entire platform with 1-click, run:"
echo -e "${CYAN}   ./start_all.sh${NC}\n"
