# The layers of the knee and forearm region of a grafted figure, and where its open edges and back-face lines belong (issue #578).
#
#   python3 tools/t05-statue/closed/layers.py <figure.glb> <original.glb> <rays-report.json> <out.json> [--png=<out.png>] [--view=aisle-nearest]
#
# Faces of the box (hall metres; the figure stood 8.2 m by its own box, welded by position) are put in layers:
#   kept       all three points within 1 mm of a point of the original: the original's own surface, not moved
#   new:<k>    otherwise, the pieces of such faces joined through shared edges, numbered by size (the knee's sheet, the carried
#              forearm and the hand come out as different pieces); each piece's faces, area, box and middle are reported
# and, for each layer, how many open edges it owns (an open edge has one face) and how many of the report's back-face lines first
# hit one of its faces. The open edges are also listed by the pair (layer of its face, layer of the nearest kept-or-new face
# across the gap, by position) to say which layers a window is between.
import sys, json
import numpy as np, trimesh
from scipy.spatial import cKDTree
from collections import Counter, defaultdict
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
AT = [-16.45, 4.27, -17.6]; box = np.array([[-19.5, -17], [6.5, 10.2], [-19.5, -15.4]])
def stood(p):
  sc = trimesh.load(p, force="scene"); m = trimesh.util.concatenate(list(sc.geometry.values())); v = m.vertices; mn, mx = v.min(0), v.max(0)
  v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * (8.2 / (mx[1] - mn[1])) + AT
  t = trimesh.Trimesh(v, m.faces, process=False); t.merge_vertices(merge_tex=False, merge_norm=False); return t
fig = stood(args[0]); org = stood(args[1]); ot = cKDTree(org.vertices); V = fig.vertices; F = fig.faces
old_v = ot.query(V)[0] < 0.001; kept = old_v[F].all(1)
cen = V[F].mean(1); inb = np.all((cen >= box[:, 0]) & (cen <= box[:, 1]), axis=1)
newf = np.nonzero(~kept & inb)[0]
adj = fig.face_adjacency; ok = ~kept[adj[:, 0]] & ~kept[adj[:, 1]]
import scipy.sparse as sp, scipy.sparse.csgraph as cg
n = len(F); A = sp.coo_matrix((np.ones(ok.sum()), (adj[ok, 0], adj[ok, 1])), shape=(n, n)); nc, lab = cg.connected_components(A, directed=False)
layer = np.full(n, "kept", dtype=object); sizes = Counter(lab[newf]); order = [c for c, _ in sizes.most_common(8)]
name = {c: f"new:{i}" for i, c in enumerate(order)}
for f in newf: layer[f] = name.get(lab[f], "new:small")
area = fig.area_faces; rep = {"layers": {}}
for L in sorted(set(layer[inb])):
  m_ = inb & (layer == L); P = V[F[m_]].reshape(-1, 3)
  rep["layers"][L] = {"faces": int(m_.sum()), "area_m2": round(float(area[m_].sum()), 3), "min": P.min(0).round(3).tolist(), "max": P.max(0).round(3).tolist()}
# open edges: edges with one face
e = fig.edges_sorted; fid = np.repeat(np.arange(len(F)), 3); u, inv, c = np.unique(e, axis=0, return_inverse=True, return_counts=True)
one = np.nonzero(c == 1)[0]; owner = {}
for k in one: owner[k] = fid[np.nonzero(inv == k)[0][0]]
open_by = Counter(); open_len = defaultdict(float)
for k, f in owner.items():
  mid = V[u[k]].mean(0)
  if not np.all((mid >= box[:, 0]) & (mid <= box[:, 1])): continue
  open_by[layer[f]] += 1; open_len[layer[f]] += float(np.linalg.norm(V[u[k][0]] - V[u[k][1]]))
for L in rep["layers"]: rep["layers"][L]["open_edges"] = open_by.get(L, 0); rep["layers"][L]["open_length_m"] = round(open_len.get(L, 0), 2)
R = json.load(open(args[2])); hits = Counter(); tree_c = cKDTree(cen)
for r in R["rays"]:
  if r["hit"] and r["back_geom"]: hits[(r["view"], layer[r["face"]] if r["face"] < n else "?")] += 1
rep["back_hits_by_layer"] = {f"{v} / {l}": k for (v, l), k in sorted(hits.items())}
json.dump(rep, open(args[3], "w"), indent=1)
for L, d in rep["layers"].items(): print(L, d["faces"], "faces", d["area_m2"], "m2", "open", d["open_edges"], d["open_length_m"], "m", d["min"], d["max"])
print(rep["back_hits_by_layer"])
if "png" in opt:
  import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
  cols = {"kept": "0.8", "new:0": "tab:blue", "new:1": "tab:green", "new:2": "tab:orange", "new:3": "tab:purple", "new:4": "tab:brown", "new:small": "tab:pink"}
  fg, ax = plt.subplots(1, 3, figsize=(15, 5), dpi=100)
  for k, (a, b, t) in enumerate([(0, 1, "front: x / y"), (0, 2, "above: x / z"), (2, 1, "from the figure's left: z / y")]):
    for L in cols:
      s_ = inb & (layer == L)
      if s_.any(): ax[k].scatter(cen[s_][::3 if L == "kept" else 1, a], cen[s_][::3 if L == "kept" else 1, b], s=0.5, c=cols[L], label=L if k == 0 else None)
    for kk, f in owner.items():
      mid = V[u[kk]].mean(0)
      if np.all((mid >= box[:, 0]) & (mid <= box[:, 1])): ax[k].plot(V[u[kk]][:, a], V[u[kk]][:, b], c="k", lw=0.5)
    for r in R["rays"]:
      if r["view"] == opt.get("view", "aisle-nearest") and r["hit"] and r["back_geom"]: ax[k].scatter([r["point"][a]], [r["point"][b]], s=14, c="red", marker="x")
    ax[k].set_xlim(box[a]); ax[k].set_ylim(box[b]); ax[k].set_aspect("equal"); ax[k].set_title(t, fontsize=9)
  ax[0].legend(fontsize=7, markerscale=8); fg.suptitle("layers in the arm box; open edges black; back-face hits red x", fontsize=10); fg.tight_layout(); fg.savefig(opt["png"])
