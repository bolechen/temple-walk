#!/usr/bin/env python3
"""How wide an edge reads on the screen, in pixels (#496: the rim of a puddle seen from above).

    python3 tools/edge-width.py picture.png x:y0-y1 [x:y0-y1 ...] [--across]

For each probe the mean luminance of the three columns round `x`, over the rows y0..y1, is taken down the picture (with
`--across`: of the three rows round the given y, over the columns x0..x1, written `y:x0-x1`). The two ends of the probe are
the plateaus on either side of the edge (the median of the first and of the last three samples); the width is the distance
between the 10 % and the 90 % crossings of the way from one plateau to the other, linearly interpolated. A probe with less
than 25 luminance levels between its plateaus is not an edge and is reported as such. Needs Pillow and numpy.
"""
import sys

import numpy as np
from PIL import Image


def profile(path, spec, across=False):
    g = np.asarray(Image.open(path).convert("L"), dtype=float)
    a, b = spec.split(":")
    lo, hi = (int(v) for v in b.split("-"))
    c = int(a)
    if across:
        return g[c - 1:c + 2, lo:hi + 1].mean(axis=0)
    return g[lo:hi + 1, c - 1:c + 2].mean(axis=1)


def width(p, min_step=25.0):
    a, z = float(np.median(p[:3])), float(np.median(p[-3:]))
    if abs(z - a) < min_step:
        return None
    t = (p - a) / (z - a)
    t = np.maximum.accumulate(np.clip(t, 0, 1))   # one edge, read in one direction

    def cross(level):
        i = int(np.argmax(t >= level))
        return i if i == 0 else i - 1 + (level - t[i - 1]) / max(t[i] - t[i - 1], 1e-9)

    return cross(0.9) - cross(0.1)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    across = "--across" in sys.argv
    path, probes = args[0], args[1:]
    for spec in probes:
        w = width(profile(path, spec, across))
        print(spec, "not an edge" if w is None else f"{w:.1f} px")
