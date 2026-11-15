#!/usr/bin/env python3
"""Cut the real hands that the name boards are written in out of photographs of the originals.

    python3 tools/boards.py <dir holding the source images>     (needs Pillow and numpy)

The temple this place is drawn from hangs, over its main hall, a board reading 釋迦寶殿 whose characters are those
of the Chan master Wuzhun Shifan (無準師範, 1177-1249), abbot of Jingshan: the sheet he wrote them on survives in the
Tokyo National Museum (TB-1446, Important Cultural Property), and the museum publishes it for free reuse:

    Source: ColBase (https://colbase.nich.go.jp/collection_items/tnm/TB-1446)
    file TB-1446_E0106954.jpg from the page's 作品画像一式 download

This reads that picture, keeps the ink and throws away the paper, cuts it into its four characters and writes
app/levels/t00/boards/shijia.webp: the characters one under another, each centred in a square, white where the brush went. The board
painter (app/src/plaque.js) lays gold through it. The source picture itself is not kept in the repository.
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CELL = 448

def ink(path):
    im = Image.open(path).convert("L")
    a = np.asarray(im, dtype=np.float32) / 255
    # The paper is pale and uneven; the ink is near black. Take the paper's own tone from a wide blur, and call ink
    # whatever is much darker than the paper around it.
    paper = np.asarray(im.filter(ImageFilter.GaussianBlur(60)), dtype=np.float32) / 255
    m = np.clip((np.maximum(paper, 0.55) - a - 0.12) / 0.3, 0, 1)
    return m

def rows(m, n):
    """Cut the sheet into n characters: between each pair, the row with the least ink near where the gap should be."""
    load = np.convolve(m.sum(axis=1), np.ones(15) / 15, mode="same")
    ys = np.where(load > m.shape[1] * 0.02)[0]; top, bottom = ys[0], ys[-1] + 1; step = (bottom - top) / n; cuts = [top]
    for k in range(1, n):
        a, b = int(top + step * (k - 0.3)), int(top + step * (k + 0.3)); cuts.append(a + int(np.argmin(load[a:b])))
    cuts.append(bottom)
    return list(zip(cuts[:-1], cuts[1:]))

def main():
    src = sys.argv[1]; out = f"{ROOT}/app/levels/t00/boards"; os.makedirs(out, exist_ok=True)
    m = ink(f"{src}/TB-1446_E0106954.jpg")
    h, w = m.shape; m[: int(h * 0.012)] = 0; m[-int(h * 0.012):] = 0; m[:, : int(w * 0.03)] = 0; m[:, -int(w * 0.03):] = 0   # the edges of the sheet are not writing
    cuts = []
    for y0, y1 in rows(m, 4):
        band = m[y0:y1]; cols = np.where(band.sum(axis=0) > band.shape[0] * 0.01)[0]; x0, x1 = cols[0], cols[-1] + 1
        ys = np.where(band.sum(axis=1) > band.shape[1] * 0.01)[0]; cuts.append(band[ys[0]: ys[-1] + 1, x0:x1]); print(f"rows {y0}-{y1}, columns {x0}-{x1}")
    # One scale for all four, so that each keeps the size he gave it beside the others. The ink is made solid (a board
    # is carved and gilded, not washed), with a soft edge a pixel or two wide.
    k = (CELL * 0.94) / max(max(c.shape) for c in cuts); cells = []
    for c in cuts:
        g = Image.fromarray((np.clip(c / 0.22, 0, 1) * 255).astype(np.uint8))
        g = g.resize((round(g.width * k), round(g.height * k)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.6)).point(lambda v: max(0, min(255, (v - 90) * 3)))
        cell = Image.new("L", (CELL, CELL), 0); cell.paste(g, ((CELL - g.width) // 2, (CELL - g.height) // 2)); cells.append(cell)
    strip = Image.new("L", (CELL, CELL * len(cells)), 0)
    for i, c in enumerate(cells): strip.paste(c, (0, CELL * i))
    white = Image.new("L", strip.size, 255)
    Image.merge("LA", (white, strip)).convert("RGBA").save(f"{out}/shijia.webp", lossless=True, method=6)
    print("shijia.webp", os.path.getsize(f"{out}/shijia.webp") // 1024, "KB")

if __name__ == "__main__":
    main()
