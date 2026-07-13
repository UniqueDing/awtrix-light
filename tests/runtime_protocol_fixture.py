#!/usr/bin/env python3

import importlib.util
import struct
import tempfile
from pathlib import Path


def packet_type(packet):
    assert len(packet) >= 2
    assert packet[1] == 1
    return packet[0]


def valid_owner(packet):
    if len(packet) < 5 or packet[0:2] != b"\x02\x01":
        return False
    length = packet[4]
    return length <= 32 and len(packet) == 5 + length and all(0x20 <= value <= 0x7E for value in packet[5:])


def validate_draw(packet):
    if len(packet) < 6 or len(packet) > 4096 or packet[0:2] != b"\x04\x01" or packet[4] & 0xFE or packet[5] > 128:
        return False
    offset = 6
    for _ in range(packet[5]):
        if offset >= len(packet):
            return False
        opcode = packet[offset]
        if opcode in (1, 4):
            size = 8
        elif opcode == 3:
            size = 6
        elif opcode == 2:
            if offset + 7 > len(packet):
                return False
            size = 7 + packet[offset + 6]
        else:
            return False
        if offset + size > len(packet) or opcode == 1 and (packet[offset + 3] == 0 or packet[offset + 4] == 0):
            return False
        offset += size
    return offset == len(packet)


class ButtonQueue:
    def __init__(self):
        self.items = []
        self.overflow = False

    def push(self, edge):
        if len(self.items) == 16:
            self.items.clear()
            self.overflow = True
            return
        self.items.append(edge)


fixtures = {
    "claim": bytes.fromhex("02 01 12 34 03 77 65 62"),
    "release": bytes.fromhex("03 01 12 35"),
    "pixel": bytes.fromhex("04 01 00 01 01 01 03 02 03 FF 00 00"),
    "fill": bytes.fromhex("04 01 00 02 00 01 01 00 00 20 08 00 00 FF"),
    "line": bytes.fromhex("04 01 00 03 00 01 04 FF 00 1F 07 00 FF 00"),
    "text": bytes.fromhex("04 01 00 04 00 01 02 01 06 FF FF FF 02 48 69"),
    "button": bytes.fromhex("85 01 00 00 00 4A 01 01"),
    "ack": bytes.fromhex("82 01 02 12 34 00"),
}

assert packet_type(fixtures["claim"]) == 2
assert fixtures["claim"][4] == 3 and fixtures["claim"][5:] == b"web"
assert packet_type(fixtures["release"]) == 3
assert packet_type(fixtures["pixel"]) == 4 and fixtures["pixel"][6] == 3
assert packet_type(fixtures["fill"]) == 4 and fixtures["fill"][6] == 1
assert packet_type(fixtures["line"]) == 4 and fixtures["line"][7] == 0xFF
assert packet_type(fixtures["text"]) == 4 and fixtures["text"][-2:] == b"Hi"
assert packet_type(fixtures["button"]) == 0x85
assert struct.unpack(">I", fixtures["button"][2:6])[0] == 74
assert packet_type(fixtures["ack"]) == 0x82
assert len(bytes([0x84, 1]) + struct.pack(">I", 1) + bytes(768)) == 774
assert valid_owner(fixtures["claim"])
assert not valid_owner(bytes.fromhex("02 01 12 34 01 00"))
assert not valid_owner(bytes([2, 1, 0, 1, 33]) + b"a" * 33)
for name in ("pixel", "fill", "line", "text"):
    assert validate_draw(fixtures[name])
assert not validate_draw(fixtures["fill"][:-1])
assert not validate_draw(bytes.fromhex("04 01 00 01 02 00"))
assert not validate_draw(bytes.fromhex("04 01 00 01 00 01 01 00 00 00 08 FF FF FF"))
assert not validate_draw(bytes.fromhex("04 01 00 01 00 01 7F"))
assert len(fixtures["release"]) == 4
assert len(fixtures["release"] + b"\x00") != 4

root = Path(__file__).resolve().parents[1]
patch_spec = importlib.util.spec_from_file_location("patch_websockets_272", root / "tools/patch_websockets_272.py")
assert patch_spec is not None and patch_spec.loader is not None
patch_module = importlib.util.module_from_spec(patch_spec)
patch_spec.loader.exec_module(patch_module)
normalize_header = patch_module.normalize_header
patch_header = patch_module.patch_header
platformio_patch = (root / "patches/012-runtime-websockets-platformio.patch").read_text()
socket_source = (root / "src/AwtrixLightWebSocket.cpp").read_text()
socket_mirror = (root / "awtrix3/src/AwtrixLightWebSocket.cpp").read_text()
display_source = (root / "awtrix3/src/DisplayManager.cpp").read_text()
display_patch = (root / "patches/011-runtime-display-ownership.patch").read_text()
web_source = (root / "src/AwtrixLightWeb.cpp").read_text()
runtime_source = (root / "src/AwtrixLightRuntime.cpp").read_text()
assert "+\t-DWEBSOCKETS_MAX_DATA_SIZE=4096" in platformio_patch
assert "+\tlinks2004/WebSockets@2.7.2" in platformio_patch
assert "+extra_scripts = pre:../tools/patch_websockets_272.py" in platformio_patch
dependency_patch = (root / "tools/patch_websockets_272.py").read_text()
assert "def normalize_header(source):" in dependency_patch
assert "constexpr uint32_t kAuthTimeoutMs = 1000;" in socket_source
assert "uint8_t previewFps = 30;" in socket_source
assert "previewFps = data[5] ? min(uint8_t(30), data[5]) : 30;" in socket_source
assert "bool screenSequenceSent = false;" in socket_source
assert "sentScreenSequence = 0xFFFFFFFF;" not in socket_source
assert socket_source.count("screenSequenceSent = false;") == 3
assert "(!screenSequenceSent || screenSequence != sentScreenSequence)" in socket_source
assert "if (socketServer.sendBIN(client, screenPacket, sizeof(screenPacket)))\n        {\n            sentScreenSequence = screenSequence;\n            screenSequenceSent = true;\n            lastPreview = now;\n        }" in socket_source
assert socket_source == socket_mirror
claim_runtime = display_source[display_source.index("void DisplayManager_::claimRuntime()") : display_source.index("void DisplayManager_::releaseRuntime()")]
assert "runtimeScreenSequence = 0;" not in claim_runtime
assert "static CRGB runtimeScreen[MATRIX_WIDTH * MATRIX_HEIGHT];" in display_source
assert "const CRGB &pixel = runtimeScreen[matrix->XY(x, y)];" in display_source
assert "memcmp(runtimeScreen, leds, sizeof(leds))" in display_source
assert "memcpy(runtimeScreen, leds, sizeof(leds));\n    ++runtimeScreenSequence;" in display_source
assert "memcpy(ledsCopy, leds, sizeof(leds));\n  for (int i = 0; i < 256; i++)" in display_source
assert "+  runtimeScreenSequence = 0;" not in display_patch
assert "+static CRGB runtimeScreen[MATRIX_WIDTH * MATRIX_HEIGHT];" in display_patch
assert "+      const CRGB &pixel = runtimeScreen[matrix->XY(x, y)];" in display_patch
assert "+  if (memcmp(runtimeScreen, leds, sizeof(leds)) != 0)" in display_patch
assert "+    memcpy(runtimeScreen, leds, sizeof(leds));\n+    ++runtimeScreenSequence;" in display_patch
assert "   memcpy(ledsCopy, leds, sizeof(leds));" in display_patch
assert "if (authenticated)" in socket_source and "socketServer.disconnect(staleClient);" in socket_source
assert 'sendHeader("Cache-Control", "no-store")' in web_source
assert "values.size() >= 4 && values[2].is<const char *>()" in runtime_source
assert "strlcpy(state.owner" not in runtime_source

queue = ButtonQueue()
for sequence in range(1, 17):
    queue.push((sequence, sequence % 3, sequence % 2 == 1))
assert len(queue.items) == 16 and not queue.overflow
queue.push((17, 0, True))
assert not queue.items and queue.overflow

guarded_definition = "#ifndef WEBSOCKETS_MAX_DATA_SIZE\n#define WEBSOCKETS_MAX_DATA_SIZE (15 * 1024)\n#endif\n"
header_fixtures = {
    "unguarded": "before\n#define WEBSOCKETS_MAX_DATA_SIZE (15 * 1024)\nafter\n",
    "single_guarded": f"before\n{guarded_definition}after\n",
    "nested_guarded": "before\n#ifndef WEBSOCKETS_MAX_DATA_SIZE\n#ifndef WEBSOCKETS_MAX_DATA_SIZE\n#ifndef WEBSOCKETS_MAX_DATA_SIZE\n#define WEBSOCKETS_MAX_DATA_SIZE (15 * 1024)\n#endif\n#endif\n#endif\nafter\n",
}
with tempfile.TemporaryDirectory() as temporary_directory:
    for name, fixture in header_fixtures.items():
        header = Path(temporary_directory) / f"{name}.h"
        header.write_text(fixture)
        patch_header(header)
        first = header.read_bytes()
        patch_header(header)
        second = header.read_bytes()
        patch_header(header)
        third = header.read_bytes()
        assert first == second == third
        assert header.read_text() == f"before\n{guarded_definition}after\n"
        assert normalize_header(header.read_text()) == header.read_text()

print("runtime protocol fixtures: ok")
