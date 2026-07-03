#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

A3="$DIR/awtrix3"
NIX="/home/uniqueding/.nix-profile/bin/nix-shell"

patch_already_applied() {
  case "$(basename "$1")" in
    002-webserver-auth.patch)
      grep -Fq '/api/auth/status' "$A3/lib/webserver/esp-fs-webserver.cpp"
      ;;
    003-servermanager-hooks.patch)
      grep -Fq '#include "AwtrixLightWeb.h"' "$A3/src/ServerManager.cpp" && \
        grep -Fq 'setupAwtrixLightWebRoutes(mws);' "$A3/src/ServerManager.cpp" && \
        grep -Fq 'setAwtrixLightRuntimeButton(btn, state);' "$A3/src/ServerManager.cpp"
      ;;
    *)
      return 1
      ;;
  esac
}

echo "=== Step 0: Check local AWTRIX3 submodule ==="
if [ ! -d "$A3" ]; then
  echo "missing local submodule: $A3" >&2
  echo "initialize it once before building: git submodule update --init awtrix3" >&2
  exit 1
fi
echo "  done"

echo "=== Step 1: Build app.js ==="
"$DIR/tools/build_app_js.sh"
echo "  done"

echo "=== Step 2: Apply source patches ==="
for patch_file in \
  "$DIR/patches/002-webserver-auth.patch" \
  "$DIR/patches/003-servermanager-hooks.patch"; do
  if patch_already_applied "$patch_file"; then
    echo "  already applied: $(basename "$patch_file")"
  elif /usr/bin/patch --dry-run -p1 -d "$A3" < "$patch_file" >/dev/null 2>&1; then
    /usr/bin/patch -p1 -d "$A3" < "$patch_file"
  else
    echo "failed to apply patch: $patch_file" >&2
    exit 1
  fi
done
echo "  done"

echo "=== Step 3: Copy wrapper-owned source ==="
rm -f "$A3/src/AppStore.cpp" "$A3/src/AppStore.h"
cp -a "$DIR/src/." "$A3/src/"
echo "  done"

echo "=== Step 4: Copy web UI ==="
rm -rf "$A3/www"
mkdir -p "$A3/www"
cp -a "$DIR/www/." "$A3/www/"
echo "  done"

echo "=== Step 5: Generate web assets ==="
"$DIR/tools/embed_web_assets.sh" "$A3"
echo "  done"

echo "=== Step 6: Build firmware ==="
cd "$A3"
$NIX "$DIR/shell.nix" --run "pio run -e awtrix2_upgrade -t upload --upload-port /dev/ttyUSB0"
