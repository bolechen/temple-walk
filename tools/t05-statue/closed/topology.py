# Is a statue file one closed body? (issue #578, second stage.) Closed means every edge has exactly two faces, the
# faces agree on which way is out, and nothing is left over in pieces (docs/t05/DECISIONS.md §6.1).
#
#   python3 tools/t05-statue/closed/topology.py <statue.glb>... [--json=<out.json>]
#
# Points are welded by position only (the way three's mergeVertices does), so a texture seam, which Tripo cuts into
# 100-odd shells in the file, does not count as open. Reports per file: faces, boundary edges (one face), non-manifold
# edges (three or more), pieces, pieces of ten faces or fewer, whether the winding agrees, whether the biggest piece is
# watertight and its volume.
import sys, json
import numpy as np, trimesh
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
rep = {}
for p in args:
  sc = trimesh.load(p, force="scene"); m = trimesh.util.concatenate(list(sc.geometry.values()))
  t = trimesh.Trimesh(m.vertices, m.faces, process=False); raw = len(t.split(only_watertight=False)); n0 = len(t.vertices)
  t.merge_vertices(merge_tex=False, merge_norm=False)
  _, c = np.unique(t.edges_sorted, axis=0, return_counts=True)
  parts = sorted(t.split(only_watertight=False), key=lambda x: -len(x.faces)); big = parts[0]
  rep[p] = {"faces": int(len(t.faces)), "points_in_file": int(n0), "points_welded": int(len(t.vertices)), "shells_in_file": raw,
            "boundary_edges": int((c == 1).sum()), "nonmanifold_edges": int((c > 2).sum()), "pieces": len(parts),
            "pieces_of_10_faces_or_fewer": sum(len(x.faces) <= 10 for x in parts), "biggest_faces": int(len(big.faces)),
            "winding_consistent": bool(t.is_winding_consistent), "biggest_watertight": bool(big.is_watertight), "biggest_volume": round(float(big.volume), 6)}
  print(p.split("/")[-1], json.dumps(rep[p]))
if "json" in opt: json.dump(rep, open(opt["json"], "w"), indent=1)
