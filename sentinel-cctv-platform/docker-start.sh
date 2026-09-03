#!/usr/bin/env bash
# ==============================================================================
# GujRaksha (ગુજ રક્ષા) — 1-Click Docker Launch Script
# Starts Central Platform, AI Worker, MediaMTX, Triton GPU & PostgreSQL via Docker
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
echo -e "${CYAN} 🛡️ GUJRAKSHA PLATFORM — DOCKER CONTAINER LAUNCH ${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

# Determine Docker Compose Command
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}❌ docker compose is not installed. Please install Docker Compose plugin.${NC}"
    exit 1
fi

echo -e "${YELLOW}🐳 [1/3] Building & Starting Docker Containers...${NC}"
$DOCKER_COMPOSE up --build -d

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🚀 DOCKERIZED GUJRAKSHA PLATFORM IS NOW LIVE! ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e " 💻 Central Dashboard UI       : ${CYAN}http://localhost:3000/${NC}"
echo -e " ⚡ Distributed Ingestion API   : ${CYAN}http://localhost:3000/api/v1/anpr/ingest${NC}"
echo -e " 📹 RTSP Video Gateway Port     : ${GREEN}8554 (RTSP), 8889 (WHEP WebRTC)${NC}"
echo -e " 🧠 Triton GPU Inference Engine : ${CYAN}localhost:8001 (gRPC)${NC}"
echo -e " 🐘 PostgreSQL PostGIS DB       : ${GREEN}localhost:5432${NC}"
echo -e "======================================================================\n"
echo -e "To view live service logs: ${CYAN}$DOCKER_COMPOSE logs -f${NC}"
echo -e "To stop all services:       ${YELLOW}$DOCKER_COMPOSE down${NC}\n"
