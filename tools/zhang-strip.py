#!/usr/bin/env python3
"""Zhang Jizhi's eight large characters beside the same characters in each candidate board face (#192).

    python3 tools/zhang-strip.py <fontdir> <Met DP-35702-002.jpg> <out.jpg>

The picture is the Metropolitan Museum's Open Access photograph of 'Excerpt from "Song of Leyou Park"' (2000.325, CC0): the eight
characters 幕排銀牓拂水低徊, in the large running-standard hand the real Jingshan screen wall's back is said to be his. Each
character is cut out of the photograph by its own ink, set in a square, and the faces draw the same characters
below it, unevened, so the eye can see which is nearest in weight, in the square build and in the cut of the stroke ends.
The Met's file is not committed: the tool takes it from the address above.
"""
import io, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

FACES = [("Yuji Boku（Syuku、Mai 的汉字相同）", "ofl_yujiboku_YujiBoku-Regular.ttf"),
         ("Kaisei Tokumin Bold", "ofl_kaiseitokumin_KaiseiTokumin-Bold.ttf"), ("Potta One", "PottaOne-Regular.ttf"), ("全字庫正楷體", "TW-Kai-98_1.ttf")]
# The eight characters in the 4000 x 3002 photograph, as [centre x, centre y] of the 1600-wide view times 2.5, in reading order
# (right column down, then the next): found by eye on the photograph and then tightened to each one's own ink.
SPOTS = [("幕", 1290, 330, 1530, 640), ("排", 1290, 690, 1520, 910), ("銀", 880, 370, 1130, 600), ("牓", 930, 670, 1140, 890),
         ("拂", 490, 330, 730, 660), ("水", 510, 660, 710, 890), ("低", 90, 390, 340, 600), ("徊", 60, 690, 300, 890)]
CELL = 260

def ink_box(im, box):
    """The black ink inside a box of the 1600-wide view (times 2.5 in the file), not the silk's dark red and blue."""
    x0, y0, x1, y1 = [int(v * 2.5) for v in box]; rgb = np.asarray(im.convert("RGB")).astype(int)[y0:y1, x0:x1]
    m = (rgb.max(axis=2) < 80) & (rgb.max(axis=2) - rgb.min(axis=2) < 28); ys, xs = np.where(m)
    return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max())

def square(img, size, bg=(238, 228, 206)):
    s = max(img.size); c = Image.new("RGB", (s, s), bg); c.paste(img, ((s - img.width) // 2, (s - img.height) // 2)); return c.resize((size, size), Image.LANCZOS)

def main():
    src, met, out = sys.argv[1:4]; photo = Image.open(met).convert("RGB")
    W = CELL * 8 + 90; H = (CELL + 22) * (1 + len(FACES)) + 30; sheet = Image.new("RGB", (W, H), (236, 228, 210)); d = ImageDraw.Draw(sheet)
    lf = ImageFont.truetype(io.BytesIO(font_bytes(f"{src}/TW-Kai-98_1.ttf")), 18); y = 10
    for i, (ch, *box) in enumerate(SPOTS):
        x0, y0, x1, y1 = ink_box(photo, box); pad = int((max(x1 - x0, y1 - y0)) * 0.1)
        sheet.paste(square(photo.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad)), CELL, (214, 190, 140)), (10 + i * (CELL + 10), y))
    for r, (name, f) in enumerate(FACES, 1):
        d.text((10, 10 + r * (CELL + 22) - 20 + 2 * 0), name, font=lf, fill=(60, 45, 30))
        fb = font_bytes(f"{src}/{f}"); font = ImageFont.truetype(io.BytesIO(fb), int(CELL * 0.86)); y = 10 + r * (CELL + 22); cmap = TTFont(io.BytesIO(fb)).getBestCmap()
        for i, (ch, *_) in enumerate(SPOTS):
            if ord(ch) not in cmap: continue   # the face does not have it: left blank
            t = Image.new("L", (CELL * 2, CELL * 2), 0); ImageDraw.Draw(t).text((CELL, CELL), ch, font=font, fill=255, anchor="mm")
            bb = t.getbbox()
            if not bb: continue
            t = t.crop(bb); cell = Image.new("RGB", (t.width, t.height), (238, 228, 210)); cell.paste(Image.new("RGB", t.size, (30, 24, 20)), (0, 0), t)
            pad = int(max(t.size) * 0.1); c2 = Image.new("RGB", (t.width + 2 * pad, t.height + 2 * pad), (238, 228, 210)); c2.paste(cell, (pad, pad))
            sheet.paste(square(c2, CELL), (10 + i * (CELL + 10), y))
    sheet.save(out, "JPEG", quality=82, optimize=True); print(out)

def font_bytes(p):
    f = TTFont(p, lazy=True); f.flavor = None; b = io.BytesIO(); f.save(b); return b.getvalue()

if __name__ == "__main__":
    main()
