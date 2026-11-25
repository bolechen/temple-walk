# Turn the faces the edit made so that they face outward (issue #578, the near-view step).
#
#   python3 tools/blender/varada-orient.py <varada-closed.json> <in.glb> <out.glb> [--box=...] [--json=<log.json>]
#
# varada.py's new faces (the carried forearm's skin, the hand, the knee's sheet, the fragments between) are wound as their
# neighbours were when they were cut, and some end up facing into the body: from outside a line of sight meets their back. Each
# face in the box that is not the original's own (no point within `old_mm` of the original) is tested: a point `eps` off its
# middle along its normal is inside the solid if lines from it to infinity cross the surface an odd number of times, for most of
# `dirs` fixed directions; then the face is turned over. The original's own faces and everything outside the box are not touched,
# so the work is a choice of winding for these faces and moves no point. Deterministic: fixed directions, faces in file order.
import bpy, sys, os, json, math
import numpy as np, trimesh
from scipy.spatial import cKDTree
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
cfg = json.load(open(args[0])); root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
O = cfg.get("orient", {}); old_mm = O.get("old_mm", 1.0); eps_m = O.get("eps_mm", 0.5) / 1000; box = np.array(O.get("box", [-19.5, -17, 6.5, 10.2, -19.5, -15.4])).reshape(3, 2)
AT = [-16.45, 4.27, -17.6]
def load(p): sc = trimesh.load(p, force="scene"); return trimesh.util.concatenate(list(sc.geometry.values()))
m = load(args[1]); org = load(os.path.join(root, cfg["target"]["file"]))
def stand(v): mn, mx = v.min(0), v.max(0); k = 8.2 / (mx[1] - mn[1]); return (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * k + AT, k
V, k = stand(m.vertices); Ov, _ = stand(org.vertices)
F = m.faces; old = cKDTree(Ov).query(V)[0] * 1.0 < old_mm / 1000; kept = old[F].all(1)
cen = V[F].mean(1); inb = np.all((cen >= box[:, 0]) & (cen <= box[:, 1]), axis=1); cand = np.nonzero(~kept & inb)[0]
tri = trimesh.Trimesh(V, F, process=False); nrm = tri.face_normals
tree = BVHTree.FromPolygons([Vector(p) for p in V.tolist()], [tuple(f) for f in F.tolist()], epsilon=0.0)
dirs = [np.array(d) / np.linalg.norm(d) for d in [(0.267, 0.534, 0.802), (-0.707, 0.2, 0.68), (0.31, -0.9, 0.3), (-0.5, -0.5, -0.7), (0.9, 0.1, -0.4)]]
def crossings(p, d):
  n = 0; o = Vector(p.tolist()); dv = Vector(d.tolist())
  for _ in range(40):
    loc, nor, idx, dist = tree.ray_cast(o, dv)
    if idx is None: break
    n += 1; o = loc + dv * 1e-5
  return n
flip = []
for f in cand:
  p = cen[f] + nrm[f] * eps_m
  votes = sum(crossings(p, d) % 2 == 1 for d in dirs)
  if votes * 2 > len(dirs): flip.append(f)
Fn = F.copy(); flip = np.array(flip, int)
if len(flip): Fn[flip] = Fn[flip][:, ::-1]
log = {"faces_tested": int(len(cand)), "faces_turned": int(len(flip)), "box": box.tolist()}
trimesh.Trimesh(m.vertices, Fn, process=False).export(args[2])
if "json" in opt: json.dump(log, open(opt["json"], "w"), indent=1)
print(json.dumps(log))
