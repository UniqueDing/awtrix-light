#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
python=${PYTHON:-python3}
exec "$python" "$root/tools/generate_animation_assets.py" "$@"
