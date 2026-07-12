#!/usr/bin/env bash

awtrix3_die() {
  printf '%s\n' "$*" >&2
  exit 1
}

awtrix3_patch_already_applied() {
  local patch_file="$1"
  local awtrix3_dir="$2"

  case "$(basename "$patch_file")" in
    002-webserver-auth.patch)
      grep -Fq '/api/auth/status' "$awtrix3_dir/lib/webserver/esp-fs-webserver.cpp"
      ;;
    003-servermanager-hooks.patch)
      grep -Fq '#include "AwtrixLightWeb.h"' "$awtrix3_dir/src/ServerManager.cpp" && \
        grep -Fq 'setupAwtrixLightWebRoutes(mws);' "$awtrix3_dir/src/ServerManager.cpp" && \
        grep -Fq 'setAwtrixLightRuntimeButton(btn, state);' "$awtrix3_dir/src/ServerManager.cpp"
      ;;
    004-displaymanager-install-helper.patch)
      grep -Fq 'enum CustomAppInstallResult' "$awtrix3_dir/src/DisplayManager.h" && \
        grep -Fq 'installCustomAppFromJson' "$awtrix3_dir/src/DisplayManager.cpp"
      ;;
    006-displaymanager-flow-refresh-uninstall.patch)
      grep -Fq 'refreshFlowApp' "$awtrix3_dir/src/DisplayManager.h" && \
        grep -Fq 'uninstallCustomApp' "$awtrix3_dir/src/DisplayManager.h" && \
        grep -Fq 'DisplayManager_::refreshFlowApp' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'DisplayManager_::uninstallCustomApp' "$awtrix3_dir/src/DisplayManager.cpp"
      ;;
    007-displaymanager-reenable-custom-apps.patch)
      grep -Fq 'pushCustomApp(appName, position);' "$awtrix3_dir/src/DisplayManager.cpp"
      ;;
    010-displaymanager-reenable-existing-custom-apps.patch)
      grep -Fq 'existingApp != Apps.end()' "$awtrix3_dir/src/DisplayManager.cpp"
      ;;
    008-awtrix2-trim-games-web.patch)
      grep -Fq -- '-<Games/*>' "$awtrix3_dir/platformio.ini" && \
        grep -Fq '#ifndef awtrix2_upgrade' "$awtrix3_dir/src/DisplayManager.cpp" && \
        grep -Fq 'while (currentClient.available())' "$awtrix3_dir/src/ServerManager.cpp"
      ;;
    009-awtrix2-trim-effects.patch)
      grep -Fq -- '-<effects.cpp>' "$awtrix3_dir/platformio.ini" && \
        grep -Fq 'const int numOfEffects = 0;' "$awtrix3_dir/src/effects.h"
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
    if awtrix3_patch_already_applied "$patch_file" "$awtrix3_dir"; then
      printf '  already applied: %s\n' "$(basename "$patch_file")"
    elif [ "$(basename "$patch_file")" = "008-awtrix2-trim-games-web.patch" ] || [ "$(basename "$patch_file")" = "009-awtrix2-trim-effects.patch" ]; then
      local awtrix3_rel="${awtrix3_dir#$root/}"
      if (cd "$root" && git apply --check --ignore-whitespace --directory="$awtrix3_rel" "$patch_file"); then
        (cd "$root" && git apply --ignore-whitespace --directory="$awtrix3_rel" "$patch_file")
      else
        awtrix3_die "failed to apply patch: $patch_file"
      fi
    elif /usr/bin/patch --dry-run -p1 -d "$awtrix3_dir" < "$patch_file" >/dev/null 2>&1; then
      /usr/bin/patch -p1 -d "$awtrix3_dir" < "$patch_file"
    else
      awtrix3_die "failed to apply patch: $patch_file"
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
