"""How bright a hall's open door is against the lattice of the bay beside it (#218, acceptance 4).
usage: python3 tools/doorway-light.py tools/out/doorway/rects.json   -> one line a picture: door, beside, ratio"""
import json, os, sys
from PIL import Image

def lum(im, box):
    x0, y0, x1, y1 = [max(0, v) for v in box]
    x1, y1 = min(x1, im.width), min(y1, im.height)
    if x1 <= x0 or y1 <= y0: return None
    px = list(im.crop((x0, y0, x1, y1)).convert("RGB").getdata())
    lin = lambda c: (c / 255) / 12.92 if c <= 10 else (((c / 255) + 0.055) / 1.055) ** 2.4   # sRGB to light
    return sum(0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) for r, g, b in px) / len(px)

rects = json.load(open(sys.argv[1])); here = os.path.dirname(sys.argv[1]); rows = {}
for name, r in rects.items():
    im = Image.open(os.path.join(here, name)); d, b = lum(im, r["door"]), lum(im, r["beside"])
    rows[name] = {"door": round(d, 4) if d is not None else None, "beside": round(b, 4) if b is not None else None, "ratio": round(d / b, 2) if d and b else None}
    print(f"{name:44s} door {rows[name]['door']}  beside {rows[name]['beside']}  ratio {rows[name]['ratio']}")
json.dump(rows, open(os.path.join(here, os.path.basename(sys.argv[1]).replace("rects", "light")), "w"), indent=1)
