#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
A3="$DIR/awtrix3"
NIX="/home/uniqueding/.nix-profile/bin/nix-shell"

echo "=== Step 0: Init submodule ==="
/usr/bin/git submodule update --init
echo "  done"

echo "=== Step 1: Build app.js ==="
/usr/bin/python3 build_app_js.py
echo "  done"

echo "=== Step 2: Apply patches ==="
/usr/bin/patch -p1 -d "$A3" < "$DIR/awtrix3.patch"
cp "$DIR/www/icon.png" "$A3/www/icon.png"
echo "  done"

echo "=== Step 3: Gen web_assets.h ==="
/usr/bin/python3 << 'PYEOF'
import gzip
from pathlib import Path
A3 = Path('/home/uniqueding/Workspace/awtrix-light/awtrix3')
html = (A3 / 'www/app.html').read_bytes()
css = (A3 / 'www/app.css').read_bytes()
js = (A3 / 'www/app.js').read_bytes()
combined = html.replace(b'<link rel="stylesheet" href="/www/app.css">', b'<style>' + css + b'</style>')
combined = combined.replace(b'<script src="/www/app.js"></script>', b'<script>' + js + b'</script>')
gz = gzip.compress(combined, compresslevel=9, mtime=0)
def bl(d):
    return '\n'.join(['  ' + ', '.join(f'0x{b:02x}' for b in d[i:i+16]) + ',' for i in range(0, len(d), 16)])
(A3 / 'src/web_assets.h').write_text(
    '#pragma once\n#include <Arduino.h>\n\n'
    'static const char app_html_content_type[] PROGMEM = "text/html; charset=utf-8";\n'
    'static const uint8_t app_html_gz[] PROGMEM = {\n' + bl(gz) + '\n};\n'
    'static const size_t app_html_gz_len = sizeof(app_html_gz);\n')
print(f'  web_assets.h ({len(gz)} bytes)')
PYEOF
echo "  done"

echo "=== Step 4: Build firmware ==="
cd "$A3"
$NIX --run "pio run -e awtrix2_upgrade -t upload --upload-port /dev/ttyUSB0"
