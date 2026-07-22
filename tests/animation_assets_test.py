#!/usr/bin/env python3

import json
import struct
from pathlib import Path


root = Path(__file__).resolve().parents[1]
store_dir = root / "app-store"
animation_dir = store_dir / "apps/animation"
catalog = json.loads((store_dir / "list.json").read_text(encoding="utf-8"))
catalog_items = catalog["apps"]["animation"]
expected_ids = (
    "brickbreaker",
    "checkerboard",
    "colorwaves",
    "fade",
    "fireworks",
    "lookingeyes",
    "matrix",
    "movingline",
    "pacifica",
    "pingpong",
    "plasma",
    "plasmacloud",
    "radar",
    "ripple",
    "snake",
    "snake-animation",
    "swirlin",
    "swirlout",
    "theaterchase",
    "twinklingstars",
)

catalog_ids = tuple(sorted(item["id"] for item in catalog_items))
manifest_ids = tuple(sorted(path.stem for path in animation_dir.glob("*.json")))
gif_ids = tuple(sorted(path.stem for path in animation_dir.glob("*.gif")))

assert catalog_ids == expected_ids
assert manifest_ids == expected_ids
assert gif_ids == expected_ids

for item in catalog_items:
    asset_id = item["id"]
    manifest_path = animation_dir / f"{asset_id}.json"
    gif_path = animation_dir / f"{asset_id}.gif"
    runtime = json.loads(manifest_path.read_text(encoding="utf-8"))
    gif_bytes = gif_path.read_bytes()

    assert item["type"] == "animation"
    assert item["version"] == "2.0.0"
    assert item["manifest"] == f"apps/animation/{asset_id}.json"
    assert runtime["type"] == "animation"
    assert runtime["version"] == "2.0.0"
    assert runtime["name"] == asset_id
    assert runtime["icon"] == asset_id
    assert runtime["animationAsset"] == f"./{asset_id}.gif"
    assert (manifest_path.parent / runtime["animationAsset"]).resolve() == gif_path.resolve()
    assert item["description"] == runtime["description"]
    assert item["description-cn"] == runtime["description-cn"]

    tags = {tag.lower() for tag in item.get("tags", [])}
    expected_tags = {"animation", "flow", "gif"} if asset_id == "snake-animation" else {"animation", "effect", "gif"}
    assert tags == expected_tags
    assert "gif" in item["description"].lower()
    assert "GIF" in item["description-cn"]
    assert "indexed" not in item["description"].lower()
    assert "索引" not in item["description-cn"]

    assert len(gif_bytes) <= 128 * 1024
    assert gif_bytes[:6] in (b"GIF87a", b"GIF89a")
    assert struct.unpack("<HH", gif_bytes[6:10]) == (32, 8)
    assert gif_bytes.endswith(b"\x3b")

for obsolete_path in (
    store_dir / "sources",
    store_dir / "assets",
    root / "tools/generate_animation_assets.py",
    root / "tools/generate_animation_assets.sh",
    root / "tools/animation-assets-requirements.txt",
):
    assert not obsolete_path.exists()


print("animation asset contract: ok (20 colocated GIFs)")
