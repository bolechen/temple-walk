#!/usr/bin/env python3
"""How a picture reads, in numbers: the measures docs/t00/art-targets.md sets for each of the six prototype views.

    python3 tools/look.py <image> [...]            one JSON line per picture
    python3 tools/look.py --check <view> <image>   that picture against the target for <view>; exits 1 if it misses

The picture is measured in CIE L*a*b* (D65): how light its darkest, middle and lightest tenth are, how far apart they
lie, how strongly coloured it is, which way the light parts and the dark parts lean in hue (warm or cool, green or
red), and how light it is from the top of the frame to the bottom, in five bands (sky, mist, ground). It needs only
numpy and Pillow. A picture of another shape is measured as it is; the targets were taken from 2.39:1 frames.
"""
import json, sys
import numpy as np
from PIL import Image

TARGETS = "docs/t00/art-targets.json"


def lab(path, width=640):
    im = Image.open(path).convert("RGB")
    im = im.resize((width, max(1, round(im.height * width / im.width))))
    c = np.asarray(im, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def measure(path):
    L, a, b = np.moveaxis(lab(path), -1, 0)
    p05, p50, p95 = np.percentile(L, [5, 50, 95])
    lo, hi = L <= np.percentile(L, 10), L >= np.percentile(L, 90)
    mid = (L > np.percentile(L, 25)) & (L < np.percentile(L, 75))
    C = np.hypot(a, b)
    bands = [round(float(x.mean()), 1) for x in np.array_split(L, 5, axis=0)]
    r = lambda v: round(float(v), 1)
    return {
        "image": path,
        "L05": r(p05), "L50": r(p50), "L95": r(p95), "range": r(p95 - p05),
        "chroma": r(C[mid].mean()),
        "light_a": r(a[hi].mean()), "light_b": r(b[hi].mean()),
        "shade_a": r(a[lo].mean()), "shade_b": r(b[lo].mean()),
        "split_b": r(b[hi].mean() - b[lo].mean()),
        "bands": bands,
    }


def check(view, path):
    entry = json.load(open(TARGETS))["views"][view]
    target = entry["measures"]
    m, misses = measure(path), []
    for key, (want, tol) in target.items():
        if key == "bands":
            got = m["bands"]
            for i, (w, g) in enumerate(zip(want, got)):
                if abs(g - w) > tol: misses.append(f"band {i + 1}: {g} (want {w} ± {tol})")
        elif abs(m[key] - want) > tol:
            misses.append(f"{key}: {m[key]} (want {want} ± {tol})")
    out = {"view": view, "measures": m, "misses": misses}
    if entry.get("rebaseline"):   # the view's hour has changed since its targets were measured: they do not judge it
        out["rebaseline"] = entry.get("note", True)
    print(json.dumps(out, ensure_ascii=False))
    return not misses


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--check"]:
        sys.exit(0 if check(args[1], args[2]) else 1)
    for p in args: print(json.dumps(measure(p), ensure_ascii=False))
