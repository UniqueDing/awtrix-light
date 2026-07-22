#!/usr/bin/env python3
# pyright: reportMissingImports=false

import argparse
import base64
import io
import json
import shutil
import sys
from pathlib import Path

from PIL import Image, __version__ as pillow_version


EXPECTED_PILLOW_VERSION = "12.3.0"
MAX_FRAME_COUNT = 240
EXPECTED_IDS = (
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
    "snake-animation",
    "snake",
    "swirlin",
    "swirlout",
    "theaterchase",
    "twinklingstars",
)

INDEXED_DESCRIPTION_PREFIX = "Indexed animation converted from "
GIF_DESCRIPTION_PREFIX = "GIF-backed animation generated from "
INDEXED_DESCRIPTION_CN_PREFIX = "基于索引位图的"
INDEXED_DESCRIPTION_CN_SUFFIX = "动画。"
GIF_DESCRIPTION_CN_SUFFIX = "生成的GIF动画。"


def parse_args():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Generate deterministic AWTRIX animation GIFs and runtime manifests."
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=root / "app-store/sources/animation",
    )
    parser.add_argument(
        "--asset-dir",
        type=Path,
        default=root / "app-store/assets/animation",
    )
    parser.add_argument(
        "--manifest-dir",
        type=Path,
        default=root / "app-store/apps/animation",
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=root / "app-store/list.json",
    )
    return parser.parse_args()


def write_if_changed(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == data:
        return
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_bytes(data)
    temporary.replace(path)


def preserve_initial_sources(source_dir, manifest_dir):
    if source_dir.exists():
        return
    indexed = []
    for path in sorted(manifest_dir.glob("*.json")):
        document = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(document.get("animation", {}).get("frames"), list):
            indexed.append(path)
    if tuple(path.stem for path in indexed) != EXPECTED_IDS:
        raise ValueError(
            "source directory is missing and runtime manifests are not the 20 indexed originals"
        )
    source_dir.mkdir(parents=True)
    for path in indexed:
        shutil.copyfile(path, source_dir / path.name)


def frame_delays_centiseconds(frame_count, fps):
    if not isinstance(fps, int) or fps <= 0 or fps > 100:
        raise ValueError(f"unsupported fps: {fps!r}")
    boundaries = [(frame * 100 + fps // 2) // fps for frame in range(frame_count + 1)]
    delays = [boundaries[index + 1] - boundaries[index] for index in range(frame_count)]
    if min(delays, default=0) < 1:
        raise ValueError(f"fps cannot be represented in GIF centiseconds: {fps}")
    return delays


def decode_frames(document, source_path):
    animation = document.get("animation")
    if not isinstance(animation, dict) or animation.get("format") != "indexed":
        raise ValueError(f"{source_path}: expected indexed animation data")
    width = animation.get("width")
    height = animation.get("height")
    bits = animation.get("bits")
    palette_values = animation.get("palette")
    encoded_frames = animation.get("frames")
    if (width, height, bits) != (32, 8, 4):
        raise ValueError(f"{source_path}: expected 32x8 4-bit animation")
    assert isinstance(width, int) and isinstance(height, int)
    if animation.get("repeat") != 0:
        raise ValueError(f"{source_path}: expected repeat=0")
    if not isinstance(palette_values, list) or not 1 <= len(palette_values) <= 16:
        raise ValueError(f"{source_path}: invalid palette")
    if not isinstance(encoded_frames, list) or not encoded_frames:
        raise ValueError(f"{source_path}: animation has no frames")
    if len(encoded_frames) > MAX_FRAME_COUNT:
        raise ValueError(
            f"{source_path}: animation has {len(encoded_frames)} frames; "
            f"maximum is {MAX_FRAME_COUNT}"
        )

    palette = []
    for color in palette_values:
        if not isinstance(color, str) or len(color) != 7 or color[0] != "#":
            raise ValueError(f"{source_path}: invalid palette color {color!r}")
        try:
            palette.extend(bytes.fromhex(color[1:]))
        except ValueError as error:
            raise ValueError(f"{source_path}: invalid palette color {color!r}") from error
    fps = animation.get("fps")
    if not isinstance(fps, int):
        raise ValueError(f"{source_path}: fps must be an integer")
    decoded_frames = []
    expected_bytes = width * height // 2
    for frame_index, encoded in enumerate(encoded_frames):
        try:
            packed = base64.b64decode(encoded, validate=True)
        except (ValueError, TypeError) as error:
            raise ValueError(f"{source_path}: frame {frame_index} is not valid base64") from error
        if len(packed) != expected_bytes:
            raise ValueError(f"{source_path}: frame {frame_index} has invalid size")
        pixels = []
        for value in packed:
            pixels.extend((value >> 4, value & 0x0F))
        if max(pixels) >= len(palette_values):
            raise ValueError(f"{source_path}: frame {frame_index} exceeds its palette")
        decoded_frames.append(pixels)

    palette.extend([0] * (768 - len(palette)))
    frames = []
    for frame_index, pixels in enumerate(decoded_frames):
        alias_index = 16 + frame_index
        source_index = pixels[0]
        palette[alias_index * 3 : alias_index * 3 + 3] = palette[
            source_index * 3 : source_index * 3 + 3
        ]
        pixels[0] = alias_index
        image = Image.new("P", (width, height))
        image.putpalette(palette)
        image.putdata(pixels)
        frames.append(image)
    return frames, frame_delays_centiseconds(len(frames), fps)


def runtime_description(description, asset_id):
    if asset_id == "snake-animation":
        if description != "Indexed bitmap Snake animation for Flow rotation.":
            raise ValueError(f"{asset_id}: unexpected indexed English description")
        return "GIF-backed Snake animation generated for Flow rotation."
    if not description.startswith(INDEXED_DESCRIPTION_PREFIX):
        raise ValueError(f"{asset_id}: unexpected indexed English description")
    return GIF_DESCRIPTION_PREFIX + description.removeprefix(INDEXED_DESCRIPTION_PREFIX)


def runtime_description_cn(description, asset_id):
    if asset_id == "snake-animation":
        if description != "基于索引位图的贪吃蛇动画，用于Flow轮播。":
            raise ValueError(f"{asset_id}: unexpected indexed Chinese description")
        return "为Flow轮播生成的贪吃蛇GIF动画。"
    if not description.startswith(INDEXED_DESCRIPTION_CN_PREFIX) or not description.endswith(
        INDEXED_DESCRIPTION_CN_SUFFIX
    ):
        raise ValueError(f"{asset_id}: unexpected indexed Chinese description")
    effect = description[
        len(INDEXED_DESCRIPTION_CN_PREFIX) : -len(INDEXED_DESCRIPTION_CN_SUFFIX)
    ]
    return f"由{effect}{GIF_DESCRIPTION_CN_SUFFIX}"


def runtime_manifest(document, asset_id):
    runtime = {}
    for key, value in document.items():
        if key == "animation":
            continue
        if key == "description":
            runtime[key] = runtime_description(value, asset_id)
            continue
        if key == "description-cn":
            runtime[key] = runtime_description_cn(value, asset_id)
            continue
        if key == "icon":
            runtime["icon"] = asset_id
            continue
        if key == "displayDuration":
            runtime["duration"] = value
            runtime["animationAsset"] = f"../../assets/animation/{asset_id}.gif"
            continue
        runtime[key] = value
    if "duration" not in runtime:
        raise ValueError(f"{asset_id}: source has no displayDuration")
    return runtime


def reject_unexpected_outputs(asset_dir, manifest_dir, expected_ids):
    expected = set(expected_ids)
    unexpected_assets = tuple(
        path.name for path in sorted(asset_dir.glob("*.gif")) if path.stem not in expected
    )
    unexpected_manifests = tuple(
        path.name for path in sorted(manifest_dir.glob("*.json")) if path.stem not in expected
    )
    if unexpected_assets or unexpected_manifests:
        raise ValueError(
            "unexpected generated outputs: "
            f"GIFs={unexpected_assets}, manifests={unexpected_manifests}"
        )


def update_catalog(catalog_path, sources):
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    items = catalog.get("apps", {}).get("animation")
    if not isinstance(items, list):
        raise ValueError(f"{catalog_path}: expected animation catalog entries")
    items_by_id = {}
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            raise ValueError(f"{catalog_path}: invalid animation catalog entry")
        items_by_id[item["id"]] = item
    source_ids = tuple(sorted(sources))
    if tuple(sorted(items_by_id)) != source_ids:
        raise ValueError(f"{catalog_path}: animation IDs do not match indexed sources")
    for asset_id, source in sources.items():
        item = items_by_id[asset_id]
        if item.get("version") != "2.0.0" or source.get("version") != "2.0.0":
            raise ValueError(f"{asset_id}: expected catalog and source version 2.0.0")
        tags = item.get("tags")
        if not isinstance(tags, list) or "gif" not in {str(tag).lower() for tag in tags}:
            raise ValueError(f"{asset_id}: catalog tags must include gif")
        item["description"] = runtime_description(source.get("description"), asset_id)
        item["description-cn"] = runtime_description_cn(source.get("description-cn"), asset_id)
    write_if_changed(
        catalog_path,
        (json.dumps(catalog, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    )


def generate_one(source_path, asset_dir, manifest_dir):
    document = json.loads(source_path.read_text(encoding="utf-8"))
    asset_id = source_path.stem
    if document.get("name") != asset_id or document.get("type") != "animation":
        raise ValueError(f"{source_path}: name/type does not match its stable ID")
    frames, delays = decode_frames(document, source_path)
    gif_data = io.BytesIO()
    frames[0].save(
        gif_data,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=[delay * 10 for delay in delays],
        loop=0,
        disposal=1,
        optimize=False,
        interlace=False,
    )
    manifest = runtime_manifest(document, asset_id)
    manifest_data = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

    write_if_changed(asset_dir / f"{asset_id}.gif", gif_data.getvalue())
    write_if_changed(manifest_dir / f"{asset_id}.json", manifest_data)


def main():
    args = parse_args()
    if pillow_version != EXPECTED_PILLOW_VERSION:
        raise RuntimeError(
            f"Pillow {EXPECTED_PILLOW_VERSION} is required, found {pillow_version}; "
            "install tools/animation-assets-requirements.txt"
        )
    preserve_initial_sources(args.source_dir, args.manifest_dir)
    sources = sorted(args.source_dir.glob("*.json"))
    source_ids = tuple(path.stem for path in sources)
    if source_ids != EXPECTED_IDS:
        raise ValueError(f"expected animation IDs {EXPECTED_IDS}, found {source_ids}")
    reject_unexpected_outputs(args.asset_dir, args.manifest_dir, source_ids)
    args.asset_dir.mkdir(parents=True, exist_ok=True)
    args.manifest_dir.mkdir(parents=True, exist_ok=True)
    source_documents = {}
    for source_path in sources:
        source_documents[source_path.stem] = json.loads(source_path.read_text(encoding="utf-8"))
        generate_one(source_path, args.asset_dir, args.manifest_dir)
    update_catalog(args.catalog, source_documents)
    print(f"generated {len(sources)} animation GIFs and runtime manifests")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
