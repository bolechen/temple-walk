# How deep are the lines in the upper face? (issue #701, the art director: the brows' grooves to the nose's root, a line under each lower lid, the outer eye corner)
#
#   python3 tools/t05-statue/relief.py <statue.glb> <face.json> <points.json> <eye height, stage m> [--blur=0.05] [--png=<relief.png>] [--flat]
#
# The front surface of the face is read by rays on a 5 mm grid (depth toward the viewer, stage metres), the same surface blurred with a Gaussian of `blur` metres is subtracted, and the
# result (the relief: negative in a groove, positive on a ridge) is given for the blocks in question, as the deepest groove and the deepest ridge, in millimetres of the stage and in
# model millimetres (the file's unit x 1000; stage mm / the figure's scale). A block is a box in the bowed face's own frame: x across from the middle, y up from the slit.
import sys, json
import numpy as np, trimesh
from scipy.ndimage import gaussian_filter
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
glb, facef, ptsf, eyey = args[0], args[1], args[2], float(args[3]); face = json.load(open(facef)); pts = json.load(open(ptsf)); blur = float(opt.get("blur", 0.05))
m = trimesh.load(glb, force="mesh"); v = m.vertices; mn, mx = v.min(0), v.max(0); s = face["height"] / (mx[1] - mn[1]); m.vertices = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s
ray = trimesh.ray.ray_triangle.RayMeshIntersector(m)
xs = np.arange(-0.5, 0.5001, 0.005); ys = np.arange(eyey - 0.45, eyey + 0.25, 0.005); X, Y = np.meshgrid(xs, ys)
o = np.c_[X.ravel(), Y.ravel(), np.full(X.size, 5.0)]; loc, idx, _ = ray.intersects_location(o, np.tile([0, 0, -1.0], (len(o), 1)), multiple_hits=False)
Z = np.full(X.size, np.nan); Z[idx] = loc[:, 2]; Z = Z.reshape(X.shape); ok = ~np.isnan(Z); Z0 = np.where(ok, Z, np.nanmean(Z))
sm = gaussian_filter(Z0, blur / 0.005); R = (Z0 - sm) * 1000   # stage mm
inv = 1 / (s * 1.0)   # stage mm -> model mm: stage mm / s (file unit x 1000 = mm of a figure 1 tall; one stage metre is 1/s file units)
def block(name, x0, x1, y0, y1):
  mk = (np.abs(X) >= x0) & (np.abs(X) <= x1) & (Y >= eyey + y0) & (Y <= eyey + y1) & ok
  r = R[mk]; print(f"  {name:44s} deepest groove {r.min():6.2f} stage mm = {r.min() / s:6.3f} model mm   highest ridge {r.max():6.2f} = {r.max() / s:6.3f}   ({int(mk.sum())} samples)")
print(f"{glb.split('/')[-1]}  (blur {blur} m; eye height {eyey} m; scale {s:.3f})")
if "png" in opt:
  from PIL import Image
  Image.fromarray(np.clip(128 + R * 12, 0, 255).astype(np.uint8)[::-1]).save(opt["png"])
if "flat" in opt:   # the blocks of the eye-area flattening (flatblocks), as boxes that leave the lids out: the same boxes before and after (issue #701)
  block("A1 above the inner corner (|x| .06-.12, up .03 .12)", 0.06, 0.12, 0.03, 0.12)
  block("A2 down the nose's side (|x| .09-.13, up -.15 -.05)", 0.09, 0.13, -0.15, -0.05)
  block("B the line under the lower lid (|x| .12-.30, up -.11 -.065)", 0.12, 0.30, -0.11, -0.065)
  sys.exit(0)
block("brow head to the nose's root (x .02-.14, up .02 -.20)", 0.02, 0.14, -0.20, 0.02)
block("between the brows (x 0-.05, up -.02 .12)", 0.0, 0.05, -0.02, 0.12)
block("under the lower lid (x .06-.28, up -.10 -.025)", 0.06, 0.28, -0.10, -0.025)
block("outer corner of the eye (x .26-.40, up -.06 .05)", 0.26, 0.40, -0.06, 0.05)
