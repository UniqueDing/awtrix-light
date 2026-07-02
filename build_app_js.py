#!/usr/bin/env python3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "www/src/app"
OUT = ROOT / "www/app.js"

MODULES = [
    "00-state-i18n.js",
    "01-app-uninstall.js",
    "02-cast-labels.js",
    "03-cast-files-install.js",
    "04-settings-state.js",
    "05-settings-tabs-labels.js",
    "06-device-setting-groups.js",
    "07-legacy-setting-groups.js",
    "08-settings-tabs-render.js",
    "09-settings-field.js",
    "10-settings-render-wifi.js",
    "11-settings-load-save.js",
    "12-settings-collect.js",
    "13-legacy-save.js",
    "14-device-save.js",
    "15-cast-runtime-preview-bootstrap.js",
]


def main() -> None:
    files = [SRC / name for name in MODULES]
    missing = [str(path.relative_to(ROOT)) for path in files if not path.exists()]
    if missing:
        raise SystemExit("missing app source module(s): " + ", ".join(missing))
    OUT.write_text("\n".join(path.read_text().rstrip("\n") for path in files) + "\n")


if __name__ == "__main__":
    main()
