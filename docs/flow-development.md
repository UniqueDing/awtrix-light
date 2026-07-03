# Flow Development Tutorial

A Flow is a device-run data display. It fetches data on the AWTRIX device, applies display rules, and keeps working after the browser is closed.

Use a Flow for fan counts, dates, weather, Home Assistant state, progress bars, and other automatic information pages.

## 1. Create the store entry

Add an entry to the store list. In the mock store this is `mock-app-store/list.json` under `apps`.

```json
{
  "id": "lunar",
  "name": "lunar",
  "version": 2,
  "author": "AWTRIX Mock",
  "description": "Chinese lunar date display using the new Flow sources and display API",
  "icon": "70075",
  "manifest": "apps/lunar.json",
  "tags": ["lunar", "calendar", "flow"]
}
```

`id` is the install id. Installed Flow files are now saved on the device as `/Apps/flow/<id>.json`.

## 2. Define user inputs

Inputs are values the user can edit after installation. Use them for API URLs, usernames, entity ids, tokens, and other configuration.

```json
"inputs": [
  {
    "id": "apiUrl",
    "label": "Lunar API URL",
    "type": "text",
    "description": "HTTP endpoint returning lunarText, festival, and isHoliday.",
    "value": "https://example.com/api/lunar/today"
  }
]
```

Reference an input with `{{inputId}}`, for example `{{apiUrl}}`.

## 3. Add sources

Sources fetch or compute data. Each source has an `id`; display placeholders read values as `{{sourceId.field}}`.

```json
"sources": [
  {
    "id": "lunar",
    "type": "http",
    "method": "GET",
    "url": "{{apiUrl}}",
    "responseType": "json",
    "interval": 3600,
    "timeout": 8000,
    "headers": {}
  }
]
```

`interval` is seconds between fetches. Users can edit source intervals from My Apps > Flow > Flow settings. Pick a value that matches the data freshness; do not poll slow or rate-limited APIs too often.

Common source types:

- `http`: fetch JSON, text, number, or XML from an endpoint.
- `ha`: read Home Assistant state through the configured HA connection.
- `formula`: compute small built-in values on the device, such as year progress.

## 4. Render with display rules

Use `display` as either an object or an array of conditional branches. Branches are evaluated top to bottom; keep one `default` branch.

```json
"display": [
  {
    "if": { "source": "lunar.festival", "op": "exists" },
    "text": "{{lunar.festival}}",
    "icon": "70075",
    "color": "#ffcc00",
    "background": "#000000"
  },
  {
    "if": { "source": "lunar.isHoliday", "op": "==", "value": true },
    "text": "{{lunar.lunarText}}",
    "icon": "70075",
    "color": "#00ff99",
    "background": "#000000"
  },
  {
    "default": true,
    "text": "{{lunar.lunarText}}",
    "icon": "70075",
    "color": "#ffffff",
    "background": "#000000"
  }
]
```

Supported condition operators include `exists`, `not_exists`, `==`, `!=`, `>`, `>=`, `<`, `<=`, `between`, `contains`, `starts_with`, `ends_with`, and `in`.

## 5. Test locally

Run the mock store server from the repository:

Serve the directory with any static HTTP server that sends CORS headers.

Then point the AWTRIX app store to the mock store URL and install the Flow. After installation, check My Apps > Flow, edit inputs and intervals, and verify the live screen preview.

## Complete example

See `mock-app-store/apps/lunar.json` for a complete Flow using `inputs`, `sources`, `interval`, and conditional `display` rules.
