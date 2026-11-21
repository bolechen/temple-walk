#!/usr/bin/env python3
"""Measure a stair picture for #505: how dark its joints are, how much their width varies, how far neighbouring stones differ.

    python3 -I measure.py <picture.png> [--region r0,r1,c0,c1] [--json out.json]

The region is given as fractions of the picture (default: rows 0.55-0.99, columns 0.20-0.80: the treads and risers of
cam02 in summer by day, not the cheeks or the slope). What it does, per picture:

* a joint is a run of pixels darker than the stone either side of it (under 0.88 of the mean of the pixels 5-10 px away); its measures use the stone 6-14 px out from the joint's own edges,
  at most 10 px wide, that holds for at least 8 rows in a column; its colour ratio is, per row, the darkest pixel over that
  mean (1.0 = no darker than the stone, 0 = black); its equivalent width, per row, is the sum of (1 - L / mean) across it;
* `ratio_median`: the median of the per-row ratios of every joint (the issue asks 0.4-0.7);
* `width_spread_median`: for each joint, (p90 - p10) / (2 * median) of its per-row equivalent widths: the half-range
  as a share of the typical width (the issue asks 0.30 or more);
* `stone_diff_median`: along rows where two joints or more were found, the stones between them (their middles, 5 px in from
  each joint, at least 30 px wide) are taken as one mean luminance each, and the median of |a - b| / mean(a, b) over
  neighbouring stones is the number (the issue asks 0.08 or more). Noise inside a stone is not counted: only the stone's mean.
These are proxies (skills/art-gate, judgment 14): look at the picture when the numbers and the picture disagree.
"""
import sys, json
import numpy as np
from PIL import Image

def luminance(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

def components(mask):
    """4-connected components of a boolean mask, as lists of (row, col)."""
    h, w = mask.shape; seen = np.zeros_like(mask, bool); out = []
    for r in range(h):
        for c in np.flatnonzero(mask[r] & ~seen[r]):
            if seen[r, c]: continue
            stack = [(r, c)]; seen[r, c] = True; comp = []
            while stack:
                y, x = stack.pop(); comp.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True; stack.append((yy, xx))
            out.append(comp)
    return out

def measure(path, region=(0.55, 0.99, 0.20, 0.80)):
    L = luminance(path); H, W = L.shape
    r0, r1, c0, c1 = int(H * region[0]), int(H * region[1]), int(W * region[2]), int(W * region[3])
    sub = L[r0:r1, c0:c1]
    # reference: the mean of the pixels 5..10 px to either side
    k = np.ones(6) / 6
    left = np.apply_along_axis(lambda v: np.convolve(v, k, "same"), 1, np.roll(sub, 8, axis=1))
    right = np.apply_along_axis(lambda v: np.convolve(v, k, "same"), 1, np.roll(sub, -8, axis=1))
    ref = (left + right) / 2
    ratio = sub / np.maximum(ref, 1e-3)
    mask = ratio < 0.88
    mask[:, :12] = False; mask[:, -12:] = False
    joints = []
    for comp in components(mask):
        ys = [p[0] for p in comp]; xs = [p[1] for p in comp]
        if max(ys) - min(ys) + 1 < 8 or max(xs) - min(xs) + 1 > 10: continue
        rows = {}
        for y, x in comp: rows.setdefault(y, []).append(x)
        if len(rows) < 8: continue
        per_ratio, per_width, centre = [], [], {}
        for y, xs_ in rows.items():
            xa, xb = min(xs_) - 1, max(xs_) + 2
            # the stone beside it: 6..14 px out from the joint's own edges, however wide the joint is
            nb = np.concatenate([sub[y, max(xa - 14, 0):max(xa - 6, 0)], sub[y, xb + 6:xb + 14]])
            if nb.size < 6: continue
            lref = float(nb.mean()); seg = sub[y, max(xa, 0):xb] / max(lref, 1e-3)
            per_ratio.append(seg.min()); per_width.append(float((1 - seg).clip(0).sum())); centre[y] = (min(xs_) + max(xs_)) / 2
        if len(per_width) < 8: continue
        w = np.array(per_width)
        joints.append({"rows": len(rows), "ratio": float(np.median(per_ratio)), "spread": float((np.percentile(w, 90) - np.percentile(w, 10)) / (2 * np.median(w))), "centre": centre})
    ratios = [j["ratio"] for j in joints]; spreads = [j["spread"] for j in joints]
    # stones between joints, row by row
    diffs = []
    byrow = {}
    for j in joints:
        for y, c in j["centre"].items(): byrow.setdefault(y, []).append(c)
    for y in sorted(byrow)[::3]:
        cs = sorted(byrow[y])
        if len(cs) < 2: continue
        means = []
        for a, b in zip(cs[:-1], cs[1:]):
            lo, hi = int(a) + 5, int(b) - 5
            if hi - lo >= 30: means.append(float(sub[y, lo:hi].mean()))
            else: means.append(None)
        for m1, m2 in zip(means[:-1], means[1:]):
            if m1 is not None and m2 is not None: diffs.append(abs(m1 - m2) / ((m1 + m2) / 2))
    return {"picture": path, "size": [W, H], "region_rows_cols": [r0, r1, c0 + 0, c1], "joints": len(joints),
            "ratio_median": float(np.median(ratios)) if ratios else None,
            "ratio_p10_p90": [float(np.percentile(ratios, 10)), float(np.percentile(ratios, 90))] if ratios else None,
            "width_spread_median": float(np.median(spreads)) if spreads else None,
            "stone_pairs": len(diffs), "stone_diff_median": float(np.median(diffs)) if diffs else None}

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args: print(__doc__); sys.exit(1)
    path = args[0]; region = (0.55, 0.99, 0.20, 0.80); out = None
    if "--region" in args: region = tuple(float(v) for v in args[args.index("--region") + 1].split(","))
    if "--json" in args: out = args[args.index("--json") + 1]
    res = measure(path, region); print(json.dumps(res, indent=1, ensure_ascii=False))
    if out: json.dump(res, open(out, "w"), indent=1, ensure_ascii=False)
