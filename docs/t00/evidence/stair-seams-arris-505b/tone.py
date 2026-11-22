#!/usr/bin/env python3
"""How much the change moves the stairs' brightness (the lead's and the art director's checks):
python3 tone.py main.png new.png x0 y0 x1 y1
 - L50 and L95 of the stairs' CIE L* (the median and the bright end),
 - the share of stair pixels near white (any channel >= 240: the sunlit faces, burnt out or not),
 - the spread of stone to stone inside one tread: along each row, the stones between seams (at least 30 px wide) each take their mean L*;
   the spread of a row is their standard deviation; reported as the median over rows (the art director's ceiling for T05 a-tall: 2.0 L*)."""
import sys, json
import numpy as np
from PIL import Image

def lstar(a):
    a = a / 255.0; lin = np.where(a <= .04045, a / 12.92, ((a + .055) / 1.055) ** 2.4)
    Y = .2126 * lin[..., 0] + .7152 * lin[..., 1] + .0722 * lin[..., 2]
    return np.where(Y > .008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)

def spread(L, base_L):
    """seams from the base picture's columns so both pictures are cut at the same joints"""
    H, W = L.shape; out = []
    for y in range(0, H):
        r = base_L[y]; k = np.convolve(r, np.ones(5) / 5, mode='same'); ref = np.convolve(r, np.ones(41) / 41, mode='same')
        cut = [x for x in range(8, W - 8) if k[x] < .8 * ref[x] and k[x] == k[x - 4:x + 5].min()]
        edges = [0] + cut + [W]; means = []
        for a, b in zip(edges, edges[1:]):
            if b - a >= 30: means.append(L[y, a + 5:b - 5].mean())
        if len(means) >= 3: out.append(np.std(means))
    return float(np.median(out)) if out else None

def main():
    a, b = sys.argv[1], sys.argv[2]; x0, y0, x1, y1 = map(int, sys.argv[3:7])
    A = np.asarray(Image.open(a).convert('RGB')).astype(float)[y0:y1, x0:x1]; B = np.asarray(Image.open(b).convert('RGB')).astype(float)[y0:y1, x0:x1]
    LA, LB = lstar(A), lstar(B); res = {}
    for k, L, I in (('main', LA, A), ('new', LB, B)):
        res[k] = {'L50': round(float(np.percentile(L, 50)), 2), 'L95': round(float(np.percentile(L, 95)), 2), 'mean_L': round(float(L.mean()), 2),
                  'near_white_share': round(float((I.max(axis=2) >= 240).mean()), 5), 'stone_spread_L': None}
    res['main']['stone_spread_L'] = spread(LA, LA); res['new']['stone_spread_L'] = spread(LB, LA)
    print(json.dumps(res))
main()
