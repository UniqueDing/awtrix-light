#!/usr/bin/env python3

import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile


root = Path(__file__).resolve().parents[1]
source = (root / "src/ServerManager.cpp").read_text()
frontend = (root / "www/js/app-uninstall.js").read_text()


def patched_upstream_sources():
    with tempfile.TemporaryDirectory() as temp_dir:
        fixture_root = Path(temp_dir)
        fixture_awtrix3 = fixture_root / "awtrix3"
        fixture_awtrix3.mkdir()
        git_env = {**os.environ, "GIT_MASTER": "1"}
        archive = subprocess.run(
            ["git", "-C", str(root / "awtrix3"), "archive", "723e8c7a44ea70ac661217be0674b743d212317c"],
            check=True,
            capture_output=True,
            env=git_env,
        ).stdout
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(fixture_awtrix3, filter="data")

        result = subprocess.run(
            [
                "bash",
                "-c",
                'source "$1"; awtrix3_apply_patches "$2" "$3" "$4"',
                "bash",
                str(root / "tools/awtrix3_build_lib.sh"),
                str(fixture_root),
                str(fixture_awtrix3),
                str(root / "patches/014-awtrix-light-upstream-overlay.patch"),
            ],
            capture_output=True,
            text=True,
            env=git_env,
        )
        assert result.returncode == 0, result.stderr
        return (
            (fixture_awtrix3 / "src/DisplayManager.cpp").read_text(),
            (fixture_awtrix3 / "src/GifPlayer.h").read_text(),
            (fixture_awtrix3 / "src/MatrixDisplayUi.cpp").read_text(),
            (fixture_awtrix3 / "lib/webserver/esp-fs-webserver.cpp").read_text(),
        )


def extract_function(source_text, signature):
    start = source_text.index(signature)
    body_start = source_text.index("{", start)
    depth = 0
    for index in range(body_start, len(source_text)):
        if source_text[index] == "{":
            depth += 1
        elif source_text[index] == "}":
            depth -= 1
            if depth == 0:
                return source_text[start : index + 1]
    raise AssertionError(f"unterminated function: {signature}")


def run_uninstall_behavior(display_manager_source):
    functions = "\n\n".join(
        extract_function(display_manager_source, signature)
        for signature in (
            "bool deleteCustomAppFile(const String &name)",
            "bool isCustomAppOrChild(const String &candidate, const String &name)",
            "bool removeCustomAppFromApps(const String &name, bool setApps)",
            "bool DisplayManager_::uninstallCustomApp(const String &name)",
        )
    )
    harness = r'''#include <map>
#include <set>
#include <string>
#include <utility>
#include <vector>

class String {
 public:
  String() = default;
  String(const char *value) : value_(value) {}
  String(const std::string &value) : value_(value) {}
  size_t length() const { return value_.length(); }
  bool startsWith(const String &prefix) const { return value_.rfind(prefix.value_, 0) == 0; }
  char operator[](size_t index) const { return value_[index]; }
  bool operator==(const String &other) const { return value_ == other.value_; }
  bool operator!=(const String &other) const { return !(*this == other); }
  bool operator<(const String &other) const { return value_ < other.value_; }
  friend String operator+(const String &left, const String &right) { return String(left.value_ + right.value_); }
 private:
  std::string value_;
};

#define DEBUG_PRINTLN(...)
static bool DEBUG_MODE = false;
static const int TIME_PER_APP = 10;
using AppCallback = int;

struct File {
  void close() { closed = true; }
  bool closed = false;
};
struct CustomApp { File icon; };

std::vector<std::pair<String, AppCallback>> Apps;
std::map<String, CustomApp> customApps;

struct Ui {
  void closeGifFile(File *file) { file->close(); }
  void setApps(const std::vector<std::pair<String, AppCallback>> &) {}
} uiInstance;
Ui *ui = &uiInstance;

struct LittleFsMock {
  bool exists(const String &path) const { return files.count(path) != 0; }
  bool remove(const String &path) {
    if (failedRemovals.count(path)) return false;
    return files.erase(path) == 1;
  }
  std::set<String> files;
  std::set<String> failedRemovals;
} LittleFS;

class DisplayManager_ {
 public:
  DisplayManager_ &getInstance() { return *this; }
  void setAutoTransition(bool) {}
  void setAppTime(int) {}
  bool uninstallCustomApp(const String &name);
};
DisplayManager_ DisplayManager;

static bool validCustomAppName(const String &) { return true; }

''' + functions + r'''

static bool hasApp(const String &name) {
  for (const auto &app : Apps) if (app.first == name) return true;
  return false;
}

static void populate() {
  Apps = {{"snake", 1}, {"snake0", 2}, {"snake01", 3}, {"snake-animation", 4}, {"snake-extra", 5}};
  customApps.clear();
  for (const auto &app : Apps) customApps[app.first] = CustomApp{};
  LittleFS.files = {"/CUSTOMAPPS/snake.json", "/CUSTOMAPPS/snake-animation.json"};
  LittleFS.failedRemovals.clear();
}

int main() {
  populate();
  if (!DisplayManager.uninstallCustomApp("snake")) return 10;
  if (hasApp("snake") || hasApp("snake0") || hasApp("snake01")) return 11;
  if (!hasApp("snake-animation") || !hasApp("snake-extra")) return 12;
  if (customApps.count("snake") || customApps.count("snake0") || customApps.count("snake01")) return 13;
  if (!customApps.count("snake-animation") || !customApps.count("snake-extra")) return 14;
  if (LittleFS.exists("/CUSTOMAPPS/snake.json")) return 15;
  if (!LittleFS.exists("/CUSTOMAPPS/snake-animation.json")) return 16;

  populate();
  LittleFS.failedRemovals.insert("/CUSTOMAPPS/snake.json");
  if (DisplayManager.uninstallCustomApp("snake")) return 20;
  if (!LittleFS.exists("/CUSTOMAPPS/snake.json")) return 21;
  if (!LittleFS.exists("/CUSTOMAPPS/snake-animation.json")) return 22;
  if (!hasApp("snake-animation") || !customApps.count("snake-animation")) return 23;
  return 0;
}
'''
    with tempfile.TemporaryDirectory() as temp_dir:
        host_dir = Path(temp_dir)
        source_path = host_dir / "custom-app-uninstall.cpp"
        binary_path = host_dir / "custom-app-uninstall"
        source_path.write_text(harness, encoding="ascii")
        compiled = subprocess.run(
            ["g++", "-std=c++17", str(source_path), "-o", str(binary_path)],
            capture_output=True,
            text=True,
        )
        assert compiled.returncode == 0, compiled.stderr
        executed = subprocess.run([str(binary_path)], capture_output=True, text=True)
        assert executed.returncode == 0, executed.stderr


display_manager, gif_player, matrix_ui, webserver = patched_upstream_sources()
run_uninstall_behavior(display_manager)

handler_start = source.index("static void uninstallCustomApp()")
handler_end = source.index("static void sendIntegrationResult", handler_start)
handler = source[handler_start:handler_end]

ownership_check = 'appDoc["type"].as<String>() == "animation" &&'
icon_check = 'appDoc["icon"].as<String>() == name;'
uninstall_call = "DisplayManager.uninstallCustomApp(name)"
gif_path = 'String animationFileName = "/ICONS/" + name + ".gif";'
cleanup_failure = (
    'mws.webserver->send(200, F("application/json"), '
    'F("{\\"success\\":true,\\"cleanupPending\\":true,\\"warning\\":\\"animation cleanup failed\\"}"));'
)

assert ownership_check in handler
assert icon_check in handler
assert handler.index(ownership_check) < handler.index(uninstall_call) < handler.index(gif_path)
assert 'if (!DisplayManager.uninstallCustomApp(name))' in handler
assert 'send(500, F("application/json"), F("{\\"success\\":false,\\"error\\":\\"uninstall failed\\"}"))' in handler
assert cleanup_failure in handler
assert '"animation cleanup failed"' not in handler
assert '"/ICONS/" + name + ".jpg"' not in handler
assert handler.count("LittleFS.remove(animationFileName)") == 1

assert "if (!response.ok || !result.success)" in frontend
assert "await deleteAnimationIcon(name);" in frontend
assert frontend.index("if (!response.ok || !result.success)") < frontend.index("await deleteAnimationIcon(name);")

cleanup_start = display_manager.index("bool removeCustomAppFromApps(const String &name, bool setApps)")
cleanup_end = display_manager.index("bool parseFragmentsText", cleanup_start)
cleanup = display_manager[cleanup_start:cleanup_end]
assert "ui->closeGifFile(&app.icon);" in cleanup
assert cleanup.index("ui->closeGifFile(&app.icon);") < cleanup.index("app.icon.close();") < cleanup.index("customApps.erase(mapIt)")
assert "void closeFile(File *imageFile)" in gif_player
assert "if (sourceFile == imageFile)" in gif_player
assert "gif1.closeFile(file);" in matrix_ui
assert "gif2.closeFile(file);" in matrix_ui

delete_start = webserver.index("void FSWebServer::handleFileDelete()")
delete_end = webserver.index("void FSWebServer::handleStatus()", delete_start)
delete_handler = webserver[delete_start:delete_end]
assert "if (!m_filesystem->remove(path))" in delete_handler
assert "if (!m_filesystem->rmdir(path))" in delete_handler
assert delete_handler.count('replyToCLient(ERROR, PSTR("DELETE FAILED"));') == 2

print("custom app uninstall contract: ok")
