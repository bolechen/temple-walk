# The lower face's midline profile as the figure stands upright, in numbers (issue #701): the lower lip's foremost point, the groove under it, the chin's tip and the jaw, and how far
# the chin's tip stands behind (-) or before (+) the lip's, and the groove's depth under the straight line from lip to jaw.
#
#   python3 tools/t05-statue/chin-profile.py <face.json> <slit stage m> <bow deg> <statue.glb>...     (bow 0 for a file that is not bowed)
#
# Depth is read down the midline (|x| < 3 cm) by rays in the file's own frame; the chin-minus-lip figure is also given as the upright figure would have it (the bow turns the chin back
# relative to the lip by the height between them times the sine of the bow).
import sys, json
import numpy as np, trimesh
facef, slit, bow = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); face = json.load(open(facef)); cy, cz = face["neck"]["c"]
for f in sys.argv[4:]:
  m = trimesh.load(f, force="mesh"); v = m.vertices; mn, mx = v.min(0), v.max(0); s = face["height"] / (mx[1] - mn[1])
  v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s; a = np.radians(bow); m.vertices = v   # the profile is read in the file's own (bowed) frame; the bow is allowed for in the last column
  ray = trimesh.ray.ray_triangle.RayMeshIntersector(m); ys = np.arange(slit + 0.06, slit - 0.36, -0.004)
  P = np.full(len(ys), np.nan)
  for x in (-0.02, 0.0, 0.02):
    o = np.c_[np.full_like(ys, x), ys, np.full_like(ys, 5.0)]; loc, idx, _ = ray.intersects_location(o, np.tile([0, 0, -1.0], (len(o), 1)), multiple_hits=False)
    q = np.full(len(ys), np.nan); q[idx] = loc[:, 2]; P = np.fmax(P, q) if x != -0.02 else q
  # (the slit of an upright figure sits a little higher than the bowed one's: search the lip a window under the nose's base)
  sel = lambda lo, hi: np.nonzero((ys <= slit - lo) & (ys >= slit - hi))[0]
  iL = sel(0.012, 0.075)[np.nanargmax(P[sel(0.012, 0.075)])]; iG = np.arange(iL + 3, min(iL + 24, len(ys)))[np.nanargmin(P[iL + 3:min(iL + 24, len(ys))])]
  iC = np.arange(iG + 3, min(iG + 40, len(ys)))[np.nanargmax(P[iG + 3:min(iG + 40, len(ys))])]; iJ = min(iC + 17, len(ys) - 1)
  line = P[iL] + (P[iJ] - P[iL]) * (ys[iG] - ys[iL]) / (ys[iJ] - ys[iL])
  print(f"{f.split('/')[-1]:34s} lip {ys[iL]-slit:+.3f}m {P[iL]*1000:6.1f}  groove {ys[iG]-slit:+.3f}m {P[iG]*1000:6.1f} (depth {line*1000-P[iG]*1000:5.1f} mm under the lip-jaw line)  chin {ys[iC]-slit:+.3f}m {P[iC]*1000:6.1f}  chin tip - lip tip {1000*(P[iC]-P[iL]):+6.1f} mm in the file, {1000*((P[iC]-P[iL])*np.cos(a)-(ys[iC]-ys[iL])*np.sin(a)):+6.1f} mm upright")
