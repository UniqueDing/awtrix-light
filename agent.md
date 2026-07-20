# AWTRIX Light Agent Guide

## Source Ownership

- `src/` contains the maintained AWTRIX Light C++ sources. Keep files mirrored with
  `awtrix3/src/` before building; do not leave divergent implementations.
- `www/` contains Web UI sources. Generate browser assets with
  `tools/build_web_assets.sh build`, copy the generated `app.js.min` and
  `app.css.min` into `awtrix3/www/`, then run
  `tools/build_web_assets.sh embed awtrix3`.
- The main Web UI is gzip embedded in `awtrix3/src/web_assets.h`. Do not move it
  to LittleFS.

## Firmware Size Gate

- Ulanzi uses the default ESP32 OTA app slot of `0x140000` (`1310720` bytes).
- PlatformIO's ELF usage report is not the flash-image size gate. Always check
  the generated `awtrix3/.pio/build/ulanzi/firmware.bin` byte length.
- Reject an image larger than `1310720` bytes. Keep meaningful headroom when
  possible; the current verified image is `1284016` bytes.
- Build Ulanzi directly with PlatformIO Core 6.1.18. The GitHub Actions release
  path uses Node.js 22 and Python 3.13, and does not require Nix:

  ```bash
  cd awtrix3
  python3 -m platformio run -e ulanzi
  stat -c '%s' .pio/build/ulanzi/firmware.bin
  ```
- `shell.nix` remains an optional local development environment for VSCodium,
  Wokwi, and PlatformIO helpers. Local flashing can use `./build.sh --nix`; the
  default `./build.sh` path invokes the locally installed PlatformIO directly.

## Flashing

- Firmware-only updates can conflict with an existing partition table. Flash a
  matched full bundle: bootloader at `0x1000`, partitions at `0x8000`,
  `boot_app0` at `0xe000`, and firmware at `0x10000`.
- Confirm every segment's write hash and then verify `/version` and `/api/apps`.
- Do not flash an oversized image even if PlatformIO reports a successful ELF
  size check.

## Networking

- mDNS/DNS-SD advertising is intentionally disabled. Do not restore
  `MDNS.begin`, `_http._tcp`, or `_awtrix._tcp` registration without explicit
  approval.
- Preserve direct-IP HTTP, MQTT, Home Assistant MQTT discovery, AP captive DNS,
  and UDP `FIND_AWTRIX` discovery unless a request explicitly changes them.
- Integration-test endpoints must use request-local probes and never reconfigure
  or publish through the live MQTT/Home Assistant session.

## Verification

Run these before delivery when relevant:

```bash
node tests/app_localization_test.js
node tests/runtime_transport_test.js
node tests/cast_tools_stopwatch_test.js
python3 tests/runtime_protocol_fixture.py
python3 tests/integrations_test_routes.py
python3 tests/discovery_regression_test.py
python3 tests/ota_release_contract_test.py
python3 tests/ota_routes_test.py
python3 tests/release_firmware_contract_test.py
```
