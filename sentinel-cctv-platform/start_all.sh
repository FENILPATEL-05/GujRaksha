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

# Clean up any leftover worker instances before startup
pkill -f "anpr_worker.py" 2>/dev/null || true
pkill -f "ai_stream_service.py" 2>/dev/null || true

# Clean shutdown trap for all background sub-processes
PIDS=()
cleanup() {
    echo -e "\n${RED}⏹️ Shutting down all GujRaksha platform services...${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    pkill -f "anpr_worker.py" 2>/dev/null || true
    pkill -f "ai_stream_service.py" 2>/dev/null || true
    echo -e "${GREEN}✅ All services stopped safely.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT


## ------------------------------------------------------------------------------
# 1. Launch Central Command & Control Room Platform
# ------------------------------------------------------------------------------
echo -e "${YELLOW}🏢 [1/3] Starting Central CCC Server & Web UI (Port 3000)...${NC}"
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
# 2. Launch NVIDIA Triton GPU Inference Server (If Docker/GPU available)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}⚡ [2/3] Checking NVIDIA Triton GPU Inference Server...${NC}"
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
sleep 1

# Auto-detect primary LAN IP address
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LAN_IP" ]; then
    LAN_IP="127.0.0.1"
fi

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🚀 GUJRAKSHA PLATFORM READY! ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e " 💻 Local Access (This PC)       : ${CYAN}http://localhost:3000/${NC}"
echo -e " 🌐 Remote Access (Other PC/LAN) : ${GREEN}http://${LAN_IP}:3000/${NC}"
echo -e " ⚡ Distributed AI Ingestion API  : ${CYAN}http://${LAN_IP}:3000/api/v1/anpr/ingest${NC}"
echo -e "======================================================================\n"

# ------------------------------------------------------------------------------
# 3. Launch Distributed AI Worker Node (Live Logs to Terminal)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}🧠 [3/3] Launching Distributed AI Worker Node (Live ANPR & Tracking Logs)...${NC}\n"
if [ -d "3_ANPR_EDGE_WORKER" ]; then
    cd 3_ANPR_EDGE_WORKER
    if [ -f "start_worker.sh" ]; then
        bash start_worker.sh http://localhost:3000/api/v1 node-1 100
    elif command -v python3 &>/dev/null; then
        python3 anpr_worker.py --backend "$TRITON_BACKEND" --central-url http://localhost:3000/api/v1 --max-capacity 100
    fi
    cd "$PROJECT_ROOT"
fi

