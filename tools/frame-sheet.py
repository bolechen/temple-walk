"""Lay out tools/frame-views.cjs's pictures (issue #271): one sheet for each walk and screen, a row for each eye
(now, A, B), six places across, with a thin vermilion cross where his middle is held to and the thirds marked.
    python3 tools/frame-sheet.py <dir> [--collage out.jpg]"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

d = sys.argv[1]
views = json.load(open(os.path.join(d, "views.json")))
LABEL = {"now": "now", "a": "A: shoulder,\nfixed", "b": "B: centre,\nlower third"}
font = ImageFont.load_default(size=20)
sheets = []
for size in sorted({v["size"] for v in views}):
    for walk in ["open", "censer", "columns", "wall"]:
        rows = []
        for fr in ["now", "a", "b"]:
            vs = sorted([v for v in views if v["size"] == size and v["walk"] == walk and v["frame"] == fr], key=lambda v: v["i"])
            if vs: rows.append((fr, vs))
        if not rows: continue
        im0 = Image.open(os.path.join(d, rows[0][1][0]["file"]))
        scale = 320 / max(im0.size)
        tw, th = int(im0.size[0] * scale), int(im0.size[1] * scale)
        pad, left = 6, 150
        sheet = Image.new("RGB", (left + 6 * (tw + pad), len(rows) * (th + pad) + 30), (245, 240, 230))
        dr = ImageDraw.Draw(sheet)
        dr.text((8, 4), f"{walk} · {size}", fill=(40, 30, 20), font=font)
        for r, (fr, vs) in enumerate(rows):
            y = 30 + r * (th + pad)
            dr.multiline_text((8, y + th // 2 - 22), LABEL[fr], fill=(40, 30, 20), font=font)
            for v in vs:
                im = Image.open(os.path.join(d, v["file"])).convert("RGB").resize((tw, th), Image.LANCZOS)
                g = ImageDraw.Draw(im)
                for k in (1, 2):
                    g.line([(tw * k / 3, 0), (tw * k / 3, th)], fill=(255, 255, 255), width=1)
                    g.line([(0, th * k / 3), (tw, th * k / 3)], fill=(255, 255, 255), width=1)
                if v["at"]:
                    cx, cy = v["at"][0] / 100 * tw, v["at"][1] / 100 * th
                    g.line([(cx - 7, cy), (cx + 7, cy)], fill=(200, 40, 30), width=2); g.line([(cx, cy - 7), (cx, cy + 7)], fill=(200, 40, 30), width=2)
                    g.text((4, th - 16), f'{v["at"][0]:.0f}%', fill=(255, 255, 255))
                sheet.paste(im, (left + v["i"] * (tw + pad), y))
        name = os.path.join(d, f"sheet-{size}-{walk}.jpg")
        sheet.save(name, quality=85); sheets.append(name); print(name)
if "--collage" in sys.argv:
    out = sys.argv[sys.argv.index("--collage") + 1]
    # the open court and the wall, every screen: where the two ways differ most and least
    pick = [s for s in sheets if "-open" in s or "-wall" in s]
    ims = [Image.open(p) for p in pick]
    W = max(i.size[0] for i in ims); H = sum(i.size[1] for i in ims)
    c = Image.new("RGB", (W, H), (245, 240, 230)); y = 0
    for i in ims: c.paste(i, (0, y)); y += i.size[1]
    q = 80
    while True:
        c2 = c.resize((int(W * 0.6), int(H * 0.6)), Image.LANCZOS); c2.save(out, quality=q)
        if os.path.getsize(out) < 1_000_000 or q < 40: break
        q -= 10
    print(out, os.path.getsize(out))
