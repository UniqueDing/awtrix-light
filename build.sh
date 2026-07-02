#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
A3="$DIR/awtrix3"
NIX="/home/uniqueding/.nix-profile/bin/nix-shell"

echo "=== Step 0: Build app.js ==="
/usr/bin/python3 build_app_js.py
echo "  done"

echo "=== Step 1: Apply patch ==="
mkdir -p "$A3/www" "$A3/tools" "$A3/www/src/app"
/usr/bin/patch -p1 -d "$A3" < "$DIR/awtrix3.patch"
echo "  done"

echo "=== Step 2: Build firmware ==="
cd "$A3"
$NIX --run "pio run -e awtrix2_upgrade -t upload --upload-port /dev/ttyUSB0"
