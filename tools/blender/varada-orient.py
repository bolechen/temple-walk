# Turn the stray pieces the edit left so that they face as the surface beside them does (issue #578, the near-view step).
#
#   python3 tools/blender/varada-orient.py <varada.json> <in.glb> <out.glb> [--json=<log.json>]
#
# varada.py cuts faces away and leaves small pieces of the edit's own faces (no point within `orient.old_mm` of the original) loose in
# the arm's box; some are wound the wrong way, and from outside a line of sight meets their back (docs/t05/CLOSED-BODY-578.md §八:
# two such pieces, 143 faces, take half the lines that end on a back at the west aisle). Pieces of up to `orient.piece_max` faces
# (joined through shared edges, points welded by position) are dealt with:
#   a piece whose nearest face of the main surface is more than `orient.hang_mm` away hangs in the air and is taken out
#   (the log says how many faces and how many cm2);
#   any other is turned as a whole if most of its faces' normals point against the normal of the main surface's nearest face.
# The main surface is the original's own faces and every piece of more than `piece_max` faces (the carried arm, the hand, the knee's
# sheet and the lining, which is meant to face the other way). No point moves; only the winding of whole pieces changes, and the
# file's own order of faces and points is kept. Deterministic.
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
import scipy.sparse as sp, scipy.sparse.csgraph as cg
tri = trimesh.Trimesh(V, F, process=False); tri.merge_vertices(merge_tex=False, merge_norm=False)
Fw = tri.faces; nrm = tri.face_normals; cenw = tri.vertices[Fw].mean(1)
oldw = cKDTree(Ov).query(tri.vertices)[0] < old_mm / 1000; keptw = oldw[Fw].all(1)
adj = tri.face_adjacency; ok = ~keptw[adj[:, 0]] & ~keptw[adj[:, 1]]; nf = len(Fw)
nc, lab = cg.connected_components(sp.coo_matrix((np.ones(ok.sum()), (adj[ok, 0], adj[ok, 1])), shape=(nf, nf)), directed=False)
inbw = np.all((cenw >= box[:, 0]) & (cenw <= box[:, 1]), axis=1); size = np.bincount(lab)
pmax = O.get("piece_max", 1000); hang = O.get("hang_mm", 3.0) / 1000
main = keptw | (size[lab] > pmax); mt = cKDTree(cenw[main]); mi = np.nonzero(main)[0]
# the forearm's axis: the principal direction of the carried arm's faces (the big pieces of new faces) over `axis_y`
ay = O.get("axis_y", [7.7, 8.4]); arm_f = np.nonzero(~keptw & (size[lab] > pmax) & (cenw[:, 1] >= ay[0]) & (cenw[:, 1] <= ay[1]) & inbw)[0]
Pa = cenw[arm_f]; ax_c = Pa.mean(0); ax_d = np.linalg.svd(Pa - ax_c, full_matrices=False)[2][0]
def radial(c): r = c - ax_c; return r - np.outer(r @ ax_d, ax_d)
mode = O.get("mode", "neighbour")
Fn = F.copy(); area = tri.area_faces; log = {"pieces": [], "faces_turned": 0, "faces_removed": 0, "area_removed_cm2": 0.0}
drop = np.zeros(nf, bool); turn = np.zeros(nf, bool)
for c in sorted({lab[f] for f in np.nonzero(~keptw & inbw)[0]}):
  fs = np.nonzero((lab == c) & ~keptw)[0]
  if len(fs) > pmax: continue
  d, j = mt.query(cenw[fs])
  if mode == "axis": votes = np.sum(np.einsum("ij,ij->i", nrm[fs], radial(cenw[fs])) < 0) * 2 - len(fs)   # most faces point toward the axis: turn
  else: votes = np.sum(np.einsum("ij,ij->i", nrm[fs], nrm[mi[j]]) < 0) * 2 - len(fs)
  rec = {"faces": int(len(fs)), "area_cm2": round(float(area[fs].sum()) * 1e4, 2), "nearest_mm": round(float(d.min()) * 1000, 2), "middle": cenw[fs].mean(0).round(3).tolist()}
  if d.min() > hang and not oldw[Fw[fs]].any(): rec["action"] = "removed"; drop[fs] = True   # (a piece with a point of the original in it is part of the original's own debris and stays)
  elif votes > 0: rec["action"] = "turned"; turn[fs] = True
  else: rec["action"] = "kept"
  log["pieces"].append(rec)
log["faces_turned"] = int(turn.sum()); log["faces_removed"] = int(drop.sum()); log["area_removed_cm2"] = round(float(area[drop].sum()) * 1e4, 2)
# the same faces in the file's own order (merge_vertices keeps the face order)
Fn[turn] = Fn[turn][:, ::-1]; Fn = Fn[~drop]
trimesh.Trimesh(m.vertices, Fn, process=False).export(args[2])
if "json" in opt: json.dump(log, open(opt["json"], "w"), indent=1)
print(json.dumps({k: v for k, v in log.items() if k != "pieces"}), len(log["pieces"]), "pieces")
