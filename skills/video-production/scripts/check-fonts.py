#!/usr/bin/env python3
"""Zero-dependency preflight & post-render font gate for temple-walk videos.

Checks two failure modes that `ops qc` does not catch:
  1. Subset/missing glyphs: parses TrueType `cmap` (format 4 & 12) directly via
     stdlib `struct` and fails if any non-whitespace character in the target
     text files is missing from any specified TTF font.
  2. FOIT blank text overlays: inspects rendered transparent PNGs (`top-hook.png`,
     `sub-*.png`) and fails if bright ink pixels (text strokes) are missing inside
     the non-transparent bounding box.

Usage:
  python3 skills/video-production/scripts/check-fonts.py \
      --fonts KingHwaOldSong-GJ.ttf LXGWWenKai-Regular.ttf \
      --text-file lines.json captions.txt

  python3 skills/video-production/scripts/check-fonts.py \
      --png top-hook.png sub-0.png sub-1.png
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
import zlib
from pathlib import Path


def ttf_cmap(path: Path) -> set[int]:
    data = path.read_bytes()
    if len(data) < 12:
        raise ValueError(f"invalid TTF file: {path}")
    num_tables = struct.unpack(">H", data[4:6])[0]
    cmap_off = None
    for i in range(num_tables):
        tag, _, off, _ = struct.unpack(">4sIII", data[12 + i * 16 : 28 + i * 16])
        if tag == b"cmap":
            cmap_off = off
            break
    if cmap_off is None:
        raise ValueError(f"no cmap table in {path}")
    num_sub = struct.unpack(">H", data[cmap_off + 2 : cmap_off + 4])[0]
    chars: set[int] = set()
    for i in range(num_sub):
        _, _, sub_off = struct.unpack(">HHI", data[cmap_off + 4 + i * 8 : cmap_off + 12 + i * 8])
        so = cmap_off + sub_off
        fmt = struct.unpack(">H", data[so : so + 2])[0]
        if fmt == 4:
            seg2 = struct.unpack(">H", data[so + 6 : so + 8])[0]
            seg = seg2 // 2
            ends = struct.unpack(f">{seg}H", data[so + 14 : so + 14 + seg2])
            starts = struct.unpack(f">{seg}H", data[so + 16 + seg2 : so + 16 + 2 * seg2])
            for s, e in zip(starts, ends):
                if s != 0xFFFF:
                    chars.update(range(s, e + 1))
        elif fmt == 12:
            ng = struct.unpack(">I", data[so + 12 : so + 16])[0]
            for g in range(ng):
                s, e, _ = struct.unpack(">III", data[so + 16 + g * 12 : so + 28 + g * 12])
                chars.update(range(s, e + 1))
    return chars


def extract_text(path: Path) -> str:
    raw = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        obj = json.loads(raw)
        buf: list[str] = []

        def walk(v: object) -> None:
            if isinstance(v, str):
                buf.append(v)
            elif isinstance(v, list):
                for item in v:
                    walk(item)
            elif isinstance(v, dict):
                for item in v.values():
                    walk(item)

        walk(obj)
        return "".join(buf)
    return raw


def png_bright_ink_count(path: Path, luma_thresh: int = 160, alpha_thresh: int = 128) -> tuple[int, int]:
    """Decode RGBA/RGB PNG via stdlib zlib and count bright text pixels vs opaque box pixels."""
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    pos = 8
    w = h = bit_depth = color_type = 0
    idat = bytearray()
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            w, h, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            if bit_depth != 8 or color_type not in (2, 6) or interlace != 0:
                raise ValueError(f"unsupported PNG format in {path}: depth={bit_depth} type={color_type} interlace={interlace}")
        elif ctype == b"IDAT":
            idat.extend(chunk)
        elif ctype == b"IEND":
            break
    bpp = 4 if color_type == 6 else 3
    stride = w * bpp
    raw = zlib.decompress(bytes(idat))
    prev = bytearray(stride)
    bright = 0
    opaque = 0
    idx = 0
    for _ in range(h):
        ftype = raw[idx]
        idx += 1
        row = bytearray(raw[idx : idx + stride])
        idx += stride
        if ftype == 1:
            for i in range(bpp, stride):
                row[i] = (row[i] + row[i - bpp]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                row[i] = (row[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                a = row[i - bpp] if i >= bpp else 0
                row[i] = (row[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                a = row[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                row[i] = (row[i] + pr) & 0xFF
        prev = row
        for x in range(0, stride, bpp):
            a = row[x + 3] if bpp == 4 else 255
            if a >= alpha_thresh:
                opaque += 1
                luma = (77 * row[x] + 150 * row[x + 1] + 29 * row[x + 2]) >> 8
                if luma >= luma_thresh:
                    bright += 1
    return bright, opaque


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify TTF cmap coverage and non-blank text overlay PNGs.")
    ap.add_argument("--fonts", nargs="*", default=[], help="TTF font files to check cmap coverage against.")
    ap.add_argument("--text-file", nargs="*", default=[], help="JSON or text files whose characters must be covered.")
    ap.add_argument("--text", action="append", default=[], help="Inline text string(s) to check.")
    ap.add_argument("--png", nargs="*", default=[], help="Rendered text overlay PNGs to verify non-blank ink.")
    ap.add_argument("--min-ink-px", type=int, default=300, help="Minimum bright ink pixels per overlay PNG (default 300).")
    args = ap.parse_args()

    ok = True

    if args.fonts:
        combined = "".join(args.text) + "".join(extract_text(Path(p)) for p in args.text_file)
        unique_chars = sorted({c for c in combined if not c.isspace()})
        if not unique_chars:
            print("ERROR: --fonts specified without any --text or --text-file content.", file=sys.stderr)
            return 2
        for fp in args.fonts:
            p = Path(fp)
            cm = ttf_cmap(p)
            missing = [c for c in unique_chars if ord(c) not in cm]
            if missing:
                ok = False
                print(f"FAIL [cmap] {p.name}: missing {len(missing)}/{len(unique_chars)} chars -> {''.join(missing)}")
            else:
                print(f"PASS [cmap] {p.name}: {len(unique_chars)}/{len(unique_chars)} chars covered (total glyphs={len(cm)})")

    for png_path in args.png:
        p = Path(png_path)
        bright, opaque = png_bright_ink_count(p)
        if bright < args.min_ink_px:
            ok = False
            print(f"FAIL [ink]  {p.name}: only {bright} bright ink px (< {args.min_ink_px}; opaque={opaque}) — possible FOIT blank box")
        else:
            print(f"PASS [ink]  {p.name}: {bright} bright ink px (opaque={opaque})")

    if not args.fonts and not args.png:
        ap.print_help()
        return 2
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
