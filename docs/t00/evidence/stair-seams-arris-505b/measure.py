#!/usr/bin/env python3
"""Measures the stair seams and arrises in a two-metre close view, as the art review asked (PR #544 comment 7068051281):
python3 measure.py base.png new.png [--y0 432] [--y1 632] > report.json
Seams are found in the *base* picture (full, even, dark lines) and read again at the same place in the new one, so that both
pictures are asked about the same joints. Everything here is a proxy: the art review judges the picture, these numbers only say
whether the change is heavy enough to be looked at (art-gate 14)."""
import sys, json
import numpy as np
from PIL import Image

def lum(p): return np.asarray(Image.open(p).convert('L')).astype(float)
def ref(L, y, x):   # the stone beside a seam: 6-14 px out on both sides
    a = L[y, max(x - 14, 0):max(x - 6, 0)]; b = L[y, x + 6:x + 14]
    v = np.concatenate([a, b]); return v.mean() if v.size else np.nan

def seams(base, y0, y1):
    """tracked dark vertical runs in the base picture: [(rows, xs)] with at least 8 rows"""
    H, W = base.shape; cols = {}
    for y in range(y0, y1):
        row = base[y]; xs = []
        for x in range(16, W - 16):
            r = ref(base, y, x)
            if row[x] < .8 * r and row[x] == row[x - 3:x + 4].min(): xs.append(x)
        cols[y] = xs
    runs = []; open_ = []
    for y in range(y0, y1):
        nxt = []
        for x in cols[y]:
            m = [r for r in open_ if abs(r['xs'][-1] - x) <= 3 and r['rows'][-1] == y - 1]
            if m: m[0]['rows'].append(y); m[0]['xs'].append(x); nxt.append(m[0])
            else: nxt.append({'rows': [y], 'xs': [x]})
        for r in open_:
            if r not in nxt and len(r['rows']) >= 8: runs.append(r)
        open_ = nxt
    runs += [r for r in open_ if len(r['rows']) >= 8]
    return runs

def width(L, y, x, r0, lo):
    thr = (r0 + lo) / 2; w = 1; a = x - 1
    while a > x - 12 and L[y, a] < thr: w += 1; a -= 1
    b = x + 1
    while b < x + 12 and L[y, b] < thr: w += 1; b += 1
    return w

def main():
    base, new = lum(sys.argv[1]), lum(sys.argv[2]); y0, y1 = 432, 632
    for i, a in enumerate(sys.argv):
        if a == '--y0': y0 = int(sys.argv[i + 1])
        if a == '--y1': y1 = int(sys.argv[i + 1])
    runs = seams(base, y0, y1); out = {'seam_runs': len(runs)}
    rows = {'tread': [], 'riser': []}; widths = {'tread': [], 'riser': []}; rat = {'tread': [], 'riser': []}
    for r in runs:
        for y, x in zip(r['rows'], r['xs']):
            r0 = ref(new, y, x)
            if not r0 == r0: continue
            xx = x - 2 + int(np.argmin(new[y, x - 2:x + 3])); lo = new[y, xx]; q = lo / r0
            k = 'tread' if r0 > 100 else 'riser'
            rows[k].append(q >= .8); rat[k].append(q)
            if q < .8: widths[k].append(width(new, y, xx, r0, lo))
    for k in rows:
        n = len(rows[k])
        out[k] = {'seam_rows': n, 'filled_share': round(float(np.mean(rows[k])), 3) if n else None,
                  'open_mean_ratio': round(float(np.mean([q for q in rat[k] if q < .8])), 3) if any(q < .8 for q in rat[k]) else None,
                  'ratio_p10': round(float(np.percentile(rat[k], 10)), 3) if rat[k] else None,
                  'open_width_px_hist': {str(w): int(sum(1 for v in widths[k] if v == w)) for w in range(1, 7)}}
    allr = rows['tread'] + rows['riser']
    out['filled_share_all'] = round(float(np.mean(allr)), 3) if allr else None
    # nose: down a column chunk, each step's edge is a row where the gray falls by a third inside 3 px (a bright tread above, the dark
    # lip below). d is the pitch from one nose to the next; the tread is about 55% of it, a nose band 4-6 cm of a 39 cm tread, so the
    # crest is looked for within .09 d above the edge and the tread beside it (the review: "the tread just inside the band") at .10-.18 d.
    res = []
    for x0 in range(40, new.shape[1] - 100, 100):
        prof = new[200:y1 + 3, x0:x0 + 100].mean(axis=1); es = []
        for i in range(6, len(prof) - 5):
            if prof[i + 3] < .68 * prof[i] and prof[i] > 90 and (not es or i - es[-1] > 8): es.append(i + 1)
        for p, e in zip(es, es[1:]):
            d = e - p
            if d < 14: continue
            lo, hi = max(int(e - .09 * d), e - 14), e
            seg = prof[lo:hi]; crest = float(seg.max()); r_ = float(prof[int(e - .18 * d):int(e - .10 * d)].mean())
            h = 0
            for t in range(e - 1, e - int(.4 * d), -1):
                if prof[t] > 1.05 * r_: h += 1
                elif h: break
            res.append({'x': x0, 'edge_y': 200 + int(e), 'pitch_px': int(d), 'crest_over_tread': round(crest / r_, 3), 'band_px': h,
                        'dark_under': round(float(prof[e + 2] / crest), 3) if e + 2 < len(prof) else None})
    out['noses'] = res
    if res:
        out['crest_over_tread_median'] = round(float(np.median([r['crest_over_tread'] for r in res])), 3)
        out['band_px_median'] = float(np.median([r['band_px'] for r in res]))
        low = [r for r in res if r['edge_y'] > y0]; out['lowest_steps_band_px_median'] = float(np.median([r['band_px'] for r in low])) if low else None
        mid = [r for r in low if 340 <= r['x'] <= 840]; ends = [r for r in low if r['x'] < 240 or r['x'] > 940]
        if mid and ends:
            out['band_px_mid_third_mean'] = round(float(np.mean([r['band_px'] for r in mid])), 2)
            out['band_px_ends_mean'] = round(float(np.mean([r['band_px'] for r in ends])), 2)
    # how heavy: mean absolute difference over the stairs, 0..255 (the review's floor is 8)
    a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float); b = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(float)
    out['mean_abs_diff_stairs'] = round(float(np.abs(a - b)[130:y1 + 3].mean()), 2)
    print(json.dumps(out, indent=1))
main()
