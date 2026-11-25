# Close the windows under the grafted forearm (issue #578, the near-view step): the open loops of the arm and wrist, one layer each.
#
#   python3 tools/blender/varada-window.py <varada-closed.json> <out dir> [--ymin=7.7] [--maxedges=150]
#
# Reads <out>/sakyamuni-varada.glb (varada.py run with the lining, the fans and the blobs left out), welds by position, finds the open
# edges inside `window.box` (the hall's metres, the figure stood 8.2 m by its own box) and above `--ymin`, joins them into loops, and
# fills each loop that is a simple closed loop of at most `--maxedges` edges with one layer of faces turned the way the face on the
# loop's own edge is (holes_fill, then triangulated). Loops that branch are left and listed. Writes <out>/sakyamuni-window.glb and
# <out>/window-log.json. The knee's long loop (y below `--ymin`) is not touched.
import bpy, bmesh, sys, os, json, hashlib
import numpy as np
from collections import defaultdict
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
cfg = json.load(open(args[0])); out = args[1]; W = cfg.get("window", {})
ymin = float(opt.get("ymin", W.get("ymin", 7.7))); maxe = int(opt.get("maxedges", W.get("maxedges", 150))); box = np.array(W.get("box", [-19.5, -17, 6.5, 10.2, -19.5, -15.4])).reshape(3, 2)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=os.path.join(out, "sakyamuni-varada.glb"))
ob = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
P = np.array([v.co[:] for v in bm.verts]); zmin = P[:, 2].min(); K = 8.2 / (P[:, 2].max() - zmin)
hall = lambda p: np.array([p[0] * K - 16.45, (p[2] - zmin) * K + 4.27, -p[1] * K - 17.6])
def inreg(e):
  m = hall(np.mean([v.co[:] for v in e.verts], axis=0)); return bool(np.all((m >= box[:, 0]) & (m <= box[:, 1])) and m[1] >= ymin)
es = [e for e in bm.edges if e.is_boundary and inreg(e)]
adj = defaultdict(list)
for e in es: adj[e.verts[0]].append(e); adj[e.verts[1]].append(e)
seen = set(); loops = []; odd = []
for e0 in es:
  if e0 in seen: continue
  comp = []; st = [e0]; seen.add(e0)
  while st:
    e = st.pop(); comp.append(e)
    for v in e.verts:
      for g in adj[v]:
        if g not in seen: seen.add(g); st.append(g)
  vs = {v for e in comp for v in e.verts}
  (loops if all(len(adj[v]) == 2 for v in vs) else odd).append(comp)
log = {"open_edges_in_region": len(es), "simple_loops": sorted(len(c) for c in loops), "branching_pieces": sorted(len(c) for c in odd)}
# a branching piece is split into simple loops by walking its edges the way their own faces run (the boundary of an oriented
# surface), taking at a branch the edge that bends least
def directed(e):
  f = e.link_faces[0]; l = [l for l in f.loops if l.edge is e][0]; return (l.vert, l.link_loop_next.vert)
loops2 = []
for comp in odd:
  out_of = defaultdict(list)
  for e in comp:
    a_, b_ = directed(e); out_of[a_].append((b_, e))
  used = set()
  for e in comp:
    a_, b_ = directed(e)
    if (a_, b_) in used: continue
    cyc = []; cur_a, cur_b, cur_e = a_, b_, e; ok = True
    while True:
      used.add((cur_a, cur_b)); cyc.append(cur_e)
      cands = [(w, ee) for w, ee in out_of[cur_b] if (cur_b, w) not in used or w is a_]
      if not cands: ok = False; break
      d0 = np.array(cur_b.co[:]) - np.array(cur_a.co[:]); d0 /= max(np.linalg.norm(d0), 1e-12)
      w, ee = max(cands, key=lambda c: float(((np.array(c[0].co[:]) - np.array(cur_b.co[:])) / max(np.linalg.norm(np.array(c[0].co[:]) - np.array(cur_b.co[:])), 1e-12)) @ d0))
      if w is a_ and cur_b is not a_: cyc.append(ee); used.add((cur_b, w)); break
      cur_a, cur_b, cur_e = cur_b, w, ee
      if len(cyc) > len(comp) + 2: ok = False; break
    if ok and len(cyc) >= 3: loops2.append(cyc)
log["split_loops"] = sorted(len(c) for c in loops2)
f0 = len(bm.faces); new = []
for c in [c for c in loops if len(c) <= maxe] + [c for c in loops2 if len(c) <= maxe]:
  try: new += bmesh.ops.holes_fill(bm, edges=list(dict.fromkeys(c)), sides=maxe)["faces"]
  except Exception as ex: log.setdefault("fill_failed", []).append(len(c))
bm.normal_update()
# turned the way the face already on each loop's edge is: a new face shares an edge with an old one; they must run opposite ways
flipped = 0
for f in new:
  for e in f.edges:
    old = [g for g in e.link_faces if g not in new]
    if old:
      lf = [l for l in f.loops if l.edge is e][0]; lo = [l for l in old[0].loops if l.edge is e][0]
      if lf.vert is lo.vert: bmesh.ops.reverse_faces(bm, faces=[f]); flipped += 1
      break
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
bm.normal_update()
log.update({"filled_faces": len(bm.faces) - f0, "turned": flipped, "open_edges_in_region_after": sum(1 for e in bm.edges if e.is_boundary and inreg(e))})
bm.to_mesh(ob.data); bm.free(); ob.data.update()
bpy.ops.export_scene.gltf(filepath=os.path.join(out, "sakyamuni-window.glb"), export_format="GLB", export_texcoords=False, export_normals=True)
log["sha256"] = hashlib.sha256(open(os.path.join(out, "sakyamuni-window.glb"), "rb").read()).hexdigest()
json.dump(log, open(os.path.join(out, "window-log.json"), "w"), indent=1); print(json.dumps(log))
