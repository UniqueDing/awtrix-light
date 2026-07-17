#!/usr/bin/env python3

from pathlib import Path


root = Path(__file__).resolve().parents[1]
workflow = (root / ".github/workflows/release-firmware.yml").read_text()
tool = (root / "tools/release_firmware.sh").read_text()

assert "tags:" in workflow
assert "- 'v*'" in workflow
assert "workflow_dispatch:" in workflow
assert "tag:" in workflow
assert '[[ "$RELEASE_TAG" =~ ^v[0-9]+\\.[0-9]+\\.[0-9]+-light$ ]]' in workflow
assert "ref: ${{ env.RELEASE_TAG }}" in workflow
assert "contents: write" in workflow
assert "git submodule update --init awtrix3" in workflow
assert "--recursive" not in workflow
assert workflow.index("python3 tests/ota_release_contract_test.py") < workflow.index("python3 tests/ota_routes_test.py")
assert workflow.index("python3 tests/ota_routes_test.py") < workflow.index("python3 tests/release_firmware_contract_test.py")
assert "tools/release_firmware.sh --tag" in workflow
assert "gh release create" in workflow
assert "GITHUB_TOKEN:" in workflow
assert "--repo uniqueding/awtrix-light" in workflow
assert "dist/release/*" in workflow

assert '[[ ! "$TAG" =~ ^v[0-9]+\\.[0-9]+\\.[0-9]+-light$ ]]' in tool
assert 'VERSION="${TAG#v}"' in tool
assert 'parent_version_file="$AWTRIX3_DIR/version"' in tool
assert 'COMPILED_VERSION=' in tool
assert 'awtrix3_build_web "$ROOT"' in tool
assert 'awtrix3_apply_patches "$ROOT" "$AWTRIX3_DIR"' in tool
assert 'awtrix3_copy_wrapper_source "$ROOT" "$AWTRIX3_DIR"' in tool
assert 'awtrix3_copy_web_ui "$ROOT" "$AWTRIX3_DIR"' in tool
assert 'awtrix3_embed_web_assets "$ROOT" "$AWTRIX3_DIR"' in tool
for patch in (
    "002-webserver-auth.patch",
    "003-servermanager-hooks.patch",
    "004-displaymanager-install-helper.patch",
    "006-displaymanager-flow-refresh-uninstall.patch",
    "007-displaymanager-reenable-custom-apps.patch",
    "010-displaymanager-reenable-existing-custom-apps.patch",
    "008-awtrix2-trim-games-web.patch",
    "009-awtrix2-trim-effects.patch",
    "011-runtime-display-ownership.patch",
    "012-runtime-websockets-platformio.patch",
):
    assert patch in tool
assert 'TARGETS=(ulanzi awtrix2_upgrade)' in tool
assert 'nix-shell "$ROOT/shell.nix" --run "platformio run -e $target"' in tool
assert 'MAX_FIRMWARE_BYTES=1310720' in tool
assert 'stat -c \'%s\' "$source_image"' in tool
assert 'artifact="awtrix-light-$VERSION-$artifact_target.bin"' in tool
assert 'sha256sum "$artifact" > "$artifact.sha256"' in tool
assert '"schema": 1, "family": "awtrix-light", "version": version, "targets": manifest_targets' in tool
assert '"target": target, "asset": filename, "size": size, "sha256": digest' in tool
assert 'set(target) != {"target", "asset", "size", "sha256"}' in tool
assert 'not isinstance(target["size"], int) or target["size"] <= 0 or target["size"] > max_firmware_bytes' in tool
assert '"url"' not in tool
assert "git tag" not in tool
assert "git push" not in tool
assert "gh release" not in tool
assert "platformio run -e $target -t upload" not in tool

print("release firmware contract: ok")
