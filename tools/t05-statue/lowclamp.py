# A closed eye's upper lid, which stands off the face like a fin seen from the side, pressed back on the thinned levels
# only (issue #463, after r8: the 3D review and the T05 lead). The full mesh keeps its carving and the normals are still
# baked from it (bake.py), so the lid's groove and edge stay in the normal map and the painted lid line, laid on the full
# mesh's slit, does not break.
#
#   python3 tools/t05-statue/lowclamp.py <low.glb> <out.glb> <points.json> [--height=8.6] [--report=<file.json>]
#
# points.json as face-ratios.py takes it ("eyes": the bowed eyes, [x, y]). In the figure's frame (metres, y up from the
# seat, z toward the viewer) the face's smooth surface over each eye is taken as the line drawn up the face from the
# cheek under the eye (BELOW under its slit) to the brow over it (ABOVE), each read at the same place across as the
# foremost surface there (a smoothing of the mesh would not do: it shrinks the head, or keeps a ledge as wide as the
# lid). Over the eye (within HALF of its middle across, between the cheek and the brow) nothing stands more than CAP_EYE
# in front of that line; further out, to the temple (OUT beyond), nothing more than CAP_OUT. What lies behind the line
# stays as it is. The report gives, for each side, the most anything stood in front of the line before and after.
import sys, json
import numpy as np, trimesh
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
src, dst, ptsf = args; H = float(opt.get("height", 8.6)); pts = json.load(open(ptsf))
HALF, OUT, BELOW, ABOVE, CAP_EYE, CAP_OUT, BIN, FRONT = 0.19, 0.12, 0.06, 0.08, 0.03, 0.005, 0.01, 0.1
scene = trimesh.load(src)
name, m = next(iter(scene.geometry.items())) if isinstance(scene, trimesh.Scene) else (None, scene)
v0 = m.vertices.copy(); mn, mx = v0.min(0), v0.max(0); s = H / (mx[1] - mn[1]); off = np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])
v = (v0 - off) * s; x, y, z = v[:, 0], v[:, 1], v[:, 2]
ray = trimesh.ray.ray_triangle.RayMeshIntersector(trimesh.Trimesh(v, m.faces, process=False))
def front(xs, yy):   # the foremost surface straight in front, at each x, at height yy
  o = np.c_[xs, np.full_like(xs, yy), np.full_like(xs, 5.0)]; loc, idx, _ = ray.intersects_location(o, np.tile([0, 0, -1.0], (len(o), 1)), multiple_hits=False)
  zz = np.full(len(xs), np.nan); zz[idx] = loc[:, 2]; return zz
report = {}
for e, (ex, ey) in pts["eyes"].items():
  sg = 1.0 if ex > 0 else -1.0; lo, hi = ey - BELOW, ey + ABOVE
  xs = np.arange(ex - sg * HALF, ex + sg * (HALF + OUT) + sg * BIN, sg * BIN); zt, zb = front(xs, hi), front(xs, lo)
  ok = ~np.isnan(zt) & ~np.isnan(zb); xs_, zt, zb = xs[ok], zt[ok], zb[ok]; order = np.argsort(xs_); xs_, zt, zb = xs_[order], zt[order], zb[order]
  t = (x - ex) * sg
  sel = np.nonzero((t >= -HALF) & (t <= HALF + OUT) & (y >= lo) & (y <= hi) & (z > FRONT))[0]
  f = (y[sel] - lo) / (hi - lo); ref = np.interp(x[sel], xs_, zb) + f * (np.interp(x[sel], xs_, zt) - np.interp(x[sel], xs_, zb))
  cap = np.where(t[sel] <= HALF, CAP_EYE, CAP_OUT); over = z[sel] - ref
  before = {"eye": float(over[t[sel] <= HALF].max()), "temple": float(over[t[sel] > HALF].max()) if (t[sel] > HALF).any() else 0.0}
  z[sel] = np.where(over > cap, ref + cap, z[sel])
  after = z[sel] - ref
  report[e] = {"eye_before_m": round(before["eye"], 4), "eye_after_m": round(float(after[t[sel] <= HALF].max()), 4),
               "temple_before_m": round(before["temple"], 4), "temple_after_m": round(float(after[t[sel] > HALF].max()) if (t[sel] > HALF).any() else 0.0, 4),
               "points_moved": int((over > cap).sum())}
v[:, 2] = z; m.vertices = v / s + off
(scene if name else m).export(dst)
out = {"src": src, "dst": dst, "half_m": HALF, "out_m": OUT, "below_m": BELOW, "above_m": ABOVE, "cap_eye_m": CAP_EYE, "cap_temple_m": CAP_OUT, "sides": report}
if "report" in opt: json.dump(out, open(opt["report"], "w"), indent=1)
print(json.dumps(out))
