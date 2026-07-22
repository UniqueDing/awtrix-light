#!/usr/bin/env python3
# pyright: reportMissingImports=false

import base64
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, __version__ as pillow_version


root = Path(__file__).resolve().parents[1]
source_dir = root / "app-store/sources/animation"
asset_dir = root / "app-store/assets/animation"
manifest_dir = root / "app-store/apps/animation"
generator = root / "tools/generate_animation_assets.py"
requirements = root / "tools/animation-assets-requirements.txt"
expected_ids = tuple(
    sorted(
        item["id"]
        for item in json.loads((root / "app-store/list.json").read_text(encoding="utf-8"))["apps"]["animation"]
    )
)

generator_spec = importlib.util.spec_from_file_location("generate_animation_assets", generator)
assert generator_spec is not None and generator_spec.loader is not None
generator_module = importlib.util.module_from_spec(generator_spec)
generator_spec.loader.exec_module(generator_module)


assert pillow_version == "12.3.0"
assert requirements.read_text(encoding="ascii") == "Pillow==12.3.0\n"
assert len(expected_ids) == 20
assert tuple(sorted(path.stem for path in source_dir.glob("*.json"))) == expected_ids
assert tuple(sorted(path.stem for path in asset_dir.glob("*.gif"))) == expected_ids
assert tuple(sorted(path.stem for path in manifest_dir.glob("*.json"))) == expected_ids


def source_pixels(animation, encoded):
    packed = base64.b64decode(encoded, validate=True)
    indexes = []
    for value in packed:
        indexes.extend((value >> 4, value & 0x0F))
    palette = [tuple(bytes.fromhex(color[1:])) for color in animation["palette"]]
    return [palette[index] for index in indexes]


def expected_delays(frame_count, fps):
    boundaries = [(frame * 100 + fps // 2) // fps for frame in range(frame_count + 1)]
    return [boundaries[index + 1] - boundaries[index] for index in range(frame_count)]


def indexed_document(frame_count):
    encoded = base64.b64encode(bytes(128)).decode("ascii")
    return {
        "animation": {
            "format": "indexed",
            "width": 32,
            "height": 8,
            "bits": 4,
            "repeat": 0,
            "fps": 10,
            "palette": ["#000000"],
            "frames": [encoded] * frame_count,
        }
    }


frames, delays = generator_module.decode_frames(indexed_document(240), Path("boundary.json"))
assert len(frames) == 240
assert len(delays) == 240
try:
    generator_module.decode_frames(indexed_document(241), Path("boundary.json"))
except ValueError as error:
    assert str(error) == "boundary.json: animation has 241 frames; maximum is 240"
else:
    raise AssertionError("241 source frames must be rejected")


for asset_id in expected_ids:
    source = json.loads((source_dir / f"{asset_id}.json").read_text(encoding="utf-8"))
    runtime = json.loads((manifest_dir / f"{asset_id}.json").read_text(encoding="utf-8"))
    animation = source["animation"]
    assert runtime["type"] == "animation"
    assert runtime["version"] == "2.0.0"
    assert runtime["name"] == asset_id
    assert runtime["icon"] == asset_id
    assert runtime["duration"] == source["displayDuration"]
    assert runtime["animationAsset"] == f"../../assets/animation/{asset_id}.gif"
    assert runtime["description"] == generator_module.runtime_description(
        source["description"], asset_id
    )
    assert runtime["description-cn"] == generator_module.runtime_description_cn(
        source["description-cn"], asset_id
    )
    assert "indexed" not in runtime["description"].lower()
    assert "索引" not in runtime["description-cn"]
    assert "gif" in runtime["description"].lower()
    assert "GIF" in runtime["description-cn"]
    assert "displayDuration" not in runtime
    assert "animation" not in runtime
    for key, value in source.items():
        if key not in {"description", "description-cn", "icon", "displayDuration", "animation"}:
            assert runtime[key] == value

    gif_bytes = (asset_dir / f"{asset_id}.gif").read_bytes()
    assert gif_bytes.startswith(b"GIF89a")
    assert b"\x21\xf9\x04\x04" in gif_bytes
    assert b"\x21\xf9\x04\x05" not in gif_bytes
    with Image.open(asset_dir / f"{asset_id}.gif") as image:
        assert image.size == (32, 8)
        assert image.mode == "P"
        assert image.info.get("loop") == 0
        assert "transparency" not in image.info
        frame_count = getattr(image, "n_frames", 1)
        assert frame_count == len(animation["frames"])
        assert image.getpalette() is not None
        delays = expected_delays(frame_count, animation["fps"])
        for frame_index, encoded in enumerate(animation["frames"]):
            image.seek(frame_index)
            assert image.info["duration"] == delays[frame_index] * 10
            assert image.disposal_method == 1
            assert image.convert("RGB").size == (32, 8)
            assert list(image.convert("RGB").get_flattened_data()) == source_pixels(animation, encoded)


catalog = json.loads((root / "app-store/list.json").read_text(encoding="utf-8"))
for item in catalog["apps"]["animation"]:
    assert item["version"] == "2.0.0"
    runtime = json.loads((root / "app-store" / item["manifest"]).read_text(encoding="utf-8"))
    assert item["version"] == runtime["version"]
    assert item["description"] == runtime["description"]
    assert item["description-cn"] == runtime["description-cn"]
    assert "indexed" not in item["description"].lower()
    assert "索引" not in item["description-cn"]
    assert "gif" in item["description"].lower()
    assert "GIF" in item["description-cn"]
    assert "indexed" not in " ".join(item.get("tags", [])).lower()
    assert "gif" in " ".join(item.get("tags", [])).lower()


with tempfile.TemporaryDirectory() as temporary:
    temporary_root = Path(temporary)
    generated_assets = temporary_root / "assets"
    generated_manifests = temporary_root / "manifests"
    generated_catalog = temporary_root / "list.json"
    generated_catalog.write_bytes((root / "app-store/list.json").read_bytes())
    result = subprocess.run(
        [
            sys.executable,
            str(generator),
            "--source-dir",
            str(source_dir),
            "--asset-dir",
            str(generated_assets),
            "--manifest-dir",
            str(generated_manifests),
            "--catalog",
            str(generated_catalog),
        ],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    assert result.stdout == "generated 20 animation GIFs and runtime manifests\n"
    for asset_id in expected_ids:
        assert (generated_assets / f"{asset_id}.gif").read_bytes() == (
            asset_dir / f"{asset_id}.gif"
        ).read_bytes()
        assert (generated_manifests / f"{asset_id}.json").read_bytes() == (
            manifest_dir / f"{asset_id}.json"
        ).read_bytes()
    assert generated_catalog.read_bytes() == (root / "app-store/list.json").read_bytes()


with tempfile.TemporaryDirectory() as temporary:
    temporary_root = Path(temporary)
    generated_assets = temporary_root / "assets"
    generated_manifests = temporary_root / "manifests"
    generated_catalog = temporary_root / "list.json"
    generated_catalog.write_bytes((root / "app-store/list.json").read_bytes())
    generated_assets.mkdir()
    generated_manifests.mkdir()
    (generated_assets / "z-stale.gif").write_bytes(b"stale")
    (generated_assets / "a-stale.gif").write_bytes(b"stale")
    (generated_manifests / "z-stale.json").write_text("{}\n", encoding="ascii")
    (generated_manifests / "a-stale.json").write_text("{}\n", encoding="ascii")
    result = subprocess.run(
        [
            sys.executable,
            str(generator),
            "--source-dir",
            str(source_dir),
            "--asset-dir",
            str(generated_assets),
            "--manifest-dir",
            str(generated_manifests),
            "--catalog",
            str(generated_catalog),
        ],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr == (
        "error: unexpected generated outputs: "
        "GIFs=('a-stale.gif', 'z-stale.gif'), "
        "manifests=('a-stale.json', 'z-stale.json')\n"
    )
    assert tuple(sorted(path.name for path in generated_assets.iterdir())) == (
        "a-stale.gif",
        "z-stale.gif",
    )
    assert tuple(sorted(path.name for path in generated_manifests.iterdir())) == (
        "a-stale.json",
        "z-stale.json",
    )


print("animation asset contract: ok (20 GIFs)")
