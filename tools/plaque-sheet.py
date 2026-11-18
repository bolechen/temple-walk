#!/usr/bin/env python3
"""Three columns of close views of the name boards from three builds, for a pull request's evidence (#192).

    python3 tools/plaque-sheet.py <font with Chinese> <out.jpg> <before dir> <now dir> <after dir>

Each dir holds the pictures tools/plaque-views.cjs (and tools/shots.js for the offering box) made from one build:
main, gate, screen, tea-owner, tea-front, box. A picture a build does not have is left blank and said so.
"""
import io, os, sys
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROWS = [("main", "大殿「正法眼藏」", (380, 300, 900, 450)), ("gate", "山门两块匾", (360, 0, 920, 440)), ("screen", "照壁「雙徑歸堂」", (260, 200, 1040, 520)),
        ("tea-owner", "茶寮「喫茶去」", (560, 190, 960, 420)), ("tea-front", "茶寮正面", (440, 130, 820, 270)), ("box", "功德箱", (500, 300, 820, 700))]
COLS = ["#207 之前", "现在线上（#207 起）", "恢复后（本 PR）"]
W = 420

def main():
    ttf, out, *dirs = sys.argv[1:5] + sys.argv[5:]
    f = TTFont(ttf, lazy=True); f.flavor = None; b = io.BytesIO(); f.save(b); font = ImageFont.truetype(io.BytesIO(b.getvalue()), 20)
    cells = [[None] * 3 for _ in ROWS]; heights = []
    for r, (name, _, box) in enumerate(ROWS):
        h = int((box[3] - box[1]) * W / (box[2] - box[0])); heights.append(h)
        for c, d in enumerate(dirs):
            p = os.path.join(d, name + ".png")
            if os.path.exists(p): cells[r][c] = Image.open(p).convert("RGB").crop(box).resize((W, h), Image.LANCZOS)
    H = 34 + sum(heights) + 34 * len(ROWS); sheet = Image.new("RGB", (W * 3 + 40, H), (236, 228, 210)); d = ImageDraw.Draw(sheet)
    for c, t in enumerate(COLS): d.text((10 + c * (W + 10), 6), t, font=font, fill=(40, 30, 20))
    y = 34
    for r, (name, label, _) in enumerate(ROWS):
        d.text((10, y + 4), label, font=font, fill=(90, 60, 30)); y += 34
        for c in range(3):
            if cells[r][c]: sheet.paste(cells[r][c], (10 + c * (W + 10), y))
            else: d.rectangle((10 + c * (W + 10), y, 10 + c * (W + 10) + W, y + heights[r]), outline=(150, 130, 100)); d.text((20 + c * (W + 10), y + 10), "（当时还没有）", font=font, fill=(120, 100, 80))
        y += heights[r]
    sheet.save(out, "JPEG", quality=84, optimize=True); print(out, os.path.getsize(out) // 1024, "KB")

if __name__ == "__main__":
    main()
