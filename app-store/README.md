# awtrix-light-apps

Repository-owned local app store content for AWTRIX Light development and testing.

## Structure

- `app-store/list.json` - app catalog index.
- `app-store/apps/flow/` - Flow app manifests.
- `app-store/apps/animation/` - animation app manifests.
- `app-store/apps/live/` - Live app scripts and manifests.

## Local server

From the repository root, run:

```bash
python3 tools/serve_app_store.py
```

The catalog is available at `http://localhost:8091/list.json` with CORS enabled.
