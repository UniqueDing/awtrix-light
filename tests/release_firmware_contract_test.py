#!/usr/bin/env python3

from pathlib import Path
import io
import re
import subprocess
import tarfile
import tempfile


root = Path(__file__).resolve().parents[1]
workflow = (root / ".github/workflows/release-firmware.yml").read_text()
tool = (root / "tools/release_firmware.sh").read_text()
build_lib = (root / "tools/awtrix3_build_lib.sh").read_text()
local_build = (root / "build.sh").read_text()
gitmodules = (root / ".gitmodules").read_text()
overlay_patch_path = root / "patches/014-awtrix-light-upstream-overlay.patch"
overlay_patch = overlay_patch_path.read_text()
server_manager = (root / "src/ServerManager.cpp").read_text()
update_manager = (root / "src/UpdateManager.cpp").read_text()
validation, publishing = workflow.split("  publishing:\n", 1)
platformio_version = "6.1.18"  # Pinned release used with the workflow's Python 3.13 toolchain.
platformio_install = f"python3 -m pip install --disable-pip-version-check platformio=={platformio_version}"

gitlink = subprocess.run(
    ["git", "ls-files", "--stage", "awtrix3"],
    cwd=root,
    check=True,
    capture_output=True,
    text=True,
).stdout.split()
assert gitlink == ["160000", "723e8c7a44ea70ac661217be0674b743d212317c", "0", "awtrix3"]
assert 'url = https://github.com/Blueforcer/awtrix3.git' in gitmodules
assert (root / "version").read_bytes() == b"0.98.1-light\n"

assert "tags:" in workflow
assert "- 'v*'" in workflow
assert "branches:" in workflow
assert "- '**'" in workflow
assert "workflow_dispatch:" in workflow
assert "tag:" in workflow
assert "required: true" in workflow
assert "validation:" in workflow
assert "publishing:" in workflow
assert "needs: validation" in workflow
assert "permissions:\n      contents: write" not in workflow[: workflow.index("jobs:")]
assert "permissions:\n      contents: read" in validation
assert "contents: write" not in validation
assert "permissions:\n      contents: write" in publishing
assert "contents: read" not in publishing
assert "github.event_name == 'workflow_dispatch' || (github.event_name == 'push' && github.ref_type == 'tag')" in publishing
assert "github.event_name == 'push' && github.ref_type == 'branch' && github.sha" in validation
assert "github.event_name == 'workflow_dispatch' && inputs.tag || github.ref_name" in validation
assert "awtrix3/version" not in validation
assert "tr -d '\\r\\n' < version" in validation
assert 'RELEASE_TAG="v$(tr -d \'\\r\\n\' < version)"' in validation
assert '[[ "$RELEASE_TAG" =~ ^v[0-9]+\\.[0-9]+\\.[0-9]+-light$ ]]' in validation
assert validation.index("git submodule update --init awtrix3") < validation.index("tr -d '\\r\\n' < version")
assert "git submodule update --init awtrix3" in validation
assert "--recursive" not in workflow
assert "actions/setup-node@v4" in validation
assert "node-version: '22'" in validation
assert "actions/setup-python@v5" in validation
assert "python-version: '3.13'" in validation
assert validation.count(platformio_install) == 1
assert "animation-assets-requirements.txt" not in workflow
test_commands = (
    "node tests/app_localization_test.js",
    "node tests/runtime_transport_test.js",
    "node tests/cast_tools_stopwatch_test.js",
    "python3 tests/runtime_protocol_fixture.py",
    "python3 tests/integrations_test_routes.py",
    "python3 tests/custom_app_uninstall_contract_test.py",
    "python3 tests/discovery_regression_test.py",
    "python3 tests/animation_assets_test.py",
    "python3 tests/ota_release_contract_test.py",
    "python3 tests/ota_routes_test.py",
    "python3 tests/release_firmware_contract_test.py",
)
test_positions = [validation.index(command) for command in test_commands]
assert test_positions == sorted(test_positions)
assert validation.index("python-version: '3.13'") < validation.index(platformio_install)
assert validation.index(platformio_install) < test_positions[0]
for forbidden_nix_dependency in ("install-nix-action", "nix-shell", "NIX_PATH", "<nixpkgs>"):
    assert forbidden_nix_dependency not in workflow
    assert forbidden_nix_dependency not in tool
assert "tools/release_firmware.sh --tag" in validation
assert "actions/upload-artifact@v4" in validation
assert "name: release-firmware" in validation
assert "path: dist/release" in validation
assert "gh release create" not in validation
assert "actions/download-artifact@v4" in publishing
assert "name: release-firmware" in publishing
assert "path: dist/release" in publishing
assert "gh release create" in publishing
assert "GITHUB_TOKEN:" in publishing
assert "--repo uniqueding/awtrix-light" in publishing
assert "dist/release/*" in publishing

assert '[[ ! "$TAG" =~ ^v[0-9]+\\.[0-9]+\\.[0-9]+-light$ ]]' in tool
assert 'VERSION="${TAG#v}"' in tool
assert 'parent_version_file="$ROOT/version"' in tool
assert 'parent_version_file="$AWTRIX3_DIR/version"' not in tool
assert '[[ "$PARENT_VERSION" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+-light$ ]]' in tool
assert 'COMPILED_VERSION=' in tool
assert 'awtrix3_build_web "$ROOT"' in tool
assert 'awtrix3_apply_patches "$ROOT" "$AWTRIX3_DIR"' in tool
assert 'awtrix3_copy_wrapper_source "$ROOT" "$AWTRIX3_DIR"' in tool
assert 'awtrix3_copy_web_ui "$ROOT" "$AWTRIX3_DIR"' in tool
assert 'awtrix3_embed_web_assets "$ROOT" "$AWTRIX3_DIR"' in tool
assert 'awtrix3_apply_version "$ROOT" "$AWTRIX3_DIR"' in tool
assert 'awtrix3_apply_version "$DIR" "$A3"' in local_build
assert (root / "shell.nix").is_file()
assert "usage: ./build.sh [--nix]" in local_build
assert 'nix-shell "$root/shell.nix"' in build_lib
assert 'platformio run -e "$env_name" -t upload' in build_lib
assert 'version = parent_version_path.read_text(encoding="utf-8").rstrip("\\r\\n")' in build_lib
assert 're.fullmatch(r"[0-9]+\\.[0-9]+\\.[0-9]+-light", version)' in build_lib
assert 'if replacements != 1:' in build_lib
assert 'globals_path.write_text(updated_source, encoding="utf-8")' in build_lib
assert 'awtrix3_version_path.write_text(f"{version}\\n", encoding="utf-8")' in build_lib
assert 'git apply --check --recount --ignore-whitespace' in build_lib
assert 'git apply --recount --ignore-whitespace' in build_lib
assert 'awtrix3_die "failed to apply patch: $patch_file"' in build_lib
assert 'awtrix3_die "patch markers missing after apply: $patch_file"' in build_lib
assert '/usr/bin/patch' not in build_lib
assert '-F 3' not in build_lib
assert '006-displaymanager-flow-refresh-uninstall.patch' not in build_lib
assert 'expected exactly one custom app install anchor' not in build_lib
assert 'expected exactly one custom app declaration anchor' not in build_lib
assert 'cp -a "$root/src/." "$awtrix3_dir/src/"' in build_lib
assert (root / "src/UpdateManager.cpp").is_file()
assert (root / "src/UpdateManager.h").is_file()
assert tool.count("014-awtrix-light-upstream-overlay.patch") == 1
assert local_build.count("014-awtrix-light-upstream-overlay.patch") == 1
assert tool.index('"$ROOT/patches/014-awtrix-light-upstream-overlay.patch"') < tool.index('awtrix3_copy_wrapper_source "$ROOT" "$AWTRIX3_DIR"')
assert tool.index('awtrix3_copy_wrapper_source "$ROOT" "$AWTRIX3_DIR"') < tool.index('awtrix3_copy_web_ui "$ROOT" "$AWTRIX3_DIR"')
assert tool.index('awtrix3_copy_web_ui "$ROOT" "$AWTRIX3_DIR"') < tool.index('awtrix3_embed_web_assets "$ROOT" "$AWTRIX3_DIR"')
assert tool.index('awtrix3_embed_web_assets "$ROOT" "$AWTRIX3_DIR"') < tool.index('awtrix3_apply_version "$ROOT" "$AWTRIX3_DIR"')
assert tool.index('awtrix3_apply_version "$ROOT" "$AWTRIX3_DIR"') < tool.index('COMPILED_VERSION=')
assert tool.index('COMPILED_VERSION=') < tool.index('for target in "${TARGETS[@]}"; do')
assert local_build.index('"$DIR/patches/014-awtrix-light-upstream-overlay.patch"') < local_build.index('awtrix3_copy_wrapper_source "$DIR" "$A3"')
assert local_build.index('awtrix3_copy_wrapper_source "$DIR" "$A3"') < local_build.index('awtrix3_copy_web_ui "$DIR" "$A3"')
assert local_build.index('awtrix3_copy_web_ui "$DIR" "$A3"') < local_build.index('awtrix3_embed_web_assets "$DIR" "$A3"')
assert local_build.index('awtrix3_embed_web_assets "$DIR" "$A3"') < local_build.index('awtrix3_apply_version "$DIR" "$A3"')
assert local_build.index('awtrix3_apply_version "$DIR" "$A3"') < local_build.index('awtrix3_platformio_upload "$DIR" "$A3"')
assert '[ "$OVERLAID_VERSION" = "$VERSION" ]' in tool
assert '[ "$COMPILED_VERSION" = "$VERSION" ]' in tool
for obsolete_patch in (
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
    "013-webserver-upload-handler.patch",
):
    assert obsolete_patch not in tool
    assert obsolete_patch not in local_build

expected_overlay_paths = {
    "docs/ulanzi_flasher/firmware/manifest.json",
    "lib/webserver/esp-fs-webserver.cpp",
    "lib/webserver/esp-fs-webserver.h",
    "platformio.ini",
    "src/Apps.cpp",
    "src/Apps.h",
    "src/DisplayManager.cpp",
    "src/DisplayManager.h",
    "src/Games/AwtrixSays.cpp",
    "src/Games/AwtrixSays.h",
    "src/Games/GameManager.cpp",
    "src/Games/GameManager.h",
    "src/Games/SlotMachine.cpp",
    "src/Games/SlotMachine.h",
    "src/Globals.cpp",
    "src/Globals.h",
    "src/MatrixDisplayUi.cpp",
    "src/MatrixDisplayUi.h",
    "src/GifPlayer.h",
    "src/PeripheryManager.cpp",
    "src/effects.h",
}
overlay_paths = {
    line.removeprefix("diff --git a/").split(" b/", 1)[0]
    for line in overlay_patch.splitlines()
    if line.startswith("diff --git a/")
}
assert overlay_paths == expected_overlay_paths
for forbidden_path in (
    "src/ServerManager.cpp",
    "src/ServerManager.h",
    "src/UpdateManager.cpp",
    "src/UpdateManager.h",
    "src/AppStore.cpp",
    "src/AppStore.h",
    "src/AwtrixLightRuntime.cpp",
    "src/AwtrixLightRuntime.h",
    "src/AwtrixLightWeb.cpp",
    "src/AwtrixLightWeb.h",
    "src/AwtrixLightWebSocket.cpp",
    "src/AwtrixLightWebSocket.h",
    "src/effects_stub.cpp",
    "src/web_assets.h",
    "version",
):
    assert forbidden_path not in overlay_paths

for marker in (
    "String flowApplyInputs(JsonObject doc, String value)",
    "void fetchFlowHttpSource(JsonObject app, JsonObject source, DynamicJsonDocument &sourceValues)",
    "void fetchFlowHaSource(JsonObject app, JsonObject source, DynamicJsonDocument &sourceValues)",
    "uint32_t flowRefreshInterval(JsonObject doc)",
    "uint32_t flowRefreshInterval = 0;",
    'HA_BASE_URL = doc["ha_base_url"].as<String>();',
    'HA_TOKEN = doc["ha_token"].as<String>();',
    'String HA_BASE_URL = "";',
    'String HA_TOKEN = "";',
    "extern String HA_BASE_URL;",
    "extern String HA_TOKEN;",
    "void addHandler(const Uri &uri, HTTPMethod method, WebServerClass::THandlerFunction fn, WebServerClass::THandlerFunction uploadFn);",
    "webserver->on(uri, method, authMiddleware(fn), authMiddleware(uploadFn));",
    "src_filter = +<*> -<Games/*> -<effects.cpp>",
    "const int numOfEffects = 0;",
    "void GameManager_::setup() {}",
    "void GameManager_::sendPoints(int) {}",
    "void DisplayManager_::showRuntime()",
    "uint32_t DisplayManager_::runtimeSequence() const",
    "bool isCustomAppOrChild(const String &candidate, const String &name)",
    "if (candidate[i] < '0' || candidate[i] > '9')",
    "bool removeCustomAppFromApps(const String &name, bool setApps)",
    "return deleteCustomAppFile(name);",
    "return removeCustomAppFromApps(name, true);",
    "bool validGif = false;",
    "keyFrame = true;",
    "tbiWidth > WIDTH - tbiImageX || tbiHeight > HEIGHT - tbiImageY",
    "if (lzwDataOffset >= lzwDataSize)",
    "if (pixel >= colorCount)",
    "void closeFile(File *imageFile)",
    "ui->closeGifFile(&app.icon);",
    "void MatrixDisplayUi::closeGifFile(File *file)",
    "if (!m_filesystem->remove(path))",
):
    assert marker in overlay_patch
    assert marker in build_lib

assert server_manager.index('File appFile = LittleFS.open(fileName, "r");') < server_manager.index("DisplayManager.uninstallCustomApp(name)")
assert 'appDoc["type"].is<const char *>()' in server_manager
assert 'appDoc["icon"].is<const char *>()' in server_manager
assert 'appDoc["type"].as<String>() == "animation"' in server_manager
assert 'appDoc["icon"].as<String>() == name' in server_manager
assert server_manager.index("DisplayManager.uninstallCustomApp(name)") < server_manager.index('String animationFileName = "/ICONS/" + name + ".gif";')
assert 'LittleFS.remove(animationFileName)' in server_manager
assert '"/ICONS/" + name + ".jpg"' not in server_manager
assert "src/ServerManager.cpp" not in overlay_paths
for marker in (
    'mws.addOption("HA Prefix", HA_PREFIX);',
    'mws.addOption("HA Base URL", HA_BASE_URL);',
    'mws.addOption("HA Token", HA_TOKEN);',
    'HA_PREFIX = doc["HA Prefix"].as<String>();',
    'HA_BASE_URL = doc["HA Base URL"].as<String>();',
    'HA_TOKEN = doc["HA Token"].as<String>();',
):
    assert marker in server_manager
assert 'TARGETS=(ulanzi awtrix2_upgrade)' in tool
assert 'python3 -m platformio run -e "$target"' in tool
manifest_targets = set(re.findall(r'^\s*\("([^"]+)", f"awtrix-light-\{version\}-[^"]+\.bin"\),$', tool, re.MULTILINE))
firmware_targets = set(re.findall(r'otaTarget = "([^"]+)"', update_manager))
assert manifest_targets == {"ulanzi", "awtrix2-upgrade"}
assert "awtrix2_upgrade" not in manifest_targets
assert manifest_targets == firmware_targets
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


def run_upstream_overlay():
    with tempfile.TemporaryDirectory() as temp_dir:
        fixture_root = Path(temp_dir)
        fixture_awtrix3 = fixture_root / "awtrix3"
        fixture_awtrix3.mkdir()
        archive = subprocess.run(
            ["git", "-C", str(root / "awtrix3"), "archive", "723e8c7a44ea70ac661217be0674b743d212317c"],
            check=True,
            capture_output=True,
        ).stdout
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(fixture_awtrix3, filter="data")

        command = [
            "bash",
            "-c",
            'source "$1"; awtrix3_apply_patches "$2" "$3" "$4"',
            "bash",
            str(root / "tools/awtrix3_build_lib.sh"),
            str(fixture_root),
            str(fixture_awtrix3),
            str(overlay_patch_path),
        ]
        first = subprocess.run(command, capture_output=True, text=True)
        assert first.returncode == 0, first.stderr
        assert "already applied" not in first.stdout
        for path, marker in (
            ("src/DisplayManager.cpp", "String flowApplyInputs(JsonObject doc, String value)"),
            ("src/DisplayManager.cpp", "void fetchFlowHttpSource(JsonObject app, JsonObject source, DynamicJsonDocument &sourceValues)"),
            ("src/DisplayManager.cpp", "void fetchFlowHaSource(JsonObject app, JsonObject source, DynamicJsonDocument &sourceValues)"),
            ("src/Globals.cpp", 'HA_BASE_URL = doc["ha_base_url"].as<String>();'),
            ("src/Globals.cpp", 'HA_TOKEN = doc["ha_token"].as<String>();'),
            ("src/GifPlayer.h", "bool readFailed = false;"),
            ("src/GifPlayer.h", "lsdWidth > 0 && lsdWidth <= WIDTH"),
            ("src/GifPlayer.h", "tbiWidth > lsdWidth - tbiImageX || tbiHeight > lsdHeight - tbiImageY"),
            ("src/GifPlayer.h", "offset + dataBlockSize + 1 > (int)sizeof(lzwImageData)"),
            ("src/GifPlayer.h", "if (code >= LZW_SIZTABLE || sp >= stack + LZW_SIZTABLE)"),
            ("src/GifPlayer.h", "if (pixel >= colorCount)"),
            ("src/GifPlayer.h", "void closeFile(File *imageFile)"),
            ("src/DisplayManager.cpp", "ui->closeGifFile(&app.icon);"),
            ("src/DisplayManager.cpp", "bool isCustomAppOrChild(const String &candidate, const String &name)"),
            ("src/DisplayManager.cpp", "if (candidate[i] < '0' || candidate[i] > '9')"),
            ("src/DisplayManager.cpp", "return deleteCustomAppFile(name);"),
            ("src/DisplayManager.cpp", "return removeCustomAppFromApps(name, true);"),
            ("src/MatrixDisplayUi.cpp", "void MatrixDisplayUi::closeGifFile(File *file)"),
            ("lib/webserver/esp-fs-webserver.cpp", "if (!m_filesystem->remove(path))"),
        ):
            assert marker in (fixture_awtrix3 / path).read_text()

        host_test = fixture_root / "gif-host"
        host_test.mkdir()
        (host_test / "LittleFS.h").write_text(
            """#pragma once
#include <cstddef>
#include <cstdint>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>
enum SeekMode { SeekSet };
static std::map<std::string, int> openHandles;
class File {
 public:
  File() = default;
  explicit File(const char *path) : name_(path), data_(std::make_shared<std::vector<uint8_t>>()), position_(std::make_shared<size_t>(0)), open_(true) {
    std::ifstream input(path, std::ios::binary);
    data_->assign(std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>());
    ++openHandles[name_];
  }
  explicit operator bool() const { return open_; }
  int read() { return open_ && data_ && *position_ < data_->size() ? (*data_)[(*position_)++] : -1; }
  int read(uint8_t *buffer, size_t count) {
    size_t available = open_ && data_ ? data_->size() - *position_ : 0;
    size_t copied = count < available ? count : available;
    for (size_t index = 0; index < copied; index++) buffer[index] = (*data_)[(*position_)++];
    return static_cast<int>(copied);
  }
  bool seek(size_t position, SeekMode) { if (!data_ || position > data_->size()) return false; *position_ = position; return true; }
  bool seek(size_t position) { return seek(position, SeekSet); }
  size_t position() const { return position_ ? *position_ : 0; }
  const char *name() const { return name_.c_str(); }
  void close() { if (open_) { open_ = false; --openHandles[name_]; } }
 private:
  std::string name_;
  std::shared_ptr<std::vector<uint8_t>> data_;
  std::shared_ptr<size_t> position_;
  bool open_ = false;
};
""",
            encoding="ascii",
        )
        (host_test / "main.cpp").write_text(
            """#include <cstdint>
#include <cstring>
using byte = uint8_t;
using boolean = bool;
struct CRGB { uint8_t r = 0, g = 0, b = 0; static const CRGB Black; };
const CRGB CRGB::Black{};
class FastLED_NeoMatrix { public: void drawPixel(int, int, const CRGB &) {} };
static unsigned long clockValue = 100000;
unsigned long millis() { return clockValue += 1000; }
#include "GifPlayer.h"
int main(int argc, char **argv) {
  if (argc != 5) return 10;
  FastLED_NeoMatrix matrix;
  for (int index = 1; index < argc; index++) {
    GifPlayer player{};
    player.setMatrix(&matrix);
    File unrelated(argv[index]);
    File file(argv[index]);
    int width = player.playGif(0, 0, &file);
    if (index == 1) {
      if (width != 32 || player.getFrame() == 0) return 20;
    } else if (width != 0) {
      return 30 + index;
    }
    player.closeFile(&file);
    if (player.file || !file || openHandles[argv[index]] < 1) return 40 + index;
  }
  return 0;
}
""",
            encoding="ascii",
        )
        (host_test / "GifPlayer.h").write_bytes((fixture_awtrix3 / "src/GifPlayer.h").read_bytes())
        valid_gif = (root / "app-store/apps/animation/fade.gif").read_bytes()
        assert valid_gif[:6] in (b"GIF87a", b"GIF89a")
        packed = valid_gif[10]
        descriptor = 13 + (3 * (2 << (packed & 7)) if packed & 0x80 else 0)
        while valid_gif[descriptor] == 0x21:
            descriptor += 2
            while True:
                block_size = valid_gif[descriptor]
                descriptor += 1
                if block_size == 0:
                    break
                descriptor += block_size
        assert valid_gif[descriptor] == 0x2C
        fixtures = {
            "valid.gif": valid_gif,
            "truncated.gif": valid_gif[:5],
            "wide-screen.gif": valid_gif[:6] + b"\x21\x00" + valid_gif[8:],
            "bad-image-offset.gif": valid_gif[: descriptor + 1] + b"\x20\x00" + valid_gif[descriptor + 3 :],
        }
        for name, content in fixtures.items():
            (host_test / name).write_bytes(content)
        host_compile = subprocess.run(
            ["g++", "-std=c++17", "-I", str(host_test), str(host_test / "main.cpp"), "-o", str(host_test / "gif-host")],
            capture_output=True,
            text=True,
        )
        assert host_compile.returncode == 0, host_compile.stderr
        host_run = subprocess.run(
            [str(host_test / "gif-host"), *[str(host_test / name) for name in fixtures]],
            capture_output=True,
            text=True,
        )
        assert host_run.returncode == 0, host_run.stderr

        second = subprocess.run(command, capture_output=True, text=True)
        assert second.returncode == 0, second.stderr
        assert "already applied: 014-awtrix-light-upstream-overlay.patch" in second.stdout

        display_manager = fixture_awtrix3 / "src/DisplayManager.cpp"
        source = display_manager.read_text()
        display_manager.write_text(source.replace("String flowApplyInputs(JsonObject doc, String value)", "String removedFlowMarker(JsonObject doc, String value)", 1))
        incomplete = subprocess.run(command, capture_output=True, text=True)
        assert incomplete.returncode != 0
        assert "failed to apply patch" in incomplete.stderr

        display_manager.write_text(source)
        archived_game = subprocess.run(
            ["git", "-C", str(root / "awtrix3"), "show", "723e8c7a44ea70ac661217be0674b743d212317c:src/Games/AwtrixSays.cpp"],
            check=True,
            capture_output=True,
        ).stdout
        (fixture_awtrix3 / "src/Games/AwtrixSays.cpp").write_bytes(archived_game)
        restored_game = subprocess.run(command, capture_output=True, text=True)
        assert restored_game.returncode != 0
        assert "failed to apply patch" in restored_game.stderr

        (fixture_awtrix3 / "src/Games/AwtrixSays.cpp").unlink()
        webserver_path = fixture_awtrix3 / "lib/webserver/esp-fs-webserver.cpp"
        webserver_source = webserver_path.read_text()
        webserver_path.write_text(webserver_source.replace('    if (filename.indexOf("..") != -1)\n    {\n        error += PSTR(" !! PARENT_PATH !! ");\n    }\n', "", 1))
        missing_path_guard = subprocess.run(command, capture_output=True, text=True)
        assert missing_path_guard.returncode != 0
        assert "failed to apply patch" in missing_path_guard.stderr


run_upstream_overlay()


def run_overlay(parent_version, declarations):
    with tempfile.TemporaryDirectory() as temp_dir:
        fixture_root = Path(temp_dir)
        fixture_awtrix3 = fixture_root / "awtrix3"
        (fixture_awtrix3 / "src").mkdir(parents=True)
        (fixture_root / "version").write_bytes(parent_version)
        globals_path = fixture_awtrix3 / "src/Globals.cpp"
        original = "before\n" + "\n".join(declarations) + "\nafter\n"
        globals_path.write_text(original)
        result = subprocess.run(
            [
                "bash",
                "-c",
                'source "$1"; awtrix3_apply_version "$2" "$3"',
                "bash",
                str(root / "tools/awtrix3_build_lib.sh"),
                str(fixture_root),
                str(fixture_awtrix3),
            ],
            capture_output=True,
            text=True,
        )
        overlaid_version = (fixture_awtrix3 / "version").read_bytes() if (fixture_awtrix3 / "version").exists() else None
        return result, original, globals_path.read_text(), overlaid_version


result, original, updated, overlaid_version = run_overlay(
    b"0.98.1-light\r\n",
    ['extern const char *VERSION;', 'const char *VERSION = "0.98";', 'const char *OTHER = "unchanged";'],
)
assert result.returncode == 0, result.stderr
assert updated == original.replace('const char *VERSION = "0.98";', 'const char *VERSION = "0.98.1-light";')
assert overlaid_version == b"0.98.1-light\n"

result, original, updated, overlaid_version = run_overlay(
    b"0.98.1-light",
    ['  const char* VERSION = "0.98" ;  '],
)
assert result.returncode == 0, result.stderr
assert updated == original.replace('"0.98"', '"0.98.1-light"')
assert overlaid_version == b"0.98.1-light\n"

result, _, first_update, _ = run_overlay(b"0.98.1-light\n", ['const char *VERSION = "0.98.1-light";'])
assert result.returncode == 0, result.stderr
assert first_update == 'before\nconst char *VERSION = "0.98.1-light";\nafter\n'

for invalid_version in (b"0.98-light\n", b"0.98.1\n", b" 0.98.1-light\n", b"0.98.1-light \n"):
    result, original, updated, overlaid_version = run_overlay(invalid_version, ['const char *VERSION = "0.98";'])
    assert result.returncode != 0
    assert updated == original
    assert overlaid_version is None

for declarations in (
    [],
    ['extern const char *VERSION;'],
    ['const char *VERSION = "one";', 'const char *VERSION = "two";'],
):
    result, original, updated, overlaid_version = run_overlay(b"0.98.1-light\n", declarations)
    assert result.returncode != 0
    assert updated == original
    assert overlaid_version is None

print("release firmware contract: ok")
