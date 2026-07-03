#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JS_DIR="$ROOT/www/js"
OUT="$ROOT/www/app.js"

files=(
  i18n.js
  state-i18n.js
  app-uninstall.js
  cast-labels.js
  cast-files-install.js
  settings-state.js
  settings-tabs-labels.js
  device-setting-groups.js
  legacy-setting-groups.js
  settings-tabs-render.js
  settings-field.js
  settings-render-wifi.js
  settings-load-save.js
  settings-collect.js
  legacy-save.js
  device-save.js
  cast-runtime-preview-bootstrap.js
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
