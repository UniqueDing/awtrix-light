# Live Convention

Live are browser-run JavaScript applications that cast frames to the AWTRIX matrix through `/api/runtime/*`. The old name was Live App; the user-facing name is now Live.

This file keeps the old filename so older links still work. New documentation should link to `live-app-development.md`.

## Why "Live"

The app logic runs in the browser, not on the device. The browser claims the runtime and casts frame updates to the matrix. Closing the Live releases runtime and returns the device to Flow rotation.

## Compatibility Names

For compatibility, the store schema still uses:

- `castApps` in `list.json`
- `type: "live"` in each Live manifest
- existing browser storage keys such as `localStorage.awtrixLiveApps`

These names are implementation details. UI and docs should call them Live.

## Manifest

A Live entry should contain:

```json
{
  "id": "countdown",
  "type": "live",
  "name": "倒计时",
  "name_i18n": { "zh": "倒计时", "en": "Countdown" },
  "description": "设置分钟和秒，倒数到零并显示完成。",
  "description_i18n": {
    "zh": "设置分钟和秒，倒数到零并显示完成。",
    "en": "Set minutes and seconds, count down to zero, and show completion."
  },
  "icon": "⏳",
  "entry": "cast/countdown.js",
  "params": {
    "defaultSeconds": 300
  }
}
```

Fields:

- `id`: stable install id, unique among Live.
- `type`: keep `live` for compatibility.
- `name`: fallback display name.
- `name_i18n`: localized display names.
- `description`: fallback description.
- `description_i18n`: localized descriptions.
- `icon`: short text/emoji or a future icon reference.
- `entry`: JavaScript module path. Relative paths resolve from the store list URL.
- `params`: optional static app configuration passed to `open(api, manifest)`.

## Runtime Contract

A Live should:

1. Open UI with `api.openDialog(title, html)`.
2. Call `api.claim()` before drawing.
3. Send frames with `api.frame(body)`.
4. Stop timers in `api.onClose`.
5. Let the top-right close button release runtime.

Stop/Pause controls inside the app should stop app logic only. They should not return to Flow. Only closing the app releases runtime.

Frame payloads can use draw commands:

```json
{
  "clear": true,
  "commands": [
    { "df": [0, 0, 32, 8, "#000000"] },
    { "dt": [0, 0, "00:30", "#00ff99"] }
  ]
}
```

Or raw pixels through `pixels` for full-frame animations.

## SDK

The module receives `open(api, manifest)`.

Language helpers:

- `api.lang`: current language, `zh` or `en`.
- `api.label(value)`: localize `{ zh, en }` objects.
- `api.t(value)`: same behavior, intended for module-local dictionaries.

Runtime helpers:

- `api.openDialog(title, html)`
- `api.status(message, isError)`
- `api.claim()`
- `api.frame(body)`
- `api.release()`
- `api.commands.clear/text/fill/pixel/line(...)`

## Install And Cache Model

Flow installs live on the device under `/Apps/flow`. Animation installs live under `/Apps/animation`. Live installs use one manifest per app under `/Apps/cast/<id>.json`, so the installed Live list survives changing browser, phone, or computer. Browser `localStorage` remains only as a migration mirror for older installs.

The current Live loader dynamically imports the locally cached JS module from `/Apps/cast/<id>.js` after install. The original remote URL is kept in the manifest as `entryOriginal` for updates or recovery.

The current install model already caches Live JS to LittleFS, so updates and uninstall cleanup must keep the `.json` and `.js` sidecar files in sync.

## External Modules

A mock store publishes Live through `castApps` in `list.json`:

```json
{
  "schemaVersion": 1,
  "apps": [],
  "castApps": [
    {
      "id": "bounce-dot",
      "type": "live",
      "name": "Bounce Dot",
      "name_i18n": { "zh": "弹跳点", "en": "Bounce Dot" },
      "description": "External JS module demo.",
      "description_i18n": {
        "zh": "外置 JS 模块演示。",
        "en": "External JS module demo."
      },
      "entry": "cast/bounce-dot.js"
    }
  ]
}
```

External modules must export `open(api, manifest)` or a default function.

For a full tutorial, see `docs/live-app-development.md`.
