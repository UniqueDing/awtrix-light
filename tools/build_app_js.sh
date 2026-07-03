#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JS_DIR="$ROOT/www/src/app"
OUT="$ROOT/www/app.js"

files=(
  00-state-i18n.js
  01-app-uninstall.js
  02-cast-labels.js
  03-cast-files-install.js
  04-settings-state.js
  05-settings-tabs-labels.js
  06-device-setting-groups.js
  07-legacy-setting-groups.js
  08-settings-tabs-render.js
  09-settings-field.js
  10-settings-render-wifi.js
  11-settings-load-save.js
  12-settings-collect.js
  13-legacy-save.js
  14-device-save.js
  15-cast-runtime-preview-bootstrap.js
)

for file in "${files[@]}"; do
  if [ ! -f "$JS_DIR/$file" ]; then
    echo "missing: $file" >&2
    exit 1
  fi
done

: > "$OUT"
first=1
for file in "${files[@]}"; do
  if [ "$first" -eq 0 ]; then
    printf '\n\n' >> "$OUT"
  fi
  first=0
  cat "$JS_DIR/$file" >> "$OUT"
done

printf 'built %s (%s bytes)\n' "$OUT" "$(wc -c < "$OUT")"
