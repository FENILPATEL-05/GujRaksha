#!/usr/bin/env bash
# =============================================================================
# GujRaksha (ગુજ રક્ષા) — RTSP & WHEP Live Streaming Server & Video Feeder
# Copyright (c) 2026 Fenil Patel. All Rights Reserved.
# =============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TOOLS_DIR="${ROOT_DIR}/tools"
MEDIAMTX_DIR="${TOOLS_DIR}/mediamtx"
MEDIAMTX_BIN="${MEDIAMTX_DIR}/mediamtx"

print_help() {
  echo -e "${CYAN}=================================================================${NC}"
  echo -e "${GREEN} 📡 GujRaksha CCTV RTSP & WHEP WebRTC Stream Setup${NC}"
  echo -e "${CYAN}=================================================================${NC}"
  echo "Usage:"
  echo "  ./scripts/setup_mediamtx_and_stream.sh [command] [options]"
  echo ""
  echo "Commands:"
  echo "  server                   Start MediaMTX RTSP & WHEP WebRTC server"
  echo "  send <file.mp4> [id]     Stream a local video file to a single camera stream"
  echo "                           (Default stream ID: 1 -> rtsp://localhost:8554/stream/1)"
  echo "  send-all <file.mp4> [N]  Stream video to N cameras simultaneously (1 to N, default: 9)"
  echo "                           (Ideal for populating the entire 3x3 Video Wall matrix)"
  echo "  webcam [id]              Stream live USB / Laptop Webcam (/dev/video0)"
  echo "  demo [id]                Generate a synthetic test video feed and stream it"
  echo "  help                     Display this guide"
  echo ""
  echo "Examples:"
  echo "  1) Start MediaMTX Server:        ./scripts/setup_mediamtx_and_stream.sh server"
  echo "  2) Stream to Camera 1:           ./scripts/setup_mediamtx_and_stream.sh send ../../hack/test.mp4 1"
  echo "  3) Stream to ALL 9 Video Wall:   ./scripts/setup_mediamtx_and_stream.sh send-all ../../hack/test.mp4 9"
  echo "  4) Stream Webcam to Camera 1:    ./scripts/setup_mediamtx_and_stream.sh webcam 1"
  echo -e "${CYAN}=================================================================${NC}"
}

download_mediamtx() {
  mkdir -p "${MEDIAMTX_DIR}"
  if [ ! -f "${MEDIAMTX_BIN}" ]; then
    echo -e "${CYAN}⬇️ Downloading MediaMTX (v1.9.3 Linux x86_64)...${NC}"
    curl -L "https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_amd64.tar.gz" -o "${MEDIAMTX_DIR}/mediamtx.tar.gz"
    tar -xzf "${MEDIAMTX_DIR}/mediamtx.tar.gz" -C "${MEDIAMTX_DIR}"
    chmod +x "${MEDIAMTX_BIN}"
    echo -e "${GREEN}✓ MediaMTX installed successfully into ${MEDIAMTX_BIN}${NC}"
  fi
}

start_server() {
  download_mediamtx
  echo -e "${GREEN}=======================================================${NC}"
  echo -e "${CYAN}🚀 Starting MediaMTX RTSP & WHEP WebRTC Streaming Server${NC}"
  echo -e "   • RTSP Ingest:        rtsp://localhost:8554/<stream_name>"
  echo -e "   • WHEP WebRTC (UI):   http://localhost:8889/<stream_name>/whep"
  echo -e "   • HLS Live Feed:      http://localhost:8888/<stream_name>"
  echo -e "${GREEN}=======================================================${NC}"
  cd "${MEDIAMTX_DIR}"
  exec "${MEDIAMTX_BIN}"
}

send_file() {
  local FILE="$1"
  local STREAM_ID="${2:-1}"
  local RTSP_TARGET="rtsp://localhost:8554/stream/${STREAM_ID}"
  local WHEP_TARGET="http://localhost:8889/stream/${STREAM_ID}/whep"

  if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    echo -e "${RED}❌ Error: Video file '$FILE' not found!${NC}"
    echo "Usage: ./scripts/setup_mediamtx_and_stream.sh send <video_file.mp4> [stream_number]"
    exit 1
  fi

  if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}❌ Error: ffmpeg is not installed on your system!${NC}"
    echo "Install it with: sudo apt update && sudo apt install -y ffmpeg"
    exit 1
  fi

  echo -e "${GREEN}=======================================================${NC}"
  echo -e "${CYAN}📹 Streaming File: ${FILE}${NC}"
  echo -e "   • Stream ID:          stream/${STREAM_ID}"
  echo -e "   • RTSP Target:        ${RTSP_TARGET}"
  echo -e "   • WHEP WebRTC Target: ${WHEP_TARGET}"
  echo -e "   • Continuous Loop:    Active (-stream_loop -1)"
  echo -e "${GREEN}=======================================================${NC}"
  echo -e "${YELLOW}Press Ctrl+C to stop the stream feeder.${NC}\n"

  ffmpeg -re -stream_loop -1 -i "$FILE" \
    -c:v libx264 -preset ultrafast -tune zerolatency \
    -profile:v baseline -level 3.1 \
    -pix_fmt yuv420p -b:v 2500k -maxrate 3000k -bufsize 6000k \
    -g 30 -keyint_min 30 -sc_threshold 0 -bf 0 \
    -an \
    -f rtsp -rtsp_transport tcp "${RTSP_TARGET}"
}

send_all_matrix() {
  local FILE="$1"
  local COUNT="${2:-9}"

  if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    echo -e "${RED}❌ Error: Video file '$FILE' not found!${NC}"
    echo "Usage: ./scripts/setup_mediamtx_and_stream.sh send-all <video_file.mp4> [count]"
    exit 1
  fi

  echo -e "${GREEN}=======================================================${NC}"
  echo -e "${CYAN}📹 Broadcasting Video to ${COUNT} Cameras Concurrently${NC}"
  echo -e "   • File:               ${FILE}"
  echo -e "   • Streams Active:     stream/1 through stream/${COUNT}"
  echo -e "   • All WHEP Endpoints: http://localhost:8889/stream/[1-${COUNT}]/whep"
  echo -e "${GREEN}=======================================================${NC}"
  echo -e "${YELLOW}Press Ctrl+C to stop all feeders.${NC}\n"

  PIDS=()
  cleanup() {
    echo -e "\n${YELLOW}Stopping all ${COUNT} stream feeders...${NC}"
    for pid in "${PIDS[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
    exit 0
  }
  trap cleanup SIGINT SIGTERM EXIT

  for i in $(seq 1 "$COUNT"); do
    echo -e "   • Spawning stream/${i} -> rtsp://localhost:8554/stream/${i}"
    ffmpeg -re -stream_loop -1 -i "$FILE" \
      -c:v libx264 -preset ultrafast -tune zerolatency \
      -profile:v baseline -level 3.1 \
      -pix_fmt yuv420p -b:v 1800k -maxrate 2200k -bufsize 4000k \
      -g 30 -keyint_min 30 -sc_threshold 0 -bf 0 \
      -an \
      -f rtsp -rtsp_transport tcp "rtsp://localhost:8554/stream/${i}" > /dev/null 2>&1 &
    PIDS+=($!)
  done

  echo -e "\n${GREEN}✓ All ${COUNT} streams are actively publishing to MediaMTX!${NC}"
  echo -e "${CYAN}You can now open the Video Wall in the web UI at http://localhost:3000${NC}"
  wait
}

send_webcam() {
  local STREAM_ID="${1:-1}"
  local RTSP_TARGET="rtsp://localhost:8554/stream/${STREAM_ID}"
  local WHEP_TARGET="http://localhost:8889/stream/${STREAM_ID}/whep"

  echo -e "${GREEN}=======================================================${NC}"
  echo -e "${CYAN}📷 Streaming Live Webcam (/dev/video0)${NC}"
  echo -e "   • RTSP Target:        ${RTSP_TARGET}"
  echo -e "   • WHEP WebRTC Target: ${WHEP_TARGET}"
  echo -e "${GREEN}=======================================================${NC}"

  ffmpeg -f v4l2 -framerate 30 -video_size 1280x720 -i /dev/video0 \
    -c:v libx264 -preset ultrafast -tune zerolatency \
    -profile:v baseline -level 3.1 \
    -pix_fmt yuv420p -g 30 -keyint_min 30 -sc_threshold 0 -bf 0 -an \
    -f rtsp -rtsp_transport tcp "${RTSP_TARGET}"
}

send_demo_feed() {
  local STREAM_ID="${1:-1}"
  local RTSP_TARGET="rtsp://localhost:8554/stream/${STREAM_ID}"
  local WHEP_TARGET="http://localhost:8889/stream/${STREAM_ID}/whep"

  echo -e "${CYAN}🎨 Generating Synthetic Live CCTV Feed to ${RTSP_TARGET}...${NC}"

  ffmpeg -re -f lavfi -i "testsrc=size=1920x1080:rate=30,drawtext=text='GujRaksha CCTV Camera ${STREAM_ID} - %{localtime\:%Y-%m-%d %H\\\\\\:%M\\\\\\:%S}':fontcolor=white:fontsize=44:box=1:boxcolor=black@0.6:boxborderw=10:x=(w-text_w)/2:y=50" \
    -c:v libx264 -preset ultrafast -tune zerolatency \
    -profile:v baseline -level 3.1 \
    -pix_fmt yuv420p -g 30 -keyint_min 30 -sc_threshold 0 -bf 0 -an \
    -f rtsp -rtsp_transport tcp "${RTSP_TARGET}"
}

CMD="${1:-help}"
shift || true

case "${CMD}" in
  server|serve)
    start_server
    ;;
  send|stream)
    send_file "$@"
    ;;
  send-all|matrix|feed-all)
    send_all_matrix "$@"
    ;;
  webcam|cam)
    send_webcam "$@"
    ;;
  demo|test)
    send_demo_feed "$@"
    ;;
  help|--help|-h)
    print_help
    ;;
  *)
    echo -e "${RED}Unknown command: ${CMD}${NC}\n"
    print_help
    exit 1
    ;;
esac
