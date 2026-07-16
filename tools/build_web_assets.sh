#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

minify_css() {
  perl -0pe 's!/\*.*?\*/!!gs; s/\s+/ /g; s/\s*([{};,:])\s*/$1/g; s/^\s+|\s+$//g' "$1" > "$2"
}

print_built() {
  printf 'built %s (%s bytes)\n' "$1" "$(wc -c < "$1")"
}


validate_css_balanced() {
  python3 - "$@" <<'PY'
import sys
from pathlib import Path

failed = False
for name in sys.argv[1:]:
    css = Path(name).read_text()
    balance = 0
    line = 1
    column = 0
    for char in css:
        column += 1
        if char == '\n':
            line += 1
            column = 0
            continue
        if char == '{':
            balance += 1
        elif char == '}':
            balance -= 1
            if balance < 0:
                print(f"unbalanced css braces: {name}:{line}:{column}", file=sys.stderr)
                failed = True
                break
    if not failed and balance != 0:
        print(f"unbalanced css braces: {name} ({balance:+d})", file=sys.stderr)
        failed = True
if failed:
    sys.exit(1)
PY
}

build_app_js() {
  local js_dir="$ROOT/www/js"
  local i18n_json="$ROOT/www/i18n.json"
  local out="$ROOT/www/app.js.min"
  local tmp="$out.tmp"
  local first=1
  local files=(
    i18n-runtime.js
    state-i18n.js
    cast-bootstrap.js
    cast-labels.js
    cast-files-install.js
    settings-state.js
    settings-tabs-labels.js
    device-setting-groups.js
    legacy-setting-groups.js
    settings-tabs-render.js
    settings-field.js
    settings-render-wifi.js
    settings-render-about.js
    settings-load-save.js
    settings-collect.js
    legacy-save.js
    device-save.js
    runtime-transport.js
    cast-runtime.js
    cast-tools.js
    cast-preview.js
    cast-store-tab.js
    icon-state.js
    app-common.js
    app-store-core.js
    app-display-schema.js
    app-icons.js
    app-store-compat.js
    app-create-fields.js
    app-file-manager.js
    app-library.js
    app-settings-dialog.js
    app-uninstall.js
    app-store-render.js
    app-create-defaults.js
    app-create-form.js
    app-create-import.js
    app-create-save.js
    boot.js
  )

  [ -f "$i18n_json" ] || { printf 'missing: www/i18n.json\n' >&2; exit 1; }
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$i18n_json"

  for file in "${files[@]}"; do
    [ -f "$js_dir/$file" ] || { printf 'missing: %s\n' "$file" >&2; exit 1; }
  done

  : > "$tmp"
  printf 'const I = ' >> "$tmp"
  cat "$i18n_json" >> "$tmp"
  printf ';\n\n' >> "$tmp"
  for file in "${files[@]}"; do
    if [ "$first" -eq 0 ]; then
      printf '\n\n' >> "$tmp"
    fi
    first=0
    cat "$js_dir/$file" >> "$tmp"
  done

  npx terser "$tmp" --compress passes=3 --mangle --output "$out"
  rm -f "$tmp"
  print_built "$out"
}

build_app_css() {
  local css_dir="$ROOT/www/css"
  local out="$ROOT/www/app.css.min"
  local tmp="$out.tmp"
  local files=(base.css store.css library.css settings.css files.css cast.css)

  for file in "${files[@]}"; do
    [ -f "$css_dir/$file" ] || { printf 'missing: %s\n' "$file" >&2; exit 1; }
  done

  local css_paths=()
  for file in "${files[@]}"; do
    css_paths+=("$css_dir/$file")
  done
  validate_css_balanced "${css_paths[@]}"

  : > "$tmp"
  for file in "${files[@]}"; do
    printf '\n\n' >> "$tmp"
    cat "$css_dir/$file" >> "$tmp"
  done
  minify_css "$tmp" "$out"
  rm -f "$tmp"
  print_built "$out"
}

build_ap_wifi_assets() {
  local css_out="$ROOT/www/ap-wifi.css.min"
  local js_out="$ROOT/www/ap-wifi.js.min"

  minify_css "$ROOT/www/ap-wifi.css" "$css_out"
  npx terser "$ROOT/www/ap-wifi.js" --compress --mangle --output "$js_out"
  print_built "$css_out"
  print_built "$js_out"
}

build_assets() {
  build_app_js
  build_app_css
  build_ap_wifi_assets
}

embed_assets() {
  if [ "$#" -ne 1 ]; then
    printf 'usage: build_web_assets.sh embed <awtrix3-dir>\n' >&2
    exit 1
  fi

  local a3 html css js out tmp_html tmp_gz
  a3="$(cd "$1" && pwd)"
  html="$a3/www/app.html"
  css="$a3/www/app.css.min"
  js="$a3/www/app.js.min"
  out="$a3/src/web_assets.h"
  tmp_html="$(mktemp)"
  tmp_gz="$(mktemp)"

  perl -0pe '
    BEGIN {
      local $/;
      open my $css_fh, "<", $ARGV[0] or die "open css: $!";
      $css = <$css_fh>;
      close $css_fh;
      open my $js_fh, "<", $ARGV[1] or die "open js: $!";
      $js = <$js_fh>;
      close $js_fh;
      @ARGV = ($ARGV[2]);
    }
    s|<link rel="stylesheet" href="/www/app\.css\.min">|<style>$css</style>|;
    s|<script src="/www/app\.js\.min\?v=[^"]+"></script>|<script>$js</script>|;
    s|<script src="/www/app\.js\.min"></script>|<script>$js</script>|;
  ' "$css" "$js" "$html" > "$tmp_html"
  python3 - "$tmp_html" "$tmp_gz" <<'PY'
import sys
import zlib

data = open(sys.argv[1], "rb").read()
stream = zlib.compressobj(9, zlib.DEFLATED, 31, memLevel=6)
open(sys.argv[2], "wb").write(stream.compress(data) + stream.flush())
PY

  {
    printf '#pragma once\n#include <Arduino.h>\n\n'
    printf 'static const char app_html_content_type[] PROGMEM = "text/html; charset=utf-8";\n'
    printf 'static const uint8_t app_html_gz[] PROGMEM = {\n'
    od -An -tx1 -v "$tmp_gz" | while read -r line; do
      [ -z "$line" ] && continue
      printf '  '
       first=1
       for byte in $line; do
         if [ "$first" -eq 0 ]; then printf ', '; fi
         printf '0x%s' "$byte"
         first=0
       done
       printf ','
       printf '\n'
    done
    printf '};\n'
    printf 'static const size_t app_html_gz_len = sizeof(app_html_gz);\n'
  } > "$out"
  printf '  web_assets.h (%s bytes)\n' "$(wc -c < "$tmp_gz")"
  rm -f "$tmp_html" "$tmp_gz"
}

case "${1:-build}" in
  build)
    build_assets
    ;;
  embed)
    shift
    embed_assets "$@"
    ;;
  *)
    printf 'usage: build_web_assets.sh [build|embed <awtrix3-dir>]\n' >&2
    exit 1
    ;;
esac
