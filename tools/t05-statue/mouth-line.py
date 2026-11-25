# The mouth's slit as a line across the face, with the head upright (issue #701, the art director: the corners read as pulled down): for each x across, the height of the slit (the deepest dip
# of the surface between the lips along y), turned back by the bow about the neck's pivot so that heights are the upright figure's. Prints the height of the slit over the middle's, in mm of the stage.
#
#   python3 tools/t05-statue/mouth-line.py <face.json> <slit stage m (bowed)> <bow deg> <statue.glb>...
import sys, json
import numpy as np, trimesh
facef, slit, bow = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); face = json.load(open(facef)); cy, cz = face["neck"]["c"]; a = np.radians(bow)
for f in sys.argv[4:]:
  m = trimesh.load(f, force="mesh"); v = m.vertices; mn, mx = v.min(0), v.max(0); s = face["height"] / (mx[1] - mn[1])
  m.vertices = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s; ray = trimesh.ray.ray_triangle.RayMeshIntersector(m)
  xs = np.arange(-0.20, 0.2001, 0.02); ys = np.arange(slit - 0.06, slit + 0.04, 0.002); out = []
  for x in xs:
    o = np.c_[np.full_like(ys, x), ys, np.full_like(ys, 5.0)]; loc, idx, _ = ray.intersects_location(o, np.tile([0, 0, -1.0], (len(o), 1)), multiple_hits=False)
    d = np.full(len(ys), np.nan); d[idx] = loc[:, 2]; k = np.nanargmin(np.where(np.arange(len(ys)) < 3, np.nan, d)[: len(ys) - 3]) if np.isfinite(d).any() else 0
    # the dip: the point where the depth is least between the lips (the crease), searched within 3 cm of the middle's slit
    sel = np.nonzero(np.abs(ys - slit) < 0.03)[0]; k = sel[np.nanargmin(d[sel])]
    yb, zb = ys[k], d[k]; dy, dz = yb - cy, zb - cz; up = cy + dy * np.cos(a) + dz * np.sin(a)
    out.append((x, up))
  mid = [u for x, u in out if abs(x) < 1e-6][0]
  print(f.split("/")[-1], " ".join(f"x{x:+.2f}:{(u - mid) * 1000:+5.1f}" for x, u in out))
