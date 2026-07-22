# Recovered Requirements

This document summarizes the user requirements recovered from `/home/uniqueding/Workspace/awtrix3.bak`, especially `.sisyphus`, project docs, source files, and evidence logs. It is a restoration guide for `awtrix-light` and should be treated as the source of truth before making further changes.

No firmware, Web UI, build, or flashing change should be made unless it is covered here or explicitly approved by the user.

## Operating Rules

- Do not change features the user has not explicitly asked to change.
- If a problem appears, stop and ask the user before continuing.
- Keep custom `awtrix-light` source outside the upstream `awtrix3` tree when possible, then copy it into `awtrix3` during build.
- Changes to existing upstream AWTRIX3 files should be represented as patches.
- Do not automatically re-clone or reinitialize the `awtrix3` submodule on every build.
- Do not use Python for project build tooling; use shell scripts.
- Do not flash unless the user explicitly asks to flash.
- Treat `.sisyphus` notes as evidence, but verify against current source before restoring because several notes and source snapshots disagree.

## Product Goal

`awtrix-light` is an AWTRIX3 fork for Ulanzi/AWTRIX2-upgrade hardware with a redesigned Web UI and local app-management workflow.

The target experience is:

- A modern Web UI served from LittleFS.
- Custom login/auth flow without browser-native auth popups.
- Local/offline JSON app support.
- App Store and My Apps pages.
- Live/browser-runtime app support.
- Real-board firmware build and flashing path for Ulanzi/AWTRIX2 upgrade devices.
- Preservation of existing AWTRIX3 custom app behavior.

## Web UI Requirements

### Main UI

- The Web UI is vanilla JS/CSS/HTML, served from LittleFS.
- The root page `/` should act as a usable main entry and expose links/tabs for:
  - `设置`
  - `应用商店`
  - `我的应用`
- The UI should use Chinese visible labels where appropriate, but stable ASCII paths.
- The UI should remain responsive and usable on desktop and mobile.
- Web files can be updated independently from firmware when only HTML/CSS/JS changes are involved.

### Auth

- Firmware still uses HTTP Basic Auth internally.
- The Web UI should avoid browser-native auth dialogs.
- The UI should show a custom login form.
- Credentials should be encoded as Basic auth and stored in `sessionStorage` for the current browser session.
- All Web UI `fetch()` calls should inject the `Authorization: Basic ...` header once logged in.
- Static UI shell files and auth status/check routes must not trigger native browser auth popups.

### Settings

- Settings page/tab order should include:
  - Device
  - Network
  - Time
  - Integrations
  - Auth
  - Files
- Wi-Fi setup belongs under Network.
- Home Assistant fields belong under Integrations.
- Network and MQTT settings must not disappear when `/DoNotTouch.json` exists but is empty or corrupt.
- `/DoNotTouch.json` empty/corrupt handling is a required restoration item, but current backup evidence conflicts on whether source already contains the fix.

### Files

- File manager functionality should remain available.
- LittleFS usage display should be shown in the file toolbar area, not as a distracting page headline.
- File editor textarea should have a responsive useful height.

## JSON App Store Requirements

### Original Requirement

The recovered original request was to add support for the user's JSON apps, then add Web pages for `我的应用` and `应用商店`, where the app store can install new apps and My Apps can show current apps.

### Scope

- Use local/offline bundled app-store data.
- Do not build a remote marketplace.
- Do not add accounts, ratings, comments, online package manager, app signing, remote search backend, or cloud backend.
- Do not add a new frontend framework.
- Do not add a new automated test framework solely for this feature.
- Preserve existing AWTRIX3 custom app storage and loading behavior.

### Routes

- `/app-store` renders `应用商店`.
- `/my-apps` renders `我的应用`.
- Visible labels may be Chinese.
- URL paths must stay ASCII.

### APIs

- Reuse existing `GET /api/apps` for current app listing.
- Add or preserve `GET /api/app-store`.
- Add or preserve `POST /api/app-store/install`.

Expected install responses:

- Success: HTTP `200`, `{"success":true,"id":"demo-clock"}`.
- Duplicate: HTTP `409`, `{"success":false,"error":"app already installed"}`.
- Missing app: HTTP `404`, `{"success":false,"error":"app not found"}`.
- Malformed request: HTTP `400`, `{"success":false,"error":"invalid request"}`.
- Invalid app JSON: HTTP `500`, `{"success":false,"error":"error parsing app json"}`.

### Storage

- Installed JSON apps must use the existing custom app mechanism.
- Persistence path is `/CUSTOMAPPS/{name}.json`.
- Installation should go through `DisplayManager_::parseCustomPage()` rather than bypassing the existing custom app flow.
- App JSON must be saved by injecting or preserving `save:true` and allowing the existing persistence path to write it.
- Duplicate detection must check both:
  - `/CUSTOMAPPS/{name}.json`
  - runtime app names from `GET /api/apps`

### Demo App

The historical MVP store contained one deterministic fixture app:

- `id`: `demo-clock`
- `name`: `Demo Clock`
- `version`: `1.0.0`
- `author`: `AWTRIX Local`
- The public manifest must not expose private install JSON fields such as `json`, `text`, `duration`, or `save`.

## My Apps Requirements

- My Apps must list current apps from `GET /api/apps`.
- It must show native apps and custom apps.
- It should show installed `demo-clock` after installation.
- Later evidence shows `/api/apps` was extended to include native/custom type and enabled metadata.
- Disabled custom apps should be visible if needed for management UI.
- App management UI may include enable/disable, reorder, and settings controls only if restoring the later material app-management behavior.

## App Management Requirements

Later `.sisyphus` evidence shows the project evolved beyond a read-only My Apps MVP.

Preserve or restore these behaviors when restoring the later UI:

- Material-style app management page.
- Enable/disable switches.
- Settings sheet per app.
- Reorder support via `/api/reorder`.
- Mutations should use existing endpoints where possible:
  - `/api/reorder`
  - `/api/apps`
  - `/api/settings`
- Clicking an enable switch must not also open the row settings sheet.
- The switch label and checkbox should stop event propagation; the checkbox change should perform the toggle.

## Store UI Requirements

- Store should support Flow and Animation sections.
- Store display should be flat under Flow/Animation instead of nested category subsections.
- Store cards should use a responsive grid.
- Install buttons should be pinned to card bottom.
- Skeleton loading should replace plain loading text.
- Store search and tag filters should exist for the App tab.
- Search/tag filters should not appear on the Live tab.
- Search should match app name, description, and tags.
- Tag filters should be generated from app `tags` arrays.
- Historical recovered notes listed `payload.name`, `item.name`, `item.id`, then a fallback name as the install-name priority. That order is superseded by the current intentional app-store behavior.
- For app-store installs, `item.id` is the canonical install name. This keeps filenames and app IDs stable even when display names or payload names change.
- Only when `item.id` is absent should installation fall back to `payload.name`, then `item.name`, then a generated fallback name.

## Animation App Requirements

Recovered legacy notes described animation settings with these fields:

- `animation_fps`
- `animation_repeat`
- `displayDuration`

Those names describe an earlier indexed animation format and should not be treated as current runtime firmware settings. In the current GIF-backed model, each committed app-store GIF is colocated with its manifest, the regular Animation custom app definition persists as `/CUSTOMAPPS/{name}.json`, its installed GIF asset lives at `/ICONS/{name}.gif`, and settings expose top-level `duration`. There is no indexed source tree or asset generator.

The recovered intent still applies: irrelevant display fields should not be shown for animation apps, including text/icon/alignment/scroll/rainbow/bounce/pushIcon/fadeText/blinkText style controls unless explicitly needed for a specific app type.

## Flow App Requirements

- Flow app settings must preserve per-app input fields.
- If `/api/custom` omits `inputs`, the UI should fall back to fetching raw `/{name}.json`.
- The Bilibili followers JSON app historically used:
  - icon `27106`
  - URL template with `{{uid}}`
  - display text `{{relation.data.follower}}`

## Live Requirements

### Concept

- User-facing name is `Live`.
- Compatibility names may remain `castApps` and `type: "live"`.
- Live apps run in the browser and render/send frames to the device runtime.
- Live should not be confused with persisted JSON custom apps.

### Storage

- Installed Live manifests live at `/Apps/cast/<id>.json`.
- Live JS modules are cached to `/Apps/cast/<id>.js`.
- `entryOriginal` preserves the remote source URL.
- Browser `localStorage` can be used as a mirror/fallback, but LittleFS is the persistent source.

### Runtime

- Live claims `/api/runtime/*` while running.
- Live sends frames to the device display runtime.
- Live releases runtime on close.
- Live app UI should support descriptor-driven dialogs.

### Live API v2

Historical docs describe these browser APIs:

- `api.renderDialog(desc)`
- `api.getConfig()`
- `api.updateDisplay(id, value)`
- `api.onButton(callback)`
- `api.enableButtons()`

The backup docs say 8 Live apps were refactored to this descriptor-based API. Restore only after checking current source and mock store assets.

### Hardware Buttons

The backup docs claim hardware button passthrough existed:

- `recordButton(byte)`
- `getRuntimeButtons()`
- `/api/runtime/buttons`
- edge-triggered left/middle/right polling

However, source search in the backup did not confirm those C++ symbols. Treat this as a requirement/design note, not proven current implementation.

## Live Preview Requirements

The Web UI historically included a live preview canvas on My Apps/runtime areas.

Expected behavior:

- Fetch `/api/screen`.
- Draw the 32x8 screen state into a browser canvas.
- Provide previous/next app controls via:
  - `/api/previousapp`
  - `/api/nextapp`
- Optional PNG download/export is a Web UI helper only.

This feature does not affect the physical device display, but it is part of the recovered Web UI unless the user explicitly approves removal.

## Native App Requirements

### Bilibili Follower App

Historical real-board evidence shows a native Bilibili follower app was implemented and verified.

Requirements:

- Native app name: `Bilibili`.
- Icon: `icon_bilibili` or an available equivalent.
- Enable flag: `BILI`.
- UID setting: `BILI_UID`, default `19445169`.
- Color setting: `BILI_COL`.
- API request uses GET:
  - `https://api.bilibili.com/x/relation/stat?vmid=<BILI_UID>&jsonp=jsonp`
- Response parser uses `data.follower`.
- Host verification showed POST returned 405, while GET returned 200.
- Real-board evidence showed `/api/apps`, `/api/settings`, `/my-apps`, `/api/switch`, `/api/stats`, and `/api/screen` worked with this app.

## Build And Tooling Requirements

- Build tooling should be shell-based, not Python-based.
- Project-owned build scripts should live in `awtrix-light`, not inside upstream source when avoidable.
- `awtrix3/` is the build target/submodule, not the primary home for custom source.
- Build should not automatically delete/re-clone/reinitialize `awtrix3` every time.
- Generated files such as bundled `app.js.min` and embedded web asset headers should be treated as build outputs.
- C++ changes require firmware rebuild.
- HTML/CSS/JS changes can be uploaded to LittleFS without firmware rebuild when not embedded into firmware.

## Firmware And Flashing Requirements

### Environments

Historical backup includes these relevant PlatformIO environments:

- `ulanzi` for real Ulanzi hardware.
- `awtrix2_upgrade` for AWTRIX2 upgrade path.
- `wokwi_ulanzi` existed historically for simulation but was later removed from active source/config in real-board cleanup evidence.

Current restoration should prefer real-board paths unless the user explicitly asks for Wokwi work.

### AWTRIX2 Upgrade Flashing

For AWTRIX2 upgrade devices:

- Build environment: `awtrix2_upgrade`.
- Firmware-only flashing writes app firmware at offset `0x10000`.
- Do not erase flash.
- Do not write NVS, LittleFS, partitions, or bootloader during firmware-only update.
- Back up LittleFS before flashing when using the historical script behavior.
- Historical LittleFS backup range:
  - offset `0x290000`
  - length `0x160000`

### Full Flash Manifest Offsets

Historical full flasher manifest used:

- `bootloader.bin`: offset `4096`
- `partitions.bin`: offset `32768`
- `boot_app0.bin`: offset `57344`
- `firmware.bin`: offset `65536`

### Size Constraints

- Firmware size is critical on AWTRIX2 upgrade builds.
- The practical checked limit seen in the current build path was about `1310720` bytes.
- A produced `firmware.bin` larger than the PlatformIO app limit is suspicious even if upload succeeds.
- If firmware is too large, do not blindly remove features. First identify authorized removals and size-saving options.
- Historical docs say if only 192KB flash is available, use the AWTRIX online flasher because it writes all partitions; the Ulanzi web updater only writes the program partition.

## Wokwi Requirements And Status

Wokwi was used earlier for development and QA, then later evidence says it was removed for real-board focus.

Historical Wokwi facts:

- `wokwi_ulanzi` built successfully.
- Wokwi gateway forwarded `localhost:8180` to target port 80.
- Wokwi live QA was blocked by token/quota problems, not proven firmware failure.
- The quota error was:
  - `API Error: You have used up your Free plan monthly CI minute quota.`
- Later cleanup removed Wokwi-specific source/config and restored normal real-board setup.

Do not reintroduce Wokwi-specific behavior unless the user explicitly asks.

## Allowed Removals

The user explicitly allowed these removals:

- Built-in demo app-store backend/source.
- `stopwatch` browser code.
- `countdown` browser code.
- `interactive demo` browser code.

These removals should not be reversed unless the user asks.

## Not Authorized For Removal

These were not authorized for removal and should be preserved/restored unless the user explicitly approves removal:

- Live preview canvas UI.
- Live store tag/filter behavior.
- Live install/cache/runtime support.
- App/My Apps management behavior.
- Settings restoration behavior.
- Existing Flow/Animation store functionality.
- Bilibili native app if restoring the later backup feature set.

## Evidence-Backed Real-Board QA Targets

Historical real-board evidence used:

- Board IP: `192.168.31.4`.
- Serial device: `/dev/ttyUSB1`.
- PlatformIO env: `ulanzi`.

Verified behaviors included:

- Build and upload passed.
- `/` returned a Web entry page.
- `/app-store` returned 200.
- `/my-apps` returned 200.
- `/api/app-store` returned a JSON list with one `demo-clock` item.
- First `demo-clock` install returned 200 success.
- Duplicate install returned 409.
- Missing app returned 404.
- Malformed install returned 400.
- `/api/apps` returned `Time`, `Battery`, and `demo-clock`.
- Serial logs showed long-running app rotation among `Time`, `Battery`, and `demo-clock`.
- Network/MQTT settings schema was restored after empty `/DoNotTouch.json`.
- Material app management UI passed HTTP checks.
- Bilibili native app could be enabled, switched to, and produced nonzero `/api/screen` data.

## Known Conflicts To Verify Before Restoring

Several recovered notes conflict with the backup source snapshot:

1. Hardware button passthrough is documented, but C++ symbols/endpoints were not found in the backup source search.
2. Notes say `/` was changed to always serve a Chinese landing page, but source evidence may still show fallback behavior.
3. Notes say empty/corrupt `/DoNotTouch.json` handling was fixed, but source evidence may still show early returns on deserialize errors.
4. Notes say Wokwi paths were removed later, but backup still contains Wokwi docs/evidence and may contain older Wokwi source/config depending on snapshot state.

Before porting any of these, verify the exact current source and decide whether restoring the note behavior or source behavior is intended.

## Restoration Priority

If restoration is requested, proceed in this order:

1. Stop and confirm the exact feature set with the user.
2. Restore build safety first: shell tools, no automatic submodule reset, no automatic flashing.
3. Restore required Web/auth shell without removing existing features.
4. Restore JSON app storage/API path using `/CUSTOMAPPS` and existing `parseCustomPage()` flow.
5. Restore `/app-store`, `/my-apps`, and `/` entry behavior.
6. Restore App management UI only after API support is verified.
7. Restore Live install/cache/runtime support.
8. Restore live preview canvas and runtime controls.
9. Restore Bilibili native app if the later feature set is desired.
10. Address firmware size only with user-approved removals or reversible build/config changes.
11. Compile first; flash only after explicit user approval.

## Source Evidence Used

Primary sources:

- `/home/uniqueding/Workspace/awtrix3.bak/AGENTS.md`
- `/home/uniqueding/Workspace/awtrix3.bak/.sisyphus/plans/json-app-web-pages.md`
- `/home/uniqueding/Workspace/awtrix3.bak/.sisyphus/notepads/json-app-web-pages/*.md`
- `/home/uniqueding/Workspace/awtrix3.bak/.sisyphus/evidence/*`
- `/home/uniqueding/Workspace/awtrix3.bak/docs/*.md`
- `/home/uniqueding/Workspace/awtrix3.bak/src/*`
- `/home/uniqueding/Workspace/awtrix3.bak/www/*`
- `/home/uniqueding/Workspace/awtrix3.bak/mock-app-store/*`
- `/home/uniqueding/Workspace/awtrix3.bak/tools/flash_awtrix2_firmware_only.sh`
- `/home/uniqueding/Workspace/awtrix3.bak/platformio.ini`
- `/home/uniqueding/Workspace/awtrix3.bak/awtrix_partition.csv`
