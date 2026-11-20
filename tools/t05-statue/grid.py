# Lay a labelled grid in the statue's frame over an orthographic picture from views.py, so points can be read off it
# (issue #370): python3 tools/t05-statue/grid.py <png> <out.png> <cx> <cz> <half> <step> [side]
# For a front picture the horizontal axis is x (viewer's right); for side=right it is the depth toward the viewer
# (z of the figure's frame = -y of Blender's). Lines every `step`, labelled.
import sys
from PIL import Image, ImageDraw
src, dst, cx, cz, half, step = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:7])
im = Image.open(src).convert("RGB"); W, H = im.size; d = ImageDraw.Draw(im)
px = lambda v: (v - (cx - half)) / (2 * half) * W
py = lambda v: ((cz + half) - v) / (2 * half) * H
k = int((cx - half) / step) - 1
while k * step <= cx + half:
  v = round(k * step, 4); X = px(v); d.line([(X, 0), (X, H)], fill=(255, 60, 60) if abs(v * 10 - round(v * 10)) < 1e-6 else (120, 120, 120), width=1); d.text((X + 2, 2), f"{v:g}", fill=(255, 255, 0)); k += 1
k = int((cz - half) / step) - 1
while k * step <= cz + half:
  v = round(k * step, 4); Y = py(v); d.line([(0, Y), (W, Y)], fill=(255, 60, 60) if abs(v * 10 - round(v * 10)) < 1e-6 else (120, 120, 120), width=1); d.text((2, Y + 2), f"{v:g}", fill=(255, 255, 0)); k += 1
im.save(dst)
