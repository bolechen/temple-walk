# Where the open edges of the grafted figure are, and which belong to the original's own cut (issue #578).
#
#   python3 tools/t05-statue/closed/loops.py <figure.glb> <original.glb> <out.json> [--png=<out.png>] [--box=-19.5,-17,6.5,10.2,-19.5,-15.4]
#
# The figure's points are welded by position, its edges with one face are collected inside the box, and each is called
#   cut       both ends lie within 1 mm of a point of the original: the edge the edit left on the original's own surface
#             (the cut round the old hand, the forearm's lifted underside, the seam where the carried forearm left the thigh)
#   made      otherwise: an edge of what the edit added (the lining's, a fan's, a fill's border)
# and each kind is joined into runs through shared points. The json holds, per kind, the runs: edge count, length in
# metres, box and middle (the hall's frame; both figures stood 8.2 m by their own boxes). --png draws the edges from the
# front (x, y), from above (x, z) and from the figure's left (z, y), cut in red, made in blue, on the original's points.
import sys, json
import numpy as np, trimesh
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
AT = [-16.45, 4.27, -17.6]; box = np.array([float(x) for x in opt.get("box", "-19.5,-17,6.5,10.2,-19.5,-15.4").split(",")]).reshape(3, 2)
def stood(p):
  sc = trimesh.load(p, force="scene"); m = trimesh.util.concatenate(list(sc.geometry.values())); v = m.vertices; mn, mx = v.min(0), v.max(0)
  v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * (8.2 / (mx[1] - mn[1])) + AT
  t = trimesh.Trimesh(v, m.faces, process=False); t.merge_vertices(merge_tex=False, merge_norm=False); return t
fig = stood(args[0]); org = stood(args[1]); tree = cKDTree(org.vertices)
u, c = np.unique(fig.edges_sorted, axis=0, return_counts=True); b = u[c == 1]; V = fig.vertices
mid = V[b].mean(1); keep = np.all((mid >= box[:, 0]) & (mid <= box[:, 1]), axis=1); b = b[keep]
near = (tree.query(V[b[:, 0]])[0] < 0.001) & (tree.query(V[b[:, 1]])[0] < 0.001)
rep = {"edges_in_box": int(len(b))}; runs_all = {}
for kind, sel in (("cut", near), ("made", ~near)):
  e = b[sel]; runs = []
  if len(e):
    pts, inv = np.unique(e.ravel(), return_inverse=True); inv = inv.reshape(-1, 2)
    n, lab = connected_components(coo_matrix((np.ones(len(inv)), (inv[:, 0], inv[:, 1])), shape=(len(pts),) * 2), directed=False)
    for k in range(n):
      m_ = lab[inv[:, 0]] == k; ee = e[m_]; P = V[ee.ravel()]; L = float(np.linalg.norm(V[ee[:, 0]] - V[ee[:, 1]], axis=1).sum())
      runs.append({"edges": int(m_.sum()), "length_m": round(L, 3), "min": P.min(0).round(3).tolist(), "max": P.max(0).round(3).tolist(), "middle": P.mean(0).round(3).tolist()})
  runs.sort(key=lambda r: -r["length_m"]); runs_all[kind] = (e, runs)
  rep[kind] = {"edges": int(len(e)), "length_m": round(sum(r["length_m"] for r in runs), 3), "runs": len(runs), "longest": runs[:12]}
json.dump(rep, open(args[2], "w"), indent=1)
print({k: (v["edges"], v["length_m"], v["runs"]) if isinstance(v, dict) else v for k, v in rep.items()})
if "png" in opt:
  import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
  fg, ax = plt.subplots(1, 3, figsize=(15, 5), dpi=100); o = org.vertices[::25]
  for k, (a, bb, t) in enumerate([(0, 1, "front: x / y"), (0, 2, "above: x / z"), (2, 1, "from the figure's left: z / y")]):
    ax[k].scatter(o[:, a], o[:, bb], s=0.2, c="0.85")
    for kind, col in (("made", "tab:blue"), ("cut", "tab:red")):
      e = runs_all[kind][0]
      for q in e: ax[k].plot(V[q][:, a], V[q][:, bb], c=col, lw=0.6)
    ax[k].set_xlim(box[a]); ax[k].set_ylim(box[bb]); ax[k].set_aspect("equal"); ax[k].set_title(t, fontsize=9)
  fg.suptitle(f"open edges in the arm box: cut (original's own) red {rep['cut']['edges']}, made (lining, fans, fills) blue {rep['made']['edges']}", fontsize=10); fg.tight_layout(); fg.savefig(opt["png"])
