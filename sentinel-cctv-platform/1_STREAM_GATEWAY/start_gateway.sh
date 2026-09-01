#!/usr/bin/env bash
# ==============================================================================
# GujRaksha Stream Gateway — Unified MediaMTX Live Video Server
#
# USAGE:
#   1. Physical RTSP Camera:
#      ./start_gateway.sh rtsp://admin:123456@192.168.1.188:554/stream [stream_id]
#
#   2. Laptop Webcam:
#      ./start_gateway.sh webcam [stream_id]
#
#   3. Pure Gateway Mode:
#      ./start_gateway.sh
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEDIAMTX_BIN="$SCRIPT_DIR/tools/mediamtx/mediamtx"
BASE_CFG="$SCRIPT_DIR/tools/mediamtx/mediamtx.yml"
ACTIVE_CFG="/tmp/mediamtx_active_$$.yml"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

INPUT_SRC="$1"
STREAM_ID="${2:-1}"

# Cleanup temporary config on exit
trap "rm -f $ACTIVE_CFG" EXIT

echo -e "${CYAN}======================================================================${NC}"
echo -e "${BOLD}${CYAN} 📡 GUJRAKSHA STREAM GATEWAY (Part 1: MediaMTX Live Video Server)${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Auto-detect primary LAN IP address
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LAN_IP" ]; then
  LAN_IP="127.0.0.1"
fi

# Check Binary
if [ ! -f "$MEDIAMTX_BIN" ]; then
  echo -e "⚠️  ${YELLOW}MediaMTX binary not found at: $MEDIAMTX_BIN${NC}"
  echo -e "⚙️  Auto-downloading MediaMTX..."
  mkdir -p "$SCRIPT_DIR/tools/mediamtx"
  curl -L -s "https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_amd64.tar.gz" -o "$SCRIPT_DIR/tools/mediamtx/mediamtx.tar.gz"
  tar -xzf "$SCRIPT_DIR/tools/mediamtx/mediamtx.tar.gz" -C "$SCRIPT_DIR/tools/mediamtx"
fi
# Auto-cleanup previous instance if still running
pkill -9 -f mediamtx 2>/dev/null || true
sleep 0.3

# Build configuration based on input
if [[ "$INPUT_SRC" == rtsp://* ]] || [[ "$INPUT_SRC" == rtsps://* ]]; then
  # Option 1: Physical RTSP Camera
  echo -e "📹 ${BOLD}Mode:${NC} ${GREEN}Physical RTSP Camera Direct Ingest${NC}"
  echo -e "🔗 ${BOLD}Source Camera:${NC} ${YELLOW}$INPUT_SRC${NC}"
  echo -e "🆔 ${BOLD}Stream Channel:${NC} stream/${STREAM_ID}"
  echo -e ""
  echo -e "${BOLD}📌 Available Stream Endpoints:${NC}"
  echo -e "   1️⃣  ${YELLOW}RTSP Stream URL (Python AI):${NC} ${BOLD}$INPUT_SRC${NC}"
  echo -e "   2️⃣  ${PURPLE}WebRTC / WHEP   (Central UI):${NC} ${BOLD}http://${LAN_IP}:8889/stream/${STREAM_ID}/whep${NC}"
  echo -e "   3️⃣  ${GREEN}HLS Live Stream (Mobile/VLC):${NC} ${BOLD}http://${LAN_IP}:8888/stream/${STREAM_ID}/index.m3u8${NC}"
  echo -e "${CYAN}----------------------------------------------------------------------${NC}"

  # Strip existing paths and inject camera path
  sed '/^paths:/,$d' "$BASE_CFG" > "$ACTIVE_CFG"
  cat <<EOF >> "$ACTIVE_CFG"
paths:
  stream/${STREAM_ID}:
    source: "$INPUT_SRC"
    sourceOnDemand: no
    rtspTransport: tcp
  all_others:
EOF

elif [ "$INPUT_SRC" == "webcam" ] || [ "$INPUT_SRC" == "0" ] || [[ "$INPUT_SRC" == /dev/video* ]]; then
  # Option 2: Webcam
  DEV_NAME="${INPUT_SRC}"
  if [ "$DEV_NAME" == "webcam" ] || [ "$DEV_NAME" == "0" ]; then
    DEV_NAME="/dev/video0"
  fi

  echo -e "📹 ${BOLD}Mode:${NC} ${GREEN}Local Webcam Streaming${NC}"
  echo -e "📷 ${BOLD}Device:${NC} ${YELLOW}$DEV_NAME${NC}"
  echo -e "🆔 ${BOLD}Stream Channel:${NC} stream/${STREAM_ID}"
  echo -e ""
  echo -e "${BOLD}📌 Available Stream Endpoints:${NC}"
  echo -e "   1️⃣  ${YELLOW}RTSP Stream URL (Python AI):${NC} ${BOLD}rtsp://${LAN_IP}:8554/stream/${STREAM_ID}${NC}"
  echo -e "   2️⃣  ${PURPLE}WebRTC / WHEP   (Central UI):${NC} ${BOLD}http://${LAN_IP}:8889/stream/${STREAM_ID}/whep${NC}"
  echo -e "   3️⃣  ${GREEN}HLS Live Stream (Mobile/VLC):${NC} ${BOLD}http://${LAN_IP}:8888/stream/${STREAM_ID}/index.m3u8${NC}"
  echo -e "${CYAN}----------------------------------------------------------------------${NC}"

  sed '/^paths:/,$d' "$BASE_CFG" > "$ACTIVE_CFG"
  cat <<EOF >> "$ACTIVE_CFG"
paths:
  stream/${STREAM_ID}:
    runOnInit: ffmpeg -f v4l2 -framerate 30 -video_size 1280x720 -i $DEV_NAME -c:v libx264 -preset ultrafast -tune zerolatency -b:v 2000k -maxrate 2500k -bufsize 800k -an -f rtsp -rtsp_transport tcp rtsp://localhost:8554/stream/${STREAM_ID}
    runOnInitRestart: yes
  all_others:
EOF

else
  # Option 3: Default Pure Gateway Mode
  echo -e "🌐 ${BOLD}Host Machine Network IP:${NC} ${GREEN}${LAN_IP}${NC}"
  echo -e ""
  echo -e "${BOLD}📌 Available Protocol Endpoints (for Stream '1'):${NC}"
  echo -e "   1️⃣  ${YELLOW}RTSP Stream URL   :${NC} ${BOLD}rtsp://${LAN_IP}:8554/stream/1${NC}"
  echo -e "   2️⃣  ${PURPLE}WebRTC / WHEP URL :${NC} ${BOLD}http://${LAN_IP}:8889/stream/1/whep${NC}"
  echo -e "   3️⃣  ${GREEN}HLS Live URL      :${NC} ${BOLD}http://${LAN_IP}:8888/stream/1/index.m3u8${NC}"
  echo -e "${CYAN}----------------------------------------------------------------------${NC}"
  cp "$BASE_CFG" "$ACTIVE_CFG"
fi

echo -e "🚀 ${GREEN}Launching MediaMTX Video Server...${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

exec "$MEDIAMTX_BIN" "$ACTIVE_CFG"
