#!/usr/bin/env python3
"""The two seal-script characters of the title on the imperial stele's head (#520): cut from the Shuowen Jiezi, and turned into the bitmaps the page draws.

The source is one printed book, the Chen Changzhi block-print of 1873 (Tongzhi 12) held by the National Library of China, which Wikimedia Commons keeps as ten
PDFs, tagged public domain (PD-old-100-expired, PD-scan): volume 2, 'NLC892-312002098744-312890 說文解字 十五卷 第2冊.pdf', 92 pages, which holds juan 2 to 3 (the
character yu is in juan 2b, the radical xing/chi, PDF page 35; the character shu in juan 3b, the radical yu). The whole PDF was refused (HTTP 429) to this machine's address, so
the pages were taken as the single-page thumbnails Wikimedia's own error text recommends:
  https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/<file name>/page<N>-<width>px-<file name>.jpg
and kept out of git (they are 0.9 MB each); what is committed is the cut: app/levels/t00/stele-title/<name>.png, a grey crop of one character from the page, and source.json,
which says where each crop came from (page, width, box).

    python3 tools/stele-title.py cut <name> <page.jpg> <page> <width> x0,y0,x1,y1   # cut a crop from a thumbnail, and record its source
    python3 tools/stele-title.py build                                               # app/levels/t00/stele-title-data.js from the crops in source.json
"""
import base64, json, os, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
DIR = os.path.join(ROOT, "app/levels/t00/stele-title"); SRC = os.path.join(DIR, "source.json"); OUT = os.path.join(ROOT, "app/levels/t00/stele-title-data.js")
FILE = "NLC892-312002098744-312890_說文解字_十五卷_第2冊.pdf"
BW, BH = 96, 128   # a bitmap is BW x BH bytes (a seal character is about three quarters as wide as it is tall), 0 = bare stone and 255 = cut
ORDER = ["yu", "shu"]   # the title reads yu shu, the first at the right

def cut(name, page_jpg, page, width, box):
    x0, y0, x1, y1 = box; im = Image.open(page_jpg).convert("L").crop((x0, y0, x1, y1)); os.makedirs(DIR, exist_ok=True); im.save(os.path.join(DIR, name + ".png"))
    src = json.load(open(SRC)) if os.path.exists(SRC) else {"book": "說文解字 十五卷, Chen Changzhi block-print, Tongzhi 12 (1873), National Library of China", "file": FILE, "licence": "public domain (PD-old-100-expired, PD-scan, Wikimedia Commons)", "crops": {}}
    src["crops"][name] = {"page": page, "thumbnail_width": width, "box": [x0, y0, x1, y1]}; json.dump(src, open(SRC, "w"), indent=1, ensure_ascii=False)
    print("cut", name, im.size)

def components(mask, keep=0.04):
    """Keep the connected parts of a 0/1 mask that are at least `keep` of the largest: the glyph, not the specks and ruling-line ends round it."""
    H, W = mask.shape; lab = np.zeros((H, W), "int32"); sizes = [0]; n = 0
    for y in range(H):
        for x in range(W):
            if mask[y, x] and not lab[y, x]:
                n += 1; stack = [(y, x)]; lab[y, x] = n; c = 0
                while stack:
                    cy, cx = stack.pop(); c += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; stack.append((ny, nx))
                sizes.append(c)
    big = max(sizes[1:]); good = [i for i in range(1, n + 1) if sizes[i] >= keep * big]
    return np.isin(lab, good)

def inside_distance(mask, reach):
    """Distance from each pixel of the mask to the nearest pixel outside it (exact within `reach`, capped there)."""
    H, W = mask.shape; out = np.full((H, W), float(reach)); pad = np.pad(~mask, reach, constant_values=True)
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            d = (dx * dx + dy * dy) ** 0.5
            if d > reach: continue
            shifted = pad[reach + dy:reach + dy + H, reach + dx:reach + dx + W]
            out = np.where(shifted & (d < out), d, out)
    return np.where(mask, out, 0.0)

def bitmap(path):
    """A character's depth field: the crop is made a clean black-and-white shape (the show-through of the printed page and the ruling lines taken out, the contour smoothed), and each pixel's
    depth is how far it lies inside the stroke, so that a stroke reads as a V-shaped groove deepest along its middle, as the writing on the stele's body is cut."""
    g = np.asarray(Image.open(path).convert("L")).astype(float)
    paper, ink = np.percentile(g, 85), np.percentile(g, 3)           # the page's paper and the printed ink
    m = np.clip((paper - g) / max(1.0, paper - ink), 0, 1)           # 1 = ink
    up = Image.fromarray((m * 255).astype("uint8")).resize((m.shape[1] * 4, m.shape[0] * 4), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.6))
    hi = components(np.asarray(up) > 92)                              # the clean shape, at four times the crop
    ys, xs = np.nonzero(hi); hi = hi[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    k = min((BW - 8) / hi.shape[1], (BH - 8) / hi.shape[0]) * 3        # the shape fitted to three times the bitmap's size, to take the distance there
    w, h = max(1, round(hi.shape[1] * k)), max(1, round(hi.shape[0] * k))
    mask = np.asarray(Image.fromarray((hi * 255).astype("uint8")).resize((w, h), Image.LANCZOS)) > 127
    d = inside_distance(mask, 24)
    depth = np.clip(d / 13.0, 0, 1)                                    # 13 px at three times the size: a stroke's half width, so the middle of a stroke is deepest
    depth = np.asarray(Image.fromarray((depth * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.0))).astype(float) / 255
    canvas = np.zeros((BH * 3, BW * 3)); oy, ox = (BH * 3 - h) // 2, (BW * 3 - w) // 2; canvas[oy:oy + h, ox:ox + w] = depth
    return np.asarray(Image.fromarray((canvas * 255).astype("uint8")).resize((BW, BH), Image.BOX))

def build():
    src = json.load(open(SRC)); items = []
    for n in ORDER:
        if n in src["crops"]: items.append(base64.b64encode(bitmap(os.path.join(DIR, n + ".png")).tobytes()).decode())
    js = ("// The title's characters as bitmaps (made by tools/stele-title.py from the Shuowen Jiezi, see app/levels/t00/stele-title/source.json): BW x BH bytes each, base64, 255 = cut.\n"
          "// The first is at the right of the title's frame. Until both are made the frame stays blank.\n"
          f"export const TITLE = Object.freeze({{ w: {BW}, h: {BH}, list: Object.freeze({json.dumps(items)}) }});\n")
    open(OUT, "w").write(js); print("wrote", OUT, len(items), "characters,", len(js), "bytes")

if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "cut": cut(sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), [int(v) for v in sys.argv[6].split(",")])
    elif len(sys.argv) >= 2 and sys.argv[1] == "build": build()
    else: print(__doc__)
