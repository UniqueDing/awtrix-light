#!/usr/bin/env python3
from pathlib import Path
ROOT = Path(__file__).resolve().parent
js_dir = ROOT / "www/js"
out = ROOT / "www/app.js"
order = [
    "00-state-i18n.js", "01-app-uninstall.js", "02-live-labels.js",
    "03-live-files-install.js", "04-settings-state.js", "05-settings-tabs-labels.js",
    "06-device-setting-groups.js", "07-legacy-setting-groups.js", "08-settings-tabs-render.js",
    "09-settings-field.js", "10-settings-render-wifi.js", "11-settings-load-save.js",
    "12-settings-collect.js", "13-legacy-save.js", "14-device-save.js",
    "15-live-runtime-preview-bootstrap.js",
]
missing = [n for n in order if not (js_dir / n).exists()]
if missing:
    print(f"missing: {', '.join(missing)}")
else:
    parts = [(js_dir / n).read_text() for n in order]
    out.write_text("\n\n".join(parts))
    print(f"built {out} ({len(out.read_bytes())} bytes)")
