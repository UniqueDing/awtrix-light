# awtrix-light-apps

Repository-owned local app store content for AWTRIX Light development and testing.

## Structure

- `app-store/list.json` - app catalog index.
- `app-store/apps/flow/` - Flow app manifests.
- `app-store/apps/animation/` - committed animation manifests and sibling 32x8 GIFs.
- `app-store/apps/live/` - Live app scripts and manifests.

## Animation assets

Animation GIFs are committed ready for installation beside their manifests. There
is no indexed source tree or asset generator. Validate the catalog, manifests, and
GIF files using only Python's standard library:

```bash
python3 tests/animation_assets_test.py
```

Runtime manifests use top-level `icon` and `duration` fields. Their
`animationAsset` value is `./<stable-id>.gif`, identifying the sibling GIF that an
installer must copy to `/ICONS/<icon>.gif`.

GIF-backed animation releases use stable catalog IDs for the catalog entry,
manifest filename, manifest icon, and GIF filename. The browser installer accepts
only the exact sibling `apps/animation/<stable-id>.gif` URL on the manifest origin,
validates the final redirect URL, limits assets to 128 KiB, and requires a complete
32x8 GIF87a/GIF89a file. Replacing an animation requires updating the committed GIF
directly and bumping the catalog and manifest versions so existing installations
can be offered the reinstall/update action.

## Local server

From the repository root, run:

```bash
python3 tools/serve_app_store.py
```

The catalog is available at `http://localhost:8091/list.json` with CORS enabled.
