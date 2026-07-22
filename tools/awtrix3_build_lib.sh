#!/usr/bin/env bash

awtrix3_die() {
  printf '%s\n' "$*" >&2
  exit 1
}

awtrix3_patch_already_applied() {
  local patch_file="$1"
  local awtrix3_dir="$2"

  case "$(basename "$patch_file")" in
    014-awtrix-light-upstream-overlay.patch)
      grep -Fq 'String flowApplyInputs(JsonObject doc, String value)' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'void fetchFlowHttpSource(JsonObject app, JsonObject source, DynamicJsonDocument &sourceValues)' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'void fetchFlowHaSource(JsonObject app, JsonObject source, DynamicJsonDocument &sourceValues)' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'uint32_t flowRefreshInterval(JsonObject doc)' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'uint32_t flowRefreshInterval = 0;' "$awtrix3_dir/src/Apps.h" && \
        grep -Fq 'ca->flowRefreshInterval' "$awtrix3_dir/src/Apps.cpp" && \
        grep -Fq 'extern String HA_BASE_URL;' "$awtrix3_dir/src/Globals.h" && \
        grep -Fq 'extern String HA_TOKEN;' "$awtrix3_dir/src/Globals.h" && \
        grep -Fq 'HA_BASE_URL = doc["ha_base_url"].as<String>();' "$awtrix3_dir/src/Globals.cpp" && \
        grep -Fq 'HA_TOKEN = doc["ha_token"].as<String>();' "$awtrix3_dir/src/Globals.cpp" && \
        grep -Fq 'String HA_BASE_URL = "";' "$awtrix3_dir/src/Globals.cpp" && \
        grep -Fq 'String HA_TOKEN = "";' "$awtrix3_dir/src/Globals.cpp" && \
        grep -Fq 'void addHandler(const Uri &uri, HTTPMethod method, WebServerClass::THandlerFunction fn, WebServerClass::THandlerFunction uploadFn);' "$awtrix3_dir/lib/webserver/esp-fs-webserver.h" && \
        grep -Fq 'webserver->on(uri, method, authMiddleware(fn), authMiddleware(uploadFn));' "$awtrix3_dir/lib/webserver/esp-fs-webserver.cpp" && \
        grep -Fq 'if (filename.indexOf("..") != -1)' "$awtrix3_dir/lib/webserver/esp-fs-webserver.cpp" && \
        grep -Fq "if (filename.indexOf('\\\\') != -1)" "$awtrix3_dir/lib/webserver/esp-fs-webserver.cpp" && \
        grep -Fq 'if (!m_filesystem->remove(path))' "$awtrix3_dir/lib/webserver/esp-fs-webserver.cpp" && \
        grep -Fq '"version": "0.98.1-light"' "$awtrix3_dir/docs/ulanzi_flasher/firmware/manifest.json" && \
        grep -Fq 'src_filter = +<*> -<Games/*> -<effects.cpp>' "$awtrix3_dir/platformio.ini" && \
        grep -Fq 'const int numOfEffects = 0;' "$awtrix3_dir/src/effects.h" && \
        [ ! -e "$awtrix3_dir/src/Games/AwtrixSays.cpp" ] && \
        [ ! -e "$awtrix3_dir/src/Games/AwtrixSays.h" ] && \
        [ ! -e "$awtrix3_dir/src/Games/SlotMachine.cpp" ] && \
        [ ! -e "$awtrix3_dir/src/Games/SlotMachine.h" ] && \
        grep -Fq 'void GameManager_::setup() {}' "$awtrix3_dir/src/Games/GameManager.cpp" && \
        grep -Fq 'void GameManager_::sendPoints(int) {}' "$awtrix3_dir/src/Games/GameManager.cpp" && \
        grep -Fq 'setAwtrixLightRuntimeButton(0, false);' "$awtrix3_dir/src/PeripheryManager.cpp" && \
        grep -Fq 'setAwtrixLightRuntimeButton(2, false);' "$awtrix3_dir/src/PeripheryManager.cpp" && \
        grep -Fq 'if (existingApp != Apps.end())' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'bool isCustomAppOrChild(const String &candidate, const String &name)' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq "if (candidate[i] < '0' || candidate[i] > '9')" "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'bool removeCustomAppFromApps(const String &name, bool setApps)' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'return deleteCustomAppFile(name);' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'return removeCustomAppFromApps(name, true);' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'ui->closeGifFile(&app.icon);' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'void MatrixDisplayUi::closeGifFile(File *file)' "$awtrix3_dir/src/MatrixDisplayUi.cpp" && \
        grep -Fq 'if (LittleFS.exists("/CUSTOMAPPS/" + name + ".json"))' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'bool validGif = false;' "$awtrix3_dir/src/GifPlayer.h" && \
        grep -Fq 'keyFrame = true;' "$awtrix3_dir/src/GifPlayer.h" && \
        grep -Fq 'tbiWidth > WIDTH - tbiImageX || tbiHeight > HEIGHT - tbiImageY' "$awtrix3_dir/src/GifPlayer.h" && \
        grep -Fq 'if (lzwDataOffset >= lzwDataSize)' "$awtrix3_dir/src/GifPlayer.h" && \
        grep -Fq 'if (pixel >= colorCount)' "$awtrix3_dir/src/GifPlayer.h" && \
        grep -Fq 'void closeFile(File *imageFile)' "$awtrix3_dir/src/GifPlayer.h" && \
        grep -Fq 'void DisplayManager_::showRuntime()' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'uint32_t DisplayManager_::runtimeSequence() const' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'void showRuntime();' "$awtrix3_dir/src/DisplayManager.h" && \
        grep -Fq 'uint32_t runtimeSequence() const;' "$awtrix3_dir/src/DisplayManager.h"
      ;;
    *)
      return 1
      ;;
  esac
}

awtrix3_check_submodule() {
  local awtrix3_dir="$1"
  if [ ! -d "$awtrix3_dir" ]; then
    awtrix3_die "missing local submodule: $awtrix3_dir
initialize it once before building: git submodule update --init awtrix3"
  fi
}

awtrix3_build_web() {
  local root="$1"
  "$root/tools/build_web_assets.sh" build
}

awtrix3_apply_patches() {
  local root="$1"
  local awtrix3_dir="$2"
  shift 2

  local patch_file
  for patch_file in "$@"; do
    [ "$(basename "$patch_file")" = "014-awtrix-light-upstream-overlay.patch" ] || \
      awtrix3_die "unsupported AWTRIX3 patch input: $patch_file"

    if awtrix3_patch_already_applied "$patch_file" "$awtrix3_dir"; then
      printf '  already applied: %s\n' "$(basename "$patch_file")"
    else
      local awtrix3_rel="${awtrix3_dir#"$root"}"
      awtrix3_rel="${awtrix3_rel#/}"
      if ! (cd "$root" && git apply --check --recount --ignore-whitespace --directory="$awtrix3_rel" "$patch_file"); then
        awtrix3_die "failed to apply patch: $patch_file"
      fi
      (cd "$root" && git apply --recount --ignore-whitespace --directory="$awtrix3_rel" "$patch_file") || \
        awtrix3_die "failed to apply patch: $patch_file"
      awtrix3_patch_already_applied "$patch_file" "$awtrix3_dir" || \
        awtrix3_die "patch markers missing after apply: $patch_file"
    fi
  done
}

awtrix3_copy_wrapper_source() {
  local root="$1"
  local awtrix3_dir="$2"
  rm -f "$awtrix3_dir/src/AppStore.cpp" "$awtrix3_dir/src/AppStore.h"
  cp -a "$root/src/." "$awtrix3_dir/src/"
}

awtrix3_copy_web_ui() {
  local root="$1"
  local awtrix3_dir="$2"
  local file
  local web_files=(
    ap-wifi.css.min
    ap-wifi.html
    ap-wifi.js.min
    app.css.min
    app.html
    app.js.min
    icon.png
  )

  rm -rf "$awtrix3_dir/www"
  mkdir -p "$awtrix3_dir/www"
  for file in "${web_files[@]}"; do
    [ -f "$root/www/$file" ] || awtrix3_die "missing web asset: $root/www/$file"
    cp -a "$root/www/$file" "$awtrix3_dir/www/$file"
  done
}

awtrix3_embed_web_assets() {
  local root="$1"
  local awtrix3_dir="$2"
  "$root/tools/build_web_assets.sh" embed "$awtrix3_dir"
}

awtrix3_apply_version() {
  local root="$1"
  local awtrix3_dir="$2"

  python3 - "$root/version" "$awtrix3_dir/version" "$awtrix3_dir/src/Globals.cpp" <<'PY'
import re
import sys
from pathlib import Path

parent_version_path = Path(sys.argv[1])
awtrix3_version_path = Path(sys.argv[2])
globals_path = Path(sys.argv[3])

if not parent_version_path.is_file():
    raise SystemExit(f"missing parent version file: {parent_version_path}")

version = parent_version_path.read_text(encoding="utf-8").rstrip("\r\n")
if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+-light", version):
    raise SystemExit(f"invalid parent version: {version!r}")

source = globals_path.read_text(encoding="utf-8")
declaration = re.compile(
    r'^(?P<prefix>[ \t]*const[ \t]+char[ \t]*\*[ \t]*VERSION[ \t]*=[ \t]*")'
    r'[^"\r\n]*(?P<suffix>"[ \t]*;[ \t]*)$',
    re.MULTILINE,
)
updated_source, replacements = declaration.subn(
    lambda match: f'{match.group("prefix")}{version}{match.group("suffix")}',
    source,
)
if replacements != 1:
    raise SystemExit(f"expected exactly one compiled VERSION declaration, found {replacements}")

globals_path.write_text(updated_source, encoding="utf-8")
awtrix3_version_path.write_text(f"{version}\n", encoding="utf-8")
PY
}

awtrix3_platformio_upload() {
  local root="$1"
  local awtrix3_dir="$2"
  local env_name="$3"
  local port="$4"
  local use_nix="$5"

  if [ "$use_nix" -eq 1 ]; then
    (cd "$awtrix3_dir" && nix-shell "$root/shell.nix" --run "platformio run -e $env_name -t upload --upload-port $port")
  else
    (cd "$awtrix3_dir" && platformio run -e "$env_name" -t upload --upload-port "$port")
  fi
}
