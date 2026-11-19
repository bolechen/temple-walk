#!/usr/bin/env python3
"""Contact sheets for the walk-round survey (#252), from tools/around-shots.cjs's pictures and its shots.json.
  python3 tools/around-sheet.py <shots dir> <out dir> [--collage <file>]
items-<class>.jpg   one row a thing, a column a side (front, right, back, left, oblique; the compass for things with no front)
visitors-<n>.jpg    20 tourists a sheet, a row each: four ways level, then four ways looking up 20 degrees
--collage           one picture of every thing's back (or north) side, 8 across, 1600 px, under 1 MB, for the repository
"""
import json, sys, os, collections
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
shots = json.load(open(os.path.join(src, "shots.json")))["shots"]
def img(f, w, h):
    return Image.open(os.path.join(src, f)).convert("RGB").resize((w, h))
def label(im, text):
    d = ImageDraw.Draw(im); d.rectangle([0, 0, im.width, 14], fill=(0, 0, 0)); d.text((3, 1), text, fill=(255, 255, 255))
by = collections.OrderedDict()
for s in shots:
    if s["cls"] == "游客眼": continue
    by.setdefault((s["cls"], s["id"]), {})[s["side"]] = s
classes = collections.OrderedDict()
for (c, i), sides in by.items(): classes.setdefault(c, []).append((i, sides))
W, H = 320, 180
order = ["front", "right", "back", "left", "south", "east", "north", "west", "oblique"]
n = 0
for c, things in classes.items():
    cols = [k for k in order if any(k in s for _, s in things)]
    for p in range(0, len(things), 8):
        chunk = things[p:p + 8]; sheet = Image.new("RGB", (W * len(cols), H * len(chunk)), (30, 30, 30))
        for r, (i, sides) in enumerate(chunk):
            for k, side in enumerate(cols):
                if side in sides:
                    im = img(sides[side]["file"], W, H); label(im, f"{i} · {side}"); sheet.paste(im, (k * W, r * H))
        name = f"items-{c}" + (f"-{p // 8 + 1}" if len(things) > 8 else "") + ".jpg"; sheet.save(os.path.join(out, name), quality=82); n += 1
vis = collections.OrderedDict()
for s in shots:
    if s["cls"] == "游客眼": vis.setdefault(int(s["id"]), []).append(s)
ids = sorted(vis); w, h = 160, 90
for p in range(0, len(ids), 20):
    chunk = ids[p:p + 20]; sheet = Image.new("RGB", (w * 8, h * len(chunk)), (30, 30, 30))
    for r, v in enumerate(chunk):
        for k, s in enumerate(sorted(vis[v], key=lambda s: ("up" in s["side"], int(s["side"].split("°")[0])))):
            im = img(s["file"], w, h); label(im, f"{v} {s['side']}"); sheet.paste(im, (k * w, r * h))
    sheet.save(os.path.join(out, f"visitors-{p // 20 + 1:02d}.jpg"), quality=80); n += 1
if "--collage" in sys.argv:
    path = sys.argv[sys.argv.index("--collage") + 1]; cells = []
    for (c, i), sides in by.items():
        s = sides.get("back") or sides.get("north")
        if s: cells.append((f"{c} {i}", s["file"]))
    cw, ch, cols = 200, 112, 8; rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (cw * cols, ch * rows), (30, 30, 30))
    for k, (t, f) in enumerate(cells):
        im = img(f, cw, ch); label(im, t[:26]); sheet.paste(im, ((k % cols) * cw, (k // cols) * ch))
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True); sheet.save(path, quality=78, optimize=True)
    print("collage", len(cells), os.path.getsize(path) // 1024, "KB")
print("sheets", n)
