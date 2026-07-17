#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWTRIX3_DIR="$ROOT/awtrix3"
DIST_DIR="${DIST_DIR:-$ROOT/dist/release}"
MAX_FIRMWARE_BYTES=1310720
TARGETS=(ulanzi awtrix2_upgrade)

usage() {
  cat <<'USAGE'
usage: tools/release_firmware.sh --tag vMAJOR.MINOR.PATCH-light [--dist <directory>]

Build, stage, and validate dual-target AWTRIX Light release artifacts locally.
This command does not flash devices or create, push, tag, upload, or publish releases.
USAGE
}

die() {
  printf 'release validation: %s\n' "$*" >&2
  exit 1
}

TAG=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --tag)
      [ "$#" -ge 2 ] || die 'missing value for --tag'
      TAG="$2"
      shift 2
      ;;
    --dist)
      [ "$#" -ge 2 ] || die 'missing value for --dist'
      DIST_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

[ -n "$TAG" ] || die '--tag is required'
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-light$ ]]; then
  die "tag must match vMAJOR.MINOR.PATCH-light: $TAG"
fi
VERSION="${TAG#v}"

parent_version_file="$AWTRIX3_DIR/version"
[ -f "$parent_version_file" ] || die "missing parent version file: $parent_version_file"
PARENT_VERSION="$(tr -d '\r\n' < "$parent_version_file")"
[ "$PARENT_VERSION" = "$VERSION" ] || die "tag version $VERSION does not match parent version $PARENT_VERSION"

. "$ROOT/tools/awtrix3_build_lib.sh"
awtrix3_check_submodule "$AWTRIX3_DIR"

printf '%s\n' '=== Build web assets ==='
awtrix3_build_web "$ROOT"
printf '%s\n' '=== Apply source patches ==='
awtrix3_apply_patches "$ROOT" "$AWTRIX3_DIR" \
  "$ROOT/patches/002-webserver-auth.patch" \
  "$ROOT/patches/003-servermanager-hooks.patch" \
  "$ROOT/patches/004-displaymanager-install-helper.patch" \
  "$ROOT/patches/006-displaymanager-flow-refresh-uninstall.patch" \
  "$ROOT/patches/007-displaymanager-reenable-custom-apps.patch" \
  "$ROOT/patches/010-displaymanager-reenable-existing-custom-apps.patch" \
  "$ROOT/patches/008-awtrix2-trim-games-web.patch" \
  "$ROOT/patches/009-awtrix2-trim-effects.patch" \
  "$ROOT/patches/011-runtime-display-ownership.patch" \
  "$ROOT/patches/012-runtime-websockets-platformio.patch" \
  "$ROOT/patches/013-webserver-upload-handler.patch"
printf '%s\n' '=== Copy wrapper source and web UI ==='
awtrix3_copy_wrapper_source "$ROOT" "$AWTRIX3_DIR"
awtrix3_copy_web_ui "$ROOT" "$AWTRIX3_DIR"
awtrix3_embed_web_assets "$ROOT" "$AWTRIX3_DIR"

COMPILED_VERSION="$(python3 - "$AWTRIX3_DIR/src/Globals.cpp" <<'PY'
import re
import sys

source = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r'const char \*VERSION\s*=\s*"([^"]+)"\s*;', source)
if not match:
    raise SystemExit("compiled VERSION declaration not found")
print(match.group(1))
PY
)"
[ "$COMPILED_VERSION" = "$VERSION" ] || die "tag version $VERSION does not match compiled version $COMPILED_VERSION"

for target in "${TARGETS[@]}"; do
  printf '=== Build %s ===\n' "$target"
  (cd "$AWTRIX3_DIR" && nix-shell "$ROOT/shell.nix" --run "platformio run -e $target")
done

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

for target in "${TARGETS[@]}"; do
  source_image="$AWTRIX3_DIR/.pio/build/$target/firmware.bin"
  [ -f "$source_image" ] || die "missing firmware image: $source_image"
  image_size="$(stat -c '%s' "$source_image")"
  [ "$image_size" -le "$MAX_FIRMWARE_BYTES" ] || die "$target firmware is $image_size bytes, exceeds $MAX_FIRMWARE_BYTES"

  artifact_target="${target/_/-}"
  artifact="awtrix-light-$VERSION-$artifact_target.bin"
  cp "$source_image" "$DIST_DIR/$artifact"
  (cd "$DIST_DIR" && sha256sum "$artifact" > "$artifact.sha256")
done

python3 - "$DIST_DIR" "$VERSION" "$MAX_FIRMWARE_BYTES" <<'PY'
import hashlib
import json
import re
import sys
from pathlib import Path

dist_dir = Path(sys.argv[1])
version = sys.argv[2]
max_firmware_bytes = int(sys.argv[3])
targets = (
    ("ulanzi", f"awtrix-light-{version}-ulanzi.bin"),
    ("awtrix2_upgrade", f"awtrix-light-{version}-awtrix2-upgrade.bin"),
)
manifest_targets = []
for target, filename in targets:
    artifact = dist_dir / filename
    checksum_file = dist_dir / f"{filename}.sha256"
    if not artifact.is_file():
        raise SystemExit(f"missing staged artifact: {artifact}")
    size = artifact.stat().st_size
    if size == 0 or size > max_firmware_bytes:
        raise SystemExit(f"oversized staged artifact: {artifact}")
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    expected_checksum = f"{digest}  {filename}\n"
    if not checksum_file.is_file() or checksum_file.read_text(encoding="ascii") != expected_checksum:
        raise SystemExit(f"invalid checksum: {checksum_file}")
    manifest_targets.append({"target": target, "asset": filename, "size": size, "sha256": digest})

manifest = {"schema": 1, "family": "awtrix-light", "version": version, "targets": manifest_targets}
(dist_dir / "ota-manifest.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")

loaded = json.loads((dist_dir / "ota-manifest.json").read_text(encoding="utf-8"))
if loaded != manifest or set(loaded) != {"schema", "family", "version", "targets"}:
    raise SystemExit("invalid OTA manifest schema")
if not re.fullmatch(r"\d+\.\d+\.\d+-light", loaded["version"]):
    raise SystemExit("invalid OTA manifest version")
for target in loaded["targets"]:
    if set(target) != {"target", "asset", "size", "sha256"}:
        raise SystemExit("invalid OTA target schema")
    if not isinstance(target["size"], int) or target["size"] <= 0 or target["size"] > max_firmware_bytes:
        raise SystemExit("invalid OTA target size")
    if not re.fullmatch(r"[0-9a-f]{64}", target["sha256"]):
        raise SystemExit("invalid OTA target checksum")
PY

printf 'release artifacts staged and validated in %s\n' "$DIST_DIR"
