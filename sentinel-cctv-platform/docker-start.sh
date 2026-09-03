#!/usr/bin/env bash
# ==============================================================================
# GujRaksha (ગુજ રક્ષા) — 1-Click Smart Docker Launch Script
# Checks GPU availability first. If GPU is unavailable, asks user for CPU fallback.
# If user accepts, runs CPU mode; if rejected, aborts startup.
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN} 🛡️ GUJRAKSHA PLATFORM — SMART DOCKER CONTAINER LAUNCH ${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

# 1. Determine Docker Compose Command
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}❌ docker compose is not installed. Please install Docker Compose plugin.${NC}"
    exit 1
fi

# 2. Check NVIDIA GPU Availability
echo -e "${YELLOW}🔍 Checking NVIDIA GPU & CUDA Container Support...${NC}"
GPU_WORKING=false

if command -v nvidia-smi &>/dev/null; then
    if nvidia-smi &>/dev/null; then
        # Check if docker daemon supports nvidia container runtime
        if docker info 2>/dev/null | grep -iq "nvidia" || docker run --rm --gpus all alpine true 2>/dev/null; then
            GPU_WORKING=true
        fi
    fi
fi

COMPOSE_FILE="docker-compose.yml"

if [ "$GPU_WORKING" = true ]; then
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -n 1)
    echo -e "${GREEN}⚡ [GPU ACTIVE] NVIDIA GPU detected: ${GPU_NAME}${NC}"
    echo -e "${GREEN}   Launching GujRaksha in Hardware GPU Accelerated Mode.${NC}\n"
else
    echo -e "${RED}⚠️  [GPU UNAVAILABLE] NVIDIA GPU is not working or GPU container runtime is missing.${NC}\n"
    
    # Ask User interactively
    read -p "Do you want to run on CPU? GPU is not working. (y/n): " USER_RESP
    
    case "$USER_RESP" in
        [yY]|[yY][eE][sS])
            echo -e "\n${YELLOW}⚙️  User selected YES. Proceeding with CPU Fallback Mode...${NC}\n"
            COMPOSE_FILE="docker-compose.cpu.yml"
            ;;
        *)
            echo -e "\n${RED}🛑 User selected NO (or invalid input). Startup aborted.${NC}"
            exit 1
            ;;
    esac
fi

# 3. Launch Docker Compose Stack
echo -e "${YELLOW}🐳 Building & Launching Containers via ${COMPOSE_FILE}...${NC}"
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up --build -d

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🚀 GUJRAKSHA DOCKER PLATFORM IS NOW LIVE! ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e " 💻 Central Dashboard UI       : ${CYAN}http://localhost:3000/${NC}"
echo -e " ⚡ Distributed Ingestion API   : ${CYAN}http://localhost:3000/api/v1/anpr/ingest${NC}"
echo -e " 📹 RTSP Video Gateway Port     : ${GREEN}8554 (RTSP), 8889 (WHEP WebRTC)${NC}"
echo -e " 🐘 PostgreSQL PostGIS DB       : ${GREEN}localhost:5433${NC}"
echo -e "======================================================================\n"
echo -e "To view live service logs: ${CYAN}$DOCKER_COMPOSE -f $COMPOSE_FILE logs -f${NC}"
echo -e "To stop all services:       ${YELLOW}$DOCKER_COMPOSE -f $COMPOSE_FILE down${NC}\n"
