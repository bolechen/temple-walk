"""Side by side, the three ways of showing a room through its door (#320): the baked cube as it is, with a larger face into
the room (`hires`), and drawn live (`live`), from tools/doorway-views.cjs's nine views (12, 6, 2 m x -30, 0, 30 degrees).

  python3 tools/doorway-compare.py <dir of doorway-views pngs> <out dir> [hall ...]

For each hall: <out>/<hall>-sheet.jpg, every view of the three side by side (rows: distance; three blocks of three
angles: baked, hires, live). And <out>/collage.jpg: the door itself, cut out square on from 12, 6 and 2 m, for every
hall named, the three ways in a row each, under 1 MB and 1600 px on its long side (AGENTS.md's evidence rule).
The pictures are expected as <hall>-<d>m-<a><tag>.png with tags -baked, -hires, -live; the door's box is read from
rects-<tag>.json beside them.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

src, out, halls = sys.argv[1], sys.argv[2], sys.argv[3:] or ["main", "guanyin", "yaoshi"]
os.makedirs(out, exist_ok=True)
MODES = [("baked", "baked 256"), ("hires", "hires 1024"), ("live", "live")]
DISTS, ANGLES = [12, 6, 2], [-30, 0, 30]
font = ImageFont.load_default(size=20)
rects = {m: json.load(open(os.path.join(src, f"rects-{m}.json"))) if os.path.exists(os.path.join(src, f"rects-{m}.json")) else {} for m, _ in MODES}

def pic(hall, d, a, m):
    p = os.path.join(src, f"{hall}-{d}m-{a}-{m}.png")
    return Image.open(p).convert("RGB") if os.path.exists(p) else None

def label(im, text):
    g = ImageDraw.Draw(im)
    g.rectangle([0, 0, im.width, 30], fill=(0, 0, 0))
    g.text((8, 3), text, fill=(255, 255, 255), font=font)
    return im

for hall in halls:
    first = pic(hall, 6, 0, "baked")
    if first is None:
        continue
    tw, th = first.width // 2, first.height // 2
    sheet = Image.new("RGB", (tw * 9 + 16 * 2, th * 3 + 34), (20, 20, 20))
    for k, (m, name) in enumerate(MODES):
        ImageDraw.Draw(sheet).text((k * (tw * 3 + 16) + 8, 4), f"{hall} · {name}", fill=(255, 255, 255), font=font)
        for r, d in enumerate(DISTS):
            for c, a in enumerate(ANGLES):
                im = pic(hall, d, a, m)
                if im is not None:
                    sheet.paste(im.resize((tw, th), Image.LANCZOS), (k * (tw * 3 + 16) + c * tw, 34 + r * th))
    sheet.save(os.path.join(out, f"{hall}-sheet.jpg"), quality=86)

# The door cut out square on: a box round the door's own rectangle, a little larger, from each distance.
cells = []
for hall in halls:
    for d in DISTS:
        row = []
        for m, name in MODES:
            im = pic(hall, d, 0, m)
            box = rects[m].get(f"{hall}-{d}m-0-{m}.png", {}).get("door") if im else None
            if im is None or not box:
                row.append(None)
                continue
            x0, y0, x1, y1 = box
            cx, cy, s = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) * 1.35 + 20
            crop = im.crop((int(cx - s / 2), int(cy - s / 2), int(cx + s / 2), int(cy + s / 2))).resize((260, 260), Image.LANCZOS)
            row.append(label(crop, f"{hall} {d}m {name}"))
        cells.append(row)
W, H = 260 * 3 + 8 * 2, len(cells) * 268
col = Image.new("RGB", (W, H), (20, 20, 20))
for r, row in enumerate(cells):
    for c, im in enumerate(row):
        if im is not None:
            col.paste(im, (c * 268, r * 268))
if col.height > 1600:
    col = col.resize((round(col.width * 1600 / col.height), 1600), Image.LANCZOS)
q = 85
while True:
    col.save(os.path.join(out, "collage.jpg"), quality=q)
    if os.path.getsize(os.path.join(out, "collage.jpg")) < 1_000_000 or q < 40:
        break
    q -= 8
print(json.dumps({"sheets": [f"{h}-sheet.jpg" for h in halls], "collage": "collage.jpg", "bytes": os.path.getsize(os.path.join(out, "collage.jpg"))}))
