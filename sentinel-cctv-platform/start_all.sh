#!/usr/bin/env bash
# ==============================================================================
# GujRaksha (ગુજ રક્ષા) — Master 1-Click System Startup Script
# Boots up Stream Gateway, Central CCC, Triton Inference Server & AI Workers
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
echo -e "${CYAN} 🛡️ GUJRAKSHA CCTV PLATFORM — MASTER 1-CLICK SYSTEM LAUNCH ${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

# Clean shutdown trap for all background sub-processes
PIDS=()
cleanup() {
    echo -e "\n${RED}⏹️ Shutting down all GujRaksha platform services...${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    echo -e "${GREEN}✅ All services stopped safely.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ------------------------------------------------------------------------------
# 1. Launch Stream Gateway (MediaMTX RTSP / WebRTC / HLS Server)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}📡 [1/4] Starting Stream Gateway (MediaMTX RTSP / WebRTC / HLS)...${NC}"
if [ -d "1_STREAM_GATEWAY" ]; then
    cd 1_STREAM_GATEWAY
    if [ -f "start_gateway.sh" ]; then
        bash start_gateway.sh > /tmp/gujraksha_gateway.log 2>&1 &
        PIDS+=($!)
        echo -e "${GREEN}   • Stream Gateway running (RTSP: 8554 | WebRTC: 8889 | HLS: 8888)${NC}"
    fi
    cd "$PROJECT_ROOT"
fi
sleep 1

# ------------------------------------------------------------------------------
# 2. Launch Central Command & Control Room Platform
# ------------------------------------------------------------------------------
echo -e "${YELLOW}🏢 [2/4] Starting Central CCC Server & Web UI (Port 3000)...${NC}"
if [ -d "2_CENTRAL_PLATFORM" ]; then
    cd 2_CENTRAL_PLATFORM
    if [ -f "start_central.sh" ]; then
        bash start_central.sh > /tmp/gujraksha_central.log 2>&1 &
        PIDS+=($!)
    else
        npm run dev > /tmp/gujraksha_central.log 2>&1 &
        PIDS+=($!)
    fi
    cd "$PROJECT_ROOT"
    echo -e "${GREEN}   • Central CCC Web UI running at: http://localhost:3000/${NC}"
fi
sleep 2

# ------------------------------------------------------------------------------
# 3. Launch NVIDIA Triton GPU Inference Server (If Docker/GPU available)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}⚡ [3/4] Launching NVIDIA Triton GPU Inference Server...${NC}"
TRITON_BACKEND="auto"
if command -v docker &>/dev/null && command -v nvidia-smi &>/dev/null; then
    if [ -f "start_triton.sh" ]; then
        bash start_triton.sh > /tmp/gujraksha_triton.log 2>&1 &
        PIDS+=($!)
        TRITON_BACKEND="triton"
        echo -e "${GREEN}   • Triton GPU Inference Server initialized on port :8001 (gRPC)${NC}"
    fi
else
    echo -e "${YELLOW}   • Skipping Triton Docker launch (Docker or GPU not active). Using local engine.${NC}"
fi
sleep 2

# ------------------------------------------------------------------------------
# 4. Launch Distributed AI Worker Node
# ------------------------------------------------------------------------------
echo -e "${YELLOW}🧠 [4/4] Launching Distributed AI Worker Node...${NC}"
if [ -d "3_ANPR_EDGE_WORKER" ]; then
    cd 3_ANPR_EDGE_WORKER
    if command -v python3 &>/dev/null; then
        python3 anpr_worker.py --backend "$TRITON_BACKEND" --central-url http://localhost:3000/api/v1 --max-capacity 100 &
        PIDS+=($!)
        echo -e "${GREEN}   • Distributed AI Edge Worker Node active!${NC}"
    fi
    cd "$PROJECT_ROOT"
fi

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🚀 ALL GUJRAKSHA SERVICES RUNNING IN FULL HARMONY! ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e " 🌐 Central Control Room UI : ${CYAN}http://localhost:3000/${CYAN}"
echo -e " 🔴 RTSP Video Gateway    : ${CYAN}rtsp://localhost:8554/stream/1${CYAN}"
echo -e " ⚡ Triton gRPC API       : ${CYAN}localhost:8001${CYAN}"
echo -e " 📊 Triton GPU Metrics    : ${CYAN}http://localhost:8002/metrics${CYAN}"
echo -e "======================================================================"
echo -e "Press [Ctrl+C] anytime to stop all processes.\n"

# Keep master script alive while sub-processes run
wait
