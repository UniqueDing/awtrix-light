from pathlib import Path
import re
import subprocess
import sys


DEFINE_RE = re.compile(r"^[ \t]*#[ \t]*define[ \t]+WEBSOCKETS_MAX_DATA_SIZE[ \t]+\(15[ \t]*\*[ \t]*1024\)[ \t]*(?:\r?\n)?$")
IFNDEF_RE = re.compile(r"^[ \t]*#[ \t]*ifndef[ \t]+WEBSOCKETS_MAX_DATA_SIZE[ \t]*(?:\r?\n)?$")
ENDIF_RE = re.compile(r"^[ \t]*#[ \t]*endif[ \t]*(?:\r?\n)?$")


def normalize_header(source):
    lines = source.splitlines(keepends=True)
    normalized = []
    definitions = 0
    index = 0

    while index < len(lines):
        line = lines[index]
        if not DEFINE_RE.fullmatch(line):
            normalized.append(line)
            index += 1
            continue

        definitions += 1
        while normalized and IFNDEF_RE.fullmatch(normalized[-1]):
            normalized.pop()

        index += 1
        while index < len(lines) and ENDIF_RE.fullmatch(lines[index]):
            index += 1

        newline = "\r\n" if line.endswith("\r\n") else "\n"
        normalized.extend(
            (
                f"#ifndef WEBSOCKETS_MAX_DATA_SIZE{newline}",
                f"#define WEBSOCKETS_MAX_DATA_SIZE (15 * 1024){newline}",
                f"#endif{newline}",
            )
        )

    if definitions == 0:
        raise RuntimeError("unexpected WebSockets 2.7.2 header: maximum-size definition not found")
    return "".join(normalized)


def patch_header(header):
    source = header.read_text()
    normalized = normalize_header(source)
    if normalized != source:
        header.write_text(normalized)


def dependency_header(env):
    return Path(env.subst("$PROJECT_LIBDEPS_DIR")) / env.subst("$PIOENV") / "WebSockets" / "src" / "WebSockets.h"


def main(env):
    header = dependency_header(env)
    if not header.exists():
        subprocess.run(
            [sys.executable, "-m", "platformio", "pkg", "install", "-e", env.subst("$PIOENV")],
            cwd=env.subst("$PROJECT_DIR"),
            check=True,
        )
    patch_header(header)


pio_import = globals().get("Import")
if pio_import is not None:
    pio_import("env")
    main(globals()["env"])
