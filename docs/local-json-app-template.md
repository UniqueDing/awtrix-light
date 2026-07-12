# Local JSON Flow Template

This document describes the JSON format used by the local AWTRIX Flow Store in `src/AppStore.cpp` and by saved Flow definitions under `/Apps/flow/<flow-id>.json`.

## Flow Store manifest entry

Add one Flow entry to `appStoreManifestJson`:

```json
{
  "id": "example-flow",
  "name": "Example Flow",
  "version": "1.0.0",
  "author": "AWTRIX Local",
  "description": "Short description shown in the Flow Store",
  "icon": "example-icon"
}
```

Rules:

- `id` is the install id and saved file name: `/Apps/flow/<id>.json`.
- `icon` should match a file uploaded through the AWTRIX icon tool when possible: `/ICONS/<icon>.jpg` or `/ICONS/<icon>.gif`.
- Keep `id` stable. Changing it creates a different installed Flow.

## Standard Flow JSON

This is the recommended base Flow template returned by `getAppStoreAppJson(id)`:

```json
{
  "text": "Example",
  "icon": "example-icon",
  "color": "#ffffff",
  "background": "#000000",
  "duration": 10,
  "save": true,

  "align": "default",
  "showIcon": "default",
  "underline": "default",
  "displayDuration": 0,

  "noScroll": false,
  "textCase": 0,
  "scrollSpeed": -1,
  "textOffset": 0,
  "iconOffset": 0
}
```

Recommended required fields:

- `text`: string or fragment array displayed on the matrix.
- `icon`: icon name, without extension, or a base64 image string.
- `duration`: Flow payload duration in seconds for the renderer.
- `save`: set to `true` for local Flow Store entries so the JSON is written to LittleFS.

Display override fields:

- `align`: `default`, `left`, `center`, or `right`.
- `showIcon`: `default`, `on`, or `off`.
- `underline`: `default`, `on`, or `off`.
- `displayDuration`: seconds. Use `0` to follow the global app duration.

Common optional fields supported by the parser:

- `color`, `background`
- `progress`, `progressC`, `progressBC`
- `bar`, `line`, `barBC`, `autoscale`
- `draw`
- `effect`, `effectSettings`
- `rainbow`
- `pushIcon`
- `textCase`
- `lifetime`, `lifetimeMode`
- `bounce`
- `iconOffset`, `textOffset`
- `scrollSpeed`
- `topText`
- `fadeText`, `blinkText`
- `center`
- `noScroll`
- `overlay`
- `gradient`
- `repeat`

## Bilibili followers Flow JSON

Use this template for the Bilibili integration:

```json
{
  "text": "Bilibili",
  "icon": "bilibili",
  "integration": "bilibili",
  "bilibiliUid": "",
  "color": "#ffffff",
  "duration": 10,
  "save": true,

  "align": "default",
  "showIcon": "default",
  "underline": "default",
  "displayDuration": 0
}
```

Rules:

- `integration` must be `bilibili`.
- `bilibiliUid` is intentionally empty in the store template. The Flow installs disabled and cannot be enabled until the user fills this value in the app settings.
- The renderer fetches followers from `https://api.bilibili.com/x/relation/stat?vmid=<uid>&jsonp=jsonp`.
- The LED icon uses `/ICONS/bilibili.jpg` or `/ICONS/bilibili.gif` first, then falls back to the built-in bitmap.

## Minimal example

```json
{
  "text": "Hello",
  "icon": "hello",
  "duration": 10,
  "save": true,
  "align": "default",
  "showIcon": "default",
  "underline": "default",
  "displayDuration": 0
}
```

## Conditional display branches

`display` may also be an array. Branches are evaluated from top to bottom on every render. The first matching branch becomes the active display object. Keep a `default` branch so the Flow always has a fallback.

```json
{
  "name": "weather-example",
  "sources": [
    {
      "id": "weather",
      "type": "http",
      "url": "https://example.local/weather.json",
      "responseType": "json",
      "interval": 300
    }
  ],
  "display": [
    {
      "if": { "source": "weather.condition", "op": "==", "value": "sunny" },
      "text": "{{weather.temp}}C",
      "icon": "sun"
    },
    {
      "if": { "source": "weather.condition", "op": "==", "value": "rain" },
      "text": "{{weather.temp}}C",
      "icon": "rain"
    },
    {
      "default": true,
      "text": "{{weather.temp}}C",
      "icon": "cloud"
    }
  ],
  "save": true
}
```

Supported `if` fields:

- `source`: placeholder path such as `weather.condition`, `year.progress`, or an MQTT topic name.
- `op`: `exists`, `not_exists`, `==`, `!=`, `>`, `>=`, `<`, `<=`, `between`, `contains`, `starts_with`, `ends_with`, or `in`.
- `value`: comparison value for equality, comparison, string, and `in` checks.
- `min` and `max`: inclusive bounds for `between`.

Branch fields currently applied at runtime: `text`, `icon`, `color`, `background`, and `progress`.

## Formula source

Use `type: "formula"` when a value can be computed on the device without HTTP, Home Assistant, or MQTT. Formula sources produce a JSON payload, so display placeholders can read fields with `{{sourceId.fieldName}}`.

```json
{
  "name": "yearprogress",
  "sources": [
    {
      "id": "year",
      "type": "formula",
      "kind": "time_progress",
      "interval": 3600,
      "fields": {
        "progress": "floor(yearProgress())",
        "text": "concat(progress, '%')",
        "icon": "2230",
        "dayOfYear": "dayOfYear()",
        "daysInYear": "daysInYear()"
      }
    }
  ],
  "display": {
    "text": "{{year.text}}",
    "icon": "{{year.icon}}",
    "progress": "{{year.progress}}"
  },
  "save": true
}
```

Formula fields are evaluated in declaration order, so later fields may reference earlier fields by name. The first implementation intentionally supports only a small safe subset:

- String literals: `'%'` or `"%"`
- Numeric constants: `2230`, `12.5`
- Earlier formula fields: `progress`
- Functions: `floor(x)`, `round(x)`, `concat(a, b, ...)`
- Time helpers: `yearProgress()`, `dayProgress()`, `monthProgress()`, `dayOfYear()`, `daysInYear()`, `year()`, `month()`, `day()`

Formula is not JavaScript and does not execute arbitrary code. For complex domain logic such as lunar calendar conversion, use an external HTTP/HA source first, then apply `display` branches.

## Naming

- Flow: a device-run data display definition. Flows fetch HTTP/HA/MQTT/formula data and render through `display` rules. They continue running without the browser.
- Live: a browser-run program. Live require the Web UI to stay open and cast frames to the matrix through `/api/runtime/*`.

The current `/api/apps` name is kept for firmware compatibility, but installed Flow files now live under `/Apps/flow`, installed Animation files under `/Apps/animation`, and installed Live files under `/Apps/cast`.
