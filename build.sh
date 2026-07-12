#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

A3="$DIR/awtrix3"
. "$DIR/tools/awtrix3_build_lib.sh"

ENV_NAME="awtrix2_upgrade"
PORT="/dev/ttyUSB0"
USE_NIX=0

usage() {
  cat <<'USAGE'
usage: ./build.sh [--nix] [--env <platformio-env>] [--port <serial-port>]

Prepare awtrix3 from wrapper sources and upload firmware.
This script does not upload LittleFS web UI assets.

Options:
  --nix                 Run PlatformIO upload inside nix-shell shell.nix.
  --env <name>          PlatformIO environment (default: awtrix2_upgrade).
  --port <path>         Serial upload port (default: /dev/ttyUSB0).
  -h, --help            Show this help.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --nix)
      USE_NIX=1
      shift
      ;;
    --env)
      [ "$#" -ge 2 ] || awtrix3_die "missing value for --env"
      ENV_NAME="$2"
      shift 2
      ;;
    --port)
      [ "$#" -ge 2 ] || awtrix3_die "missing value for --port"
      PORT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      awtrix3_die "unknown option: $1"
      ;;
  esac
done

echo "=== Step 0: Check local AWTRIX3 submodule ==="
awtrix3_check_submodule "$A3"
echo "  done"

echo "=== Step 1: Build web assets ==="
awtrix3_build_web "$DIR"
echo "  done"

echo "=== Step 2: Apply source patches ==="
awtrix3_apply_patches "$DIR" "$A3" \
  "$DIR/patches/002-webserver-auth.patch" \
  "$DIR/patches/003-servermanager-hooks.patch" \
  "$DIR/patches/004-displaymanager-install-helper.patch" \
  "$DIR/patches/006-displaymanager-flow-refresh-uninstall.patch" \
  "$DIR/patches/007-displaymanager-reenable-custom-apps.patch" \
  "$DIR/patches/010-displaymanager-reenable-existing-custom-apps.patch" \
  "$DIR/patches/008-awtrix2-trim-games-web.patch" \
  "$DIR/patches/009-awtrix2-trim-effects.patch"
echo "  done"

echo "=== Step 3: Copy wrapper-owned source ==="
awtrix3_copy_wrapper_source "$DIR" "$A3"
echo "  done"

echo "=== Step 4: Copy web UI ==="
awtrix3_copy_web_ui "$DIR" "$A3"
echo "  done"

echo "=== Step 5: Generate web assets ==="
awtrix3_embed_web_assets "$DIR" "$A3"
echo "  done"

echo "=== Step 6: Upload firmware ==="
awtrix3_platformio_upload "$DIR" "$A3" "$ENV_NAME" "$PORT" "$USE_NIX"
