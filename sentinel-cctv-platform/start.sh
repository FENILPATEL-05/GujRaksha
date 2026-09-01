#!/usr/bin/env bash
# ==============================================================================
# GujRaksha (ગુજ રક્ષા) — 1-Click Master Platform Launch
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/start_all.sh" "$@"
