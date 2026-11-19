"""Lay out tools/frame-views.cjs's pictures (issue #271): one sheet for each screen, a row for each walk, a column
for each eye (before = main's, A, B the default), at one of the six places (--at, default the middle one, 2), with a
thin vermilion cross where his middle is and the thirds marked in white. Several picture folders may be given (the
eye before is drawn from a checkout of main, the others from this branch).
    python3 tools/frame-sheet.py <dir> [<dir> ...] [--at 2] [--out <dir>] [--collage out.jpg]"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[1:]
def opt(name, default):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
at, out, collage = int(opt("--at", "2")), opt("--out", None), opt("--collage", None)
dirs = args
out = out or dirs[0]
views = []
for d in dirs:
    for v in json.load(open(os.path.join(d, "views.json"))):
        v["path"] = os.path.join(d, v["file"]); views.append(v)
WALKS = [("open", "open court"), ("censer", "round the censer"), ("columns", "by the columns"), ("wall", "by the wall"), ("stair-up", "stair, up"), ("stair-down", "stair, down")]
EYES = [("old", "before (main)"), ("a", "A: shoulder"), ("b", "B: centre (default)")]
font = ImageFont.load_default(size=18)
sheets = []
for size in ["16x9", "4x3", "phone"]:
    pick = {(v["walk"], v["frame"]): v for v in views if v["size"] == size and v["i"] == at and os.path.exists(v["path"])}
    if not pick: continue
    first = Image.open(next(iter(pick.values()))["path"])
    scale = (300 if size != "phone" else 180) / first.size[0]
    tw, th = int(first.size[0] * scale), int(first.size[1] * scale)
    pad, left, top = 6, 150, 30
    sheet = Image.new("RGB", (left + len(EYES) * (tw + pad), top + len(WALKS) * (th + pad)), (245, 240, 230))
    dr = ImageDraw.Draw(sheet)
    for c, (_, label) in enumerate(EYES): dr.text((left + c * (tw + pad) + 4, 6), label, fill=(40, 30, 20), font=font)
    for r, (walk, label) in enumerate(WALKS):
        y = top + r * (th + pad)
        dr.text((8, y + th // 2 - 10), label, fill=(40, 30, 20), font=font)
        for c, (eye, _) in enumerate(EYES):
            v = pick.get((walk, eye))
            if not v: continue
            im = Image.open(v["path"]).convert("RGB").resize((tw, th), Image.LANCZOS)
            g = ImageDraw.Draw(im)
            for k in (1, 2):
                g.line([(tw * k / 3, 0), (tw * k / 3, th)], fill=(255, 255, 255), width=1)
                g.line([(0, th * k / 3), (tw, th * k / 3)], fill=(255, 255, 255), width=1)
            if v.get("at"):
                cx, cy = v["at"][0] / 100 * tw, v["at"][1] / 100 * th
                g.line([(cx - 7, cy), (cx + 7, cy)], fill=(200, 40, 30), width=2); g.line([(cx, cy - 7), (cx, cy + 7)], fill=(200, 40, 30), width=2)
                g.text((4, th - 16), f'{v["at"][0]:.0f}% / {v["at"][1]:.0f}%', fill=(255, 255, 255))
            else:
                g.text((4, th - 16), "not in the picture", fill=(255, 220, 200))
            sheet.paste(im, (left + c * (tw + pad), y))
    name = os.path.join(out, f"sheet-{size}.jpg")
    sheet.save(name, quality=85); sheets.append(name); print(name, os.path.getsize(name))
if collage:
    ims = [Image.open(p) for p in sheets]
    W = sum(i.size[0] for i in ims) + 12 * (len(ims) - 1); H = max(i.size[1] for i in ims)
    c = Image.new("RGB", (W, H), (245, 240, 230)); x = 0
    for i in ims: c.paste(i, (x, 0)); x += i.size[0] + 12
    q, s = 85, 1.0
    while True:
        c2 = c.resize((int(W * s), int(H * s)), Image.LANCZOS); c2.save(collage, quality=q)
        if os.path.getsize(collage) < 1_000_000: break
        if q > 60: q -= 10
        else: s *= 0.85
    print(collage, os.path.getsize(collage))
