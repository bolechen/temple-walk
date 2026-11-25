# Sort the sight lines that end on the back of a face by what kind of face they hit (issue #578).
#
#   python3 tools/t05-statue/closed/classify.py <rays-report.json from raycompare.py> <figure.glb> <original.glb> <out.json> [--png=<out.png>] [--view=aisle-nearest]
#
# Each back-face hit is put in one class, in this order:
#   loose      the face lies in a piece of 10 faces or fewer (welded by position): a fragment, not part of the body
#   sheet      the line goes on to hit a front face within 2 mm behind it: two layers laid on each other (a lining, a two-sided fan)
#   added      none of the original's points lie within 3 mm of the hit: geometry the edit made (lining, fans, fills)
#   original   an original point lies within 3 mm: the original's own surface, turned or inverted by the edit
# The figure and the original are stood the same way as raycompare.py (8.2 m by their own boxes, the hall's frame).
# --png: hit points of the chosen view seen from the side (x, y) and from above (x, z), coloured by class, on the original's outline.
import sys, json, math
import numpy as np, trimesh
from scipy.spatial import cKDTree
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
R = json.load(open(args[0])); AT = [-16.45, 4.27, -17.6]
def stood(p):
  sc = trimesh.load(p, force="scene"); m = trimesh.util.concatenate(list(sc.geometry.values())); v = m.vertices; mn, mx = v.min(0), v.max(0)
  v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * (8.2 / (mx[1] - mn[1])) + AT
  t = trimesh.Trimesh(v, m.faces, process=False); t.merge_vertices(merge_tex=False, merge_norm=False); return t
fig = stood(args[1]); org = stood(args[2]); tree = cKDTree(org.vertices)
pieces = trimesh.graph.connected_components(fig.face_adjacency, nodes=np.arange(len(fig.faces))); size = {}
for pi, comp in enumerate(pieces):
  for f in comp: size[int(f)] = len(comp)
out = {}; pts = {}
for r in R["rays"]:
  if not r["hit"] or not r["back_geom"]: continue
  p = np.array(r["point"]); th = r.get("then")
  if size.get(r["face"], 0) <= 10: c = "loose"
  elif th and th["dist_m"] < 0.002 and not th["back_geom"]: c = "sheet"
  elif tree.query(p)[0] > 0.003: c = "added"
  else: c = "original"
  out.setdefault(r["view"], {}).setdefault(c, 0); out[r["view"]][c] += 1; pts.setdefault(r["view"], []).append((c, p.tolist()))
json.dump({"classes": out, "points": pts}, open(args[3], "w"), indent=1); print(json.dumps(out))
if "png" in opt:
  import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
  v = opt.get("view", "aisle-nearest"); col = {"loose": "tab:purple", "sheet": "tab:orange", "added": "tab:red", "original": "tab:blue"}
  fig_, ax = plt.subplots(1, 2, figsize=(11, 5), dpi=100); o = org.vertices[::40]
  for k, (a, b, lab) in enumerate([(0, 1, "x (m) / y (m), seen from the front"), (0, 2, "x (m) / z (m), seen from above")]):
    ax[k].scatter(o[:, a], o[:, b], s=0.2, c="0.8")
    for cls in col:
      q = np.array([p for c, p in pts.get(v, []) if c == cls])
      if len(q): ax[k].scatter(q[:, a], q[:, b], s=18, c=col[cls], label=f"{cls} {len(q)}")
    ax[k].set_xlim(-20.5, -15); ax[k].set_ylim((6.2, 8.8) if b == 1 else (-17.5, -14)); ax[k].set_title(lab, fontsize=9); ax[k].set_aspect("equal")
  ax[0].legend(fontsize=8); fig_.suptitle(f"back-face hits, {v}, build 81 rebuilt", fontsize=10); fig_.tight_layout(); fig_.savefig(opt["png"])
