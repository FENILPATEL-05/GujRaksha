#!/usr/bin/env bash
# =============================================================================
# GujRaksha (ગુજ રક્ષા) — Statewide CCTV Platform Fresh Build Automation Script
# Copyright (c) 2026 Fenil Patel. All Rights Reserved.
# =============================================================================

set -e

# Color Constants
RED='\030[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Determine Script Location & Working Directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CLEAN_BUILD=false

# Parse Command Line Arguments
for arg in "$@"; do
  case $arg in
    -c|--clean)
      CLEAN_BUILD=true
      shift
      ;;
    -h|--help)
      echo -e "${CYAN}GujRaksha CCTV Build System${NC}"
      echo "Usage: ./scripts/build.sh [options]"
      echo ""
      echo "Options:"
      echo "  -c, --clean    Perform a complete fresh build (cleans old binaries, dist, & caches)"
      echo "  -h, --help     Display this help message"
      exit 0
      ;;
  esac
done

cd "${PLATFORM_DIR}"

echo -e "${BLUE}=======================================================${NC}"
echo -e "${CYAN}🚀 GUJRAKSHA CCTV PLATFORM — BUILD PIPELINE${NC}"
echo -e "${BLUE}=======================================================${NC}"

if [ "${CLEAN_BUILD}" = true ]; then
  echo -e "${YELLOW}🧹 [CLEAN BUILD MODE ACTIVATED] Cleaning prior build artifacts...${NC}"
  
  # Remove standalone legacy detector script if lingering
  rm -f live_cctv_anpr_detector.py
  
  # Clean C++ build objects & binaries
  if [ -d "cpp" ]; then
    echo -e "   • Cleaning C++ objects and binaries..."
    make -C cpp clean > /dev/null 2>&1 || true
    rm -f cpp/sentinel_anpr_engine cpp/src/*.o
  fi

  # Clean Vite frontend dist & cache
  echo -e "   • Cleaning Vite frontend dist output & build cache..."
  rm -rf dist node_modules/.vite public/assets/*.js public/assets/*.css
  
  echo -e "${GREEN}✓ Clean completed successfully!${NC}\n"
fi

# Step 1: Build Native C++ ANPR Engine
echo -e "${CYAN}⚙️ Step 1/2: Compiling Native C++ ANPR Engine...${NC}"
if [ -d "cpp" ]; then
  make -C cpp
  if [ -f "cpp/sentinel_anpr_engine" ]; then
    echo -e "${GREEN}✓ Native C++ ANPR Engine compiled successfully -> cpp/sentinel_anpr_engine${NC}"
  else
    echo -e "${RED}❌ C++ ANPR Engine compilation failed!${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️ C++ directory not found, skipping C++ engine build.${NC}"
fi

# Step 2: Build Vite Production Web Assets
echo -e "\n${CYAN}📦 Step 2/2: Building Production Frontend Bundle (Vite)...${NC}"
if [ -f "package.json" ]; then
  npm run build
  echo -e "${GREEN}✓ Vite bundle generated successfully in public/dist assets!${NC}"
else
  echo -e "${RED}❌ package.json not found in ${PLATFORM_DIR}${NC}"
  exit 1
fi

echo -e "\n${BLUE}=======================================================${NC}"
echo -e "${GREEN}✨ GUJRAKSHA PLATFORM BUILD COMPLETE & READY FOR DEPLOYMENT!${NC}"
echo -e "${BLUE}=======================================================${NC}"
