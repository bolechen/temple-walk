#!/usr/bin/env python3
"""How much the flagstones of the first court differ from one another in tone (#467, ART-REVIEW A4).

    python3 tools/slab-contrast.py a.png b.png ...

The pictures are T4 frames of cam06 (summer, day) at 1080p; a picture of another size is read in proportion. The band is
rows 705-850 and columns 300-1620 of a 1920x1080 frame, which is paving all the way across at the middle distance.

The band is cut into 24x6 pixel blocks and each block is reduced to its median, so that a hairline joint or a grain of
stone cannot move it. Each block then has the mean of the 7x7 blocks around it taken off, which removes the large rises
and falls (a puddle, the fall of light with distance). What is left is the spread of the blocks (median absolute
deviation x 1.4826): how much one slab differs from its neighbours. The reviewer's pass line is >= 14.0.

It replaces the earlier measure (standard deviation inside 16x16 blocks), which rewarded wide dark joints and white-noise
grain rather than the difference from slab to slab. Written by the art reviewer; kept here unchanged in what it computes.
Needs Pillow and numpy.
"""
import sys

import numpy as np
from PIL import Image


def slab_tone(path, rows=(705, 850), cols=(300, 1620), bw=24, bh=6):
    im = Image.open(path).convert("L")
    W, H = im.size
    s = H / 1080
    g = np.asarray(im, dtype=float)[int(rows[0] * s):int(rows[1] * s), int(cols[0] * s):int(cols[1] * s)]
    bw_, bh_ = max(2, int(bw * s)), max(2, int(bh * s))
    h, w = g.shape
    h -= h % bh_
    w -= w % bw_
    b = np.median(g[:h, :w].reshape(h // bh_, bh_, w // bw_, bw_).transpose(0, 2, 1, 3).reshape(h // bh_, w // bw_, -1), axis=2)
    k = 3
    p = np.pad(b, k, mode="edge")
    t = np.zeros_like(b)
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1):
            t += p[k + dy:k + dy + b.shape[0], k + dx:k + dx + b.shape[1]]
    r = b - t / (2 * k + 1) ** 2
    return np.median(np.abs(r - np.median(r))) * 1.4826


if __name__ == "__main__":
    for path in sys.argv[1:]:
        print(path, round(slab_tone(path), 2))
