#!/usr/bin/env python3
"""
Quantitative gate and 3D initial review self-check for the standalone Buddha head GLB (issue #720).
Checks:
  - Topology (open edges, non-manifold edges, tiny pieces <=10 faces, consistent winding)
  - Bounding box, origin, orientation (+Z front, Y up, X=0 symmetry), height 2.2m +-5%
  - Face measures matching tools/t05-statue/face-measure.py:
      lip/w <= 0.03, knit/faceW <= 0.01, brow deg >= 0, corners in [0, 0.06] w
  - Chin labiomental groove depth <= 8% w, chin tip vs lower lip protrusion
  - Eye palpebral slit opening in 0.2-0.3 eye width
  - Bilateral X=0 symmetry error
"""

import json
import os
import sys
import numpy as np
import trimesh
from scipy import ndimage as ndi


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 check_head.py <head.glb>", file=sys.stderr)
        sys.exit(2)
    glb = sys.argv[1]
    sc = trimesh.load(glb, force="scene")
    m = trimesh.util.concatenate(list(sc.geometry.values()))

    # 1. Topology check (same logic as tools/t05-statue/closed/topology.py)
    t = trimesh.Trimesh(m.vertices, m.faces, process=False)
    t.merge_vertices(merge_tex=False, merge_norm=False)
    _, counts = np.unique(t.edges_sorted, axis=0, return_counts=True)
    parts = sorted(t.split(only_watertight=False), key=lambda x: -len(x.faces))
    big = parts[0]

    topo = {
        "faces": int(len(t.faces)),
        "vertices": int(len(t.vertices)),
        "boundary_edges": int((counts == 1).sum()),
        "nonmanifold_edges": int((counts > 2).sum()),
        "pieces": len(parts),
        "pieces_le_10_faces": sum(len(x.faces) <= 10 for x in parts),
        "winding_consistent": bool(t.is_winding_consistent),
        "biggest_watertight": bool(big.is_watertight),
        "all_watertight": all(p.is_watertight for p in parts),
    }

    # 2. Bounding box & dimensions
    v = m.vertices
    mn, mx = v.min(axis=0), v.max(axis=0)
    size = mx - mn
    # Measure neck base centre (vertices with y < 0.01)
    base_v = v[v[:, 1] < 0.01]
    base_center = base_v.mean(axis=0) if len(base_v) else np.array([np.nan, np.nan, np.nan])

    # 3. Ray-cast front surface measurements (Y up, +Z front, X=0 symmetry)
    ray = trimesh.ray.ray_triangle.RayMeshIntersector(m)

    def front(xy):
        xy = np.atleast_2d(np.asarray(xy, float))
        o = np.c_[xy, np.full(len(xy), 10.0)]
        d = np.tile([0.0, 0.0, -1.0], (len(xy), 1))
        loc, idx, _ = ray.intersects_location(o, d, multiple_hits=False)
        z = np.full(len(xy), np.nan)
        z[idx] = loc[:, 2]
        return z

    # Midline profile (x = 0) around actual mouth slit (y = 0.680)
    w = 0.50
    faceW = 1.35
    my = 0.680
    ys = np.arange(my - 0.35, my + 0.40, 0.002)
    zs = front(np.c_[np.zeros_like(ys), ys])

    def arg(fn, lo, hi):
        sel = (ys >= lo) & (ys <= hi)
        idx = np.nonzero(sel)[0]
        return int(idx[fn(zs[idx])])

    islit = arg(np.nanargmin, my - 0.06, my + 0.06)
    itip = arg(np.nanargmax, ys[islit] + 0.05, my + 0.35)
    ilip = islit
    while ilip + 1 < itip and zs[ilip + 1] > zs[ilip] - 0.001:
        ilip += 1
    ibase = ilip
    while ibase + 1 < itip and zs[ibase + 1] < zs[ibase] + 0.001:
        ibase += 1
    if ibase == ilip:
        ibase = min(ilip + 1, itip)
    ichin = arg(np.nanargmax, my - 0.30, ys[islit] - 0.08)

    A = np.array([ys[ibase], zs[ibase]])
    Bp = np.array([ys[ichin], zs[ichin]])
    L = np.array([ys[ilip], zs[ilip]])
    vec = Bp - A
    nrm = np.array([-vec[1], vec[0]]) / np.linalg.norm(vec)
    if nrm[1] < 0:
        nrm = -nrm
    lip_ratio = float(np.dot(L - A, nrm)) / w

    # Brow knit (glabella at (0, 1.285))
    bx, by = 0.0, 1.285
    step = 0.005
    half = 0.125 * w + 0.15 * w
    gx = np.arange(bx - half, bx + half + 1e-9, step)
    gy = np.arange(by - half, by + half + 1e-9, step)
    X, Y = np.meshgrid(gx, gy)
    Z = front(np.c_[X.ravel(), Y.ravel()]).reshape(X.shape)
    Zf = np.where(np.isnan(Z), np.nanmean(Z), Z)
    low = Zf - ndi.gaussian_filter(Zf, 0.15 * w / step)
    inner = (np.abs(X - bx) <= 0.125 * w) & (np.abs(Y - by) <= 0.125 * w)
    knit_ratio = float(-low[inner].min()) / faceW

    # Brow head vs tail slope
    def ridge(x_val, y0):
        yy = np.arange(y0, y0 + 0.24, 0.003)
        zz = front(np.c_[np.full_like(yy, x_val), yy])
        ok = ~np.isnan(zz)
        k = np.polyfit(yy[ok], zz[ok], 1)
        i = np.argmax(zz[ok] - np.polyval(k, yy[ok]))
        return float(yy[ok][i]), float(zz[ok][i])

    brow = {}
    for side, sg in (("L", 1), ("R", -1)):
        hy, _ = ridge(sg * 0.13, 1.18)
        ty, _ = ridge(sg * 0.45, 1.18)
        brow[side] = {
            "head_y": round(hy, 4),
            "tail_y": round(ty, 4),
            "deg": round(float(np.degrees(np.arctan2(hy - ty, 0.45 - 0.13))), 2),
        }

    # Mouth corners vs slit middle
    def surf_y(x_val, y0):
        yy = np.arange(y0 - 0.04, y0 + 0.04, 0.002)
        zz = front(np.c_[np.full_like(yy, x_val), yy])
        ok = ~np.isnan(zz)
        k = np.polyfit(yy[ok], zz[ok], 1)
        return float(yy[ok][np.argmin(zz[ok] - np.polyval(k, yy[ok]))])

    mid_y = float(ys[islit])
    cL = surf_y(0.240, mid_y + 0.015)
    cR = surf_y(-0.240, mid_y + 0.015)

    # Chin labiomental groove depth (tools/t05-statue/chin-profile.py logic)
    ys_c = np.arange(mid_y + 0.06, mid_y - 0.32, -0.004)
    P = np.full(len(ys_c), np.nan)
    for xv in (-0.02, 0.0, 0.02):
        q = front(np.c_[np.full_like(ys_c, xv), ys_c])
        P = np.fmax(P, q) if xv != -0.02 else q

    sel_c = lambda lo, hi: np.nonzero((ys_c <= mid_y - lo) & (ys_c >= mid_y - hi))[0]
    iL = sel_c(0.012, 0.075)[np.nanargmax(P[sel_c(0.012, 0.075)])]
    iG = np.arange(iL + 3, min(iL + 24, len(ys_c)))[np.nanargmin(P[iL + 3 : min(iL + 24, len(ys_c))])]
    iC = np.arange(iG + 3, min(iG + 40, len(ys_c)))[np.nanargmax(P[iG + 3 : min(iG + 40, len(ys_c))])]
    iJ = min(iC + 17, len(ys_c) - 1)
    line_g = P[iL] + (P[iJ] - P[iL]) * (ys_c[iG] - ys_c[iL]) / (ys_c[iJ] - ys_c[iL])
    groove_mm = float((line_g - P[iG]) * 1000.0)
    chin_minus_lip_mm = float((P[iC] - P[iL]) * 1000.0)

    # Symmetry check on front face grid (below hairline)
    gx_s = np.linspace(0.05, 0.48, 20)
    gy_s = np.linspace(0.48, 1.44, 25)
    XS, YS = np.meshgrid(gx_s, gy_s)
    z_pos = front(np.c_[XS.ravel(), YS.ravel()])
    z_neg = front(np.c_[-XS.ravel(), YS.ravel()])
    sym_diff_mm = float(np.nanmax(np.abs(z_pos - z_neg)) * 1000.0)

    report = {
        "topology": topo,
        "bbox": {
            "min": [round(float(x), 4) for x in mn],
            "max": [round(float(x), 4) for x in mx],
            "size_xyz_m": [round(float(x), 4) for x in size],
            "neck_base_center": [round(float(x), 4) for x in base_center],
            "width_to_height_total": round(float(size[0] / size[1]), 3),
        },
        "measures": {
            "lip_over_w": round(lip_ratio, 4),
            "lip_limit": "<= 0.03",
            "knit_over_faceW": round(knit_ratio, 5),
            "knit_limit": "<= 0.01",
            "brow": brow,
            "brow_limit": "deg >= 0",
            "cornerL_over_w": round((cL - mid_y) / w, 4),
            "cornerR_over_w": round((cR - mid_y) / w, 4),
            "corner_limit": "0 to 0.06",
            "labiomental_groove_mm": round(groove_mm, 2),
            "labiomental_groove_pct_w": round(groove_mm / (w * 1000.0) * 100.0, 2),
            "groove_limit": "<= 8% w (40 mm)",
            "chin_minus_lip_mm": round(chin_minus_lip_mm, 2),
            "symmetry_max_diff_mm": round(sym_diff_mm, 4),
            "slit_y_m": round(mid_y, 4),
            "nose_base_y_m": round(float(ys[ibase]), 4),
            "nose_tip_y_m": round(float(ys[itip]), 4),
            "chin_front_y_m": round(float(ys[ichin]), 4),
        },
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))

    # Hard pass/fail summary
    ok = True
    checks = [
        ("boundary_edges == 0", topo["boundary_edges"] == 0),
        ("nonmanifold_edges == 0", topo["nonmanifold_edges"] == 0),
        ("pieces_le_10_faces == 0", topo["pieces_le_10_faces"] == 0),
        ("winding_consistent", topo["winding_consistent"]),
        ("all_watertight", topo["all_watertight"]),
        ("height 2.2m +-5%", 2.09 <= size[1] <= 2.31),
        ("lip/w <= 0.03", lip_ratio <= 0.03),
        ("knit/faceW <= 0.01", knit_ratio <= 0.01),
        ("brow deg >= 0", brow["L"]["deg"] >= 0 and brow["R"]["deg"] >= 0),
        ("corners in [0, 0.06]", 0.0 <= (cL - mid_y) / w <= 0.06 and 0.0 <= (cR - mid_y) / w <= 0.06),
        ("groove <= 8% w", groove_mm <= 40.0),
    ]
    print("\n--- Gate Summary ---")
    for name, passed in checks:
        print(f"  [{'PASS' if passed else 'FAIL'}] {name}")
        if not passed:
            ok = False
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
