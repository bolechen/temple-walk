# A replay of the varada graft checked against the reference file the owner accepted (issue #514, build 81, sha256
# 36d4abc2…; the 3D review's rule on #529, 2026-11-22): a replay is accepted when it has the same points and faces in
# the same order and no point lies more than 0.01 mm from the reference's, not by its hash, since two runs differ by
# about a micrometre (docs/t05/evidence/514-r2-final81/determinism.json).
#
#   python3 tools/blender/varada-compare.py <replayed .glb> <reference .glb> [--limit-mm=0.01]
#
# Both are stood at the figure's height (8.2 m, the stage frame of tools/blender/varada.py) before comparing. Prints one
# line of json and exits 1 if the replay is not accepted.
import sys, json
import numpy as np, trimesh

args = [a for a in sys.argv[1:] if not a.startswith("--")]
lim = float(next((a.split("=")[1] for a in sys.argv[1:] if a.startswith("--limit-mm=")), 0.01))
def stood(p):
  m = trimesh.load(p, force="mesh", process=False); v = m.vertices; mn, mx = v.min(0), v.max(0); s = 8.2 / (mx[1] - mn[1])
  return (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s, m.faces
A, FA = stood(args[0]); B, FB = stood(args[1])
same = A.shape == B.shape and FA.shape == FB.shape and bool((FA == FB).all())
d = float(np.abs(A - B).max()) * 1000 if same else None
ok = same and d <= lim
print(json.dumps({"same_points_and_faces": same, "largest_difference_mm": round(d, 6) if d is not None else None, "limit_mm": lim, "accepted": ok}))
sys.exit(0 if ok else 1)
