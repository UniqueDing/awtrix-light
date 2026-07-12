# Live Development Tutorial

A Live is a browser-run JavaScript module that casts frames to the AWTRIX matrix through `/api/runtime/*`. It is called Live because the app logic runs in the web page and casts the current frame to the device, similar to a small screen-cast session.

Use a Live for games, controls, drawing tools, timers, and other experiences that need buttons or active browser-side logic.

## Runtime model

A Live requires the Web UI to stay open. The browser loads the module, claims the display runtime, sends frames, and releases runtime when the user closes the app.

Current behavior:

- The store manifest is loaded from the app store JSON.
- The JavaScript module referenced by `entry` is dynamically imported from its URL.
- Installed Live manifests are stored one-per-app on the device under `/Apps/cast/<id>.json`.
- Browser `localStorage` is used only as a compatibility/migration mirror.
- The JS module itself is cached to LittleFS at `/Apps/cast/<id>.js` during install.

This means the installed Live list follows the AWTRIX device when you switch browsers or phones. The module code runs from the locally cached `/Apps/cast/<id>.js` file after install, while `entryOriginal` preserves the remote source URL for future updates or recovery.

## Manifest

Live still use `castApps` and `type: "live"` internally for compatibility. User-facing UI calls them Live.

```json
{
  "id": "stopwatch",
  "type": "live",
  "name": "秒表",
  "name_i18n": { "zh": "秒表", "en": "Stopwatch" },
  "description": "正向计时，支持开始、暂停、重置。",
  "description_i18n": {
    "zh": "正向计时，支持开始、暂停、重置。",
    "en": "Count upward with start, pause, and reset controls."
  },
  "icon": "⏱",
  "entry": "cast/stopwatch.js",
  "params": {
    "accent": "#00e5ff",
    "idleColor": "#ffcc00"
  }
}
```

Recommended fields:

- `id`: stable install id.
- `type`: keep `live` for compatibility.
- `name`: fallback name.
- `name_i18n`: localized names. The UI chooses current language, then English, then Chinese, then fallback `name`.
- `description`: fallback description.
- `description_i18n`: localized descriptions.
- `icon`: short label or emoji.
- `entry`: ES module URL or relative path resolved from the store list URL.
- `params`: static configuration passed to the module through `manifest.params`.

## Module entry point

A module exports `open(api, manifest)` or a default function.

```js
export async function open(api, manifest) {
  const L = {
    start: { zh: "开始", en: "Start" },
    reset: { zh: "重置", en: "Reset" },
    ready: { zh: "已准备", en: "Ready" },
  };

  const accent = manifest.params?.accent || "#00e5ff";
  const root = api.openDialog(
    api.label(manifest.name_i18n) || manifest.name,
    `
    <section class="settings-card stopwatch-dialog">
      <h3>Demo</h3>
      <div class="live-actions">
        <button id="start" class="primary">${api.t(L.start)}</button>
        <button id="reset" class="tonal">${api.t(L.reset)}</button>
      </div>
    </section>
  `,
  );

  api.onClose = async () => {
    // Stop timers here. The SDK releases runtime after this hook finishes.
  };

  root.querySelector("#start").onclick = async () => {
    await api.claim();
    await api.frame({
      clear: true,
      commands: [
        api.commands.clear(),
        api.commands.text(9, 0, "HELLO", accent),
      ],
    });
    api.status(api.t(L.ready), false);
  };
}
```

## Parameters passed to a Live

The module receives two arguments:

`open(api, manifest)`

`manifest` is the installed manifest object. Use it for static app metadata and configuration:

- `manifest.id`
- `manifest.name`
- `manifest.name_i18n`
- `manifest.description`
- `manifest.description_i18n`
- `manifest.icon`
- `manifest.entry`
- `manifest.entryUrl` after the store loader resolves the URL
- `manifest.params` for app-specific options

`api` is the runtime SDK. Use it for browser UI, language, device runtime, and drawing.

## SDK methods

Language and labels:

- `api.lang`: current UI language, `zh` or `en`.
- `api.label(value)`: localize `{ zh, en }` values with fallback.
- `api.t(value)`: same as `api.label`; useful for local dictionaries.

Dialog and status:

- `api.openDialog(title, html)`: open the Live dialog and return the root element.
- `api.status(message, isError)`: show a status line in the dialog.
- `api.$(id)`: shortcut for `document.getElementById(id)`.
- `api.onClose`: optional async hook. Stop timers here.

Runtime:

- `api.claim()`: call `POST /api/runtime/claim` for this app.
- `api.frame(body)`: call `POST /api/runtime/frame`.
- `api.release()`: call `POST /api/runtime/release`.

Draw helpers:

- `api.commands.clear()`: fill the 32x8 matrix with black.
- `api.commands.text(x, y, text, color)`: draw text.
- `api.commands.fill(x, y, w, h, color)`: draw a filled rectangle.
- `api.commands.pixel(x, y, color)`: draw one pixel.
- `api.commands.line(x0, y0, x1, y1, color)`: draw a line.

Frame body example:

```json
{
  "clear": true,
  "commands": [
    { "df": [0, 0, 32, 8, "#000000"] },
    { "dt": [9, 0, "HELLO", "#00e5ff"] }
  ]
}
```

## Lifecycle rules

1. Open the dialog with localized controls.
2. Claim runtime before drawing.
3. Send an immediate first frame if the app should visibly start right away.
4. Stop timers when paused or stopped, but do not release runtime unless the app is closing.
5. Let the right-top close button release runtime and return to Flow.

The Stop or Pause button inside a Live should stop the app logic only. The display stays under runtime control until the user closes the app.

## Local development

Place modules under `mock-app-store/cast/` and add entries under `castApps` in `mock-app-store/list.json`. Serve the mock store with CORS enabled:

Serve the directory with any static HTTP server that sends CORS headers.

Open App Store > Live, install the app, then open it from My Apps > Live.
