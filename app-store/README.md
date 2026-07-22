# awtrix-light-apps

Repository-owned local app store content for AWTRIX Light development and testing.

## Structure

- `app-store/list.json` - app catalog index.
- `app-store/apps/flow/` - Flow app manifests.
- `app-store/apps/animation/` - generated GIF-backed animation app manifests.
- `app-store/sources/animation/` - durable indexed animation source data.
- `app-store/assets/animation/` - generated 32x8 animation GIFs.
- `app-store/apps/live/` - Live app scripts and manifests.

## Animation generation

Install the exact build dependency from `tools/animation-assets-requirements.txt`, then
run the generator from any directory:

```bash
python3 -m pip install -r tools/animation-assets-requirements.txt
tools/generate_animation_assets.sh
python3 tests/animation_assets_test.py
```

The shell entrypoint uses `python3` by default. Set `PYTHON` to select the
interpreter where the pinned Pillow dependency is installed.

The generator preserves the original indexed JSON in `app-store/sources/animation/`
and writes the runtime manifests and GIF assets from that source. Runtime manifests
describe the generated GIF-backed delivery in English and Chinese while the durable
source descriptions retain their indexed-data semantics. Runtime manifests use
top-level `icon` and `duration` fields. Their `animationAsset` path is relative to the
manifest and identifies the GIF that an installer must copy to `/ICONS/<icon>.gif`.

GIF-backed animation releases use stable catalog IDs for both the manifest icon and
the installed filename. The browser installer accepts only the exact
`assets/animation/<stable-id>.gif` URL on the manifest origin, validates the final
redirect URL, limits assets to 128 KiB, and requires a complete 32x8 GIF87a/GIF89a
file. Changing an indexed animation to this runtime format therefore requires a
catalog and source-manifest version bump so existing installations can be offered
the reinstall/update action.

GIF frame delays are stored in centiseconds. For frame boundary `n` and source FPS
`f`, the generator uses integer half-up rounding of `n * 100 / f`; each frame delay
is the difference between adjacent rounded boundaries. This deterministic policy
alternates delays where necessary (for example, 8 FPS uses 13, 12, 13, 12
centiseconds) while preserving the requested average rate.

Pillow normally merges adjacent identical frames. The generator assigns one pixel
in every frame a frame-specific palette alias with the same RGB value, preserving
the source pixels while retaining every source frame and its individual delay. The
alias range supports at most 240 source frames, and the generator rejects larger
animations. It also rejects unexpected GIF or runtime-manifest files in the output
directories so stale generated files cannot silently remain in the app store.

## Local server

From the repository root, run:

```bash
python3 tools/serve_app_store.py
```

The catalog is available at `http://localhost:8091/list.json` with CORS enabled.
