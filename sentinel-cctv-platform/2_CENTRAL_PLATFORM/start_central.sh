#!/usr/bin/env bash
# ==============================================================================
# GujRaksha Central Platform — Main Command & Control Server
# Part 2 of 3: Central GIS Dashboard & Ingestion APIs (Run on Laptop / Central Server)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}======================================================================${NC}"
echo -e "${BOLD}${CYAN} 🏢 GUJRAKSHA CENTRAL COMMAND PLATFORM (Part 2: Central Server)${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Auto-detect primary LAN IP address
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LAN_IP" ]; then
  LAN_IP="127.0.0.1"
fi

PORT="${PORT:-3000}"

echo -e "🌐 ${BOLD}Central Server Network IP :${NC} ${GREEN}${LAN_IP}${NC}"
echo -e "💻 ${BOLD}Web UI & GIS Control Room :${NC} ${BOLD}${CYAN}http://${LAN_IP}:${PORT}/${NC}"
echo -e "📡 ${BOLD}AI Ingestion Endpoint     :${NC} ${BOLD}${PURPLE}http://${LAN_IP}:${PORT}/api/v1/anpr/ingest${NC}"
echo -e "${CYAN}----------------------------------------------------------------------${NC}"

# Check node_modules
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo -e "📦 ${YELLOW}node_modules missing. Installing npm packages...${NC}"
  npm install
fi

# Check production dist
if [ ! -d "$SCRIPT_DIR/dist" ]; then
  echo -e "⚙️  ${YELLOW}Building production frontend bundle...${NC}"
  npm run build
fi

echo -e "🚀 ${GREEN}Starting GujRaksha Central Server on port ${PORT}...${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

exec node server.js
