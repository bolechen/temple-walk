# Close the grafted figure (issue #578): the second stage of the boon-granting hand, after tools/blender/varada.py has
# run with the lining, the two-sided fans and the fill blobs left out (tools/t05-statue/sakyamuni/varada-closed.json).
#
#   python3 tools/blender/varada-close.py <varada-closed.json> <out dir>      (reads <out>/sakyamuni-varada.glb, writes <out>/sakyamuni-closed.glb)
#
# What varada.py leaves open, and why (docs/t05/CLOSED-BODY-578.md §六, §七): the knee's sheet is laid under the robe
# round it, its border sunk 2 mm, so the robe's cut edge and the sheet's border are two open edges lying one over the
# other; the forearm's underside, where it came off the thigh, is cut. This script closes them without adding a layer:
#   1  weld by position (1e-6 file units), classify each point old (within `old_mm` of the face-processed original) or new
#   2  knee: the sheet's faces that lie under the robe (a line from the face toward the viewer meets an old face within
#      `hidden_m`) are taken out, the rest is the sheet's visible core; each border point of the core is moved onto the
#      nearest robe cut edge within `zip_mm` and joined to it (the edge is split there), so the two edges become one
#   3  what is left of the knee's seam are small gaps (a sheet edge against the robe's points between two joins): each
#      closed loop of at most `gap_sides` edges is filled
# Every number is in the config's "close" section. The figure is stood as the hall's tool stands it (8.2 m by its own
# box), as tools/t05-statue/closed/ reads it, so the metres here are the hall's.
import bpy, bmesh, sys, os, json, hashlib, math
import numpy as np
from collections import defaultdict
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from scipy.spatial import cKDTree
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; C = cfg["close"]; T = cfg["target"]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import trimesh
f1 = trimesh.load(os.path.join(root, T["file"]), force="scene"); f1 = trimesh.util.concatenate(list(f1.geometry.values()))
F1 = f1.vertices[:, [0, 2, 1]] * [1, -1, 1]                        # glTF (x, y up, z) -> Blender (x, y, z up)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(out, "sakyamuni-varada.glb"))
ob = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
P = np.array([v.co[:] for v in bm.verts]); zmin = P[:, 2].min(); K = 8.2 / (P[:, 2].max() - zmin)   # file units -> the hall's metres
def hall(p): p = np.atleast_2d(p); return np.c_[p[:, 0] * K - 16.45, (p[:, 2] - zmin) * K + 4.27, -p[:, 1] * K - 17.6]
log = {"faces_in": len(bm.faces)}
tree_f1 = cKDTree(F1)
def old_mask(): 
  p = np.array([v.co[:] for v in bm.verts]); return tree_f1.query(p)[0] * K < C["old_mm"] / 1000
bm.verts.index_update(); OLD = {v: o for v, o in zip(bm.verts, old_mask())}
# --- the knee ---
Kb = np.array(C["knee_box"]).reshape(3, 2)
def in_knee(p): h = hall(p)[0]; return bool(np.all((h >= Kb[:, 0]) & (h <= Kb[:, 1])))
fc = lambda f: np.mean([v.co[:] for v in f.verts], axis=0)
# the sheet: the biggest piece of new faces in the box (the hand is another, welded to nothing here)
newf = [f for f in bm.faces if not all(OLD[v] for v in f.verts) and in_knee(fc(f))]
seen = set(); pieces = []
for f0_ in newf:
  if f0_ in seen: continue
  comp, stack = [], [f0_]; seen.add(f0_)
  while stack:
    g = stack.pop(); comp.append(g)
    for e in g.edges:
      for h in e.link_faces:
        if h not in seen and not all(OLD[v] for v in h.verts): seen.add(h); stack.append(h)
  pieces.append(comp)
# (varada.py's log says how many faces the sheet has, `close.sheet_faces`; the hand and the forearm's new faces are bigger pieces)
pieces.sort(key=lambda x: abs(len(x) - C["sheet_faces"])); sheet = pieces[0]
# where the robe is: the old faces of the box seen from the front (x, y of the hall), drawn into a picture at `cell_mm`
from PIL import Image, ImageDraw
cell = C["cell_mm"] / 1000; ox, oy = Kb[0, 0], Kb[1, 0]; W = int((Kb[0, 1] - ox) / cell) + 1; Hh = int((Kb[1, 1] - oy) / cell) + 1
img = Image.new("L", (W, Hh), 0); dr = ImageDraw.Draw(img)
for f in bm.faces:
  if not all(OLD[v] for v in f.verts): continue
  hp = hall(np.array([v.co[:] for v in f.verts]))
  if not np.all((hp.mean(0) >= Kb[:, 0] - 0.05) & (hp.mean(0) <= Kb[:, 1] + 0.05)): continue
  dr.polygon([((q[0] - ox) / cell, (q[1] - oy) / cell) for q in hp], fill=255)
robe = np.array(img) > 0
from scipy.ndimage import binary_erosion
hole = ~robe
band = []; core = []
for f in sheet:
  c = hall(fc(f))[0]; i = int((c[0] - ox) / cell); j = int((c[1] - oy) / cell)
  (core if (0 <= i < W and 0 <= j < Hh and hole[j, i]) else band).append(f)
log["knee"] = {"sheet_faces": len(sheet), "pieces": [len(x) for x in pieces[:5]], "under_robe": len(band), "in_the_hole": len(core)}
bmesh.ops.delete(bm, geom=band, context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
OLD = {v: o for v, o in zip(bm.verts, old_mask())}
# the robe's cut edges (boundary, both ends old) and the core's border points (boundary, a new end), inside the box
rim = [e for e in bm.edges if e.is_boundary and all(OLD[v] for v in e.verts) and in_knee(np.mean([v.co[:] for v in e.verts], axis=0))]
border = {v for e in bm.edges if e.is_boundary for v in e.verts if not OLD[v] and in_knee(np.array(v.co[:]))}
log["knee"].update({"rim_edges": len(rim), "border_points": len(border)})
tol = C["zip_mm"] / 1000 / K
# nearest rim edge to each border point (a KD-tree over the edges' midpoints, then the exact point on the few nearest)
mid = np.array([np.mean([v.co[:] for v in e.verts], axis=0) for e in rim]); kt = cKDTree(mid); zipped = 0
for s in sorted(border, key=lambda v: v.index):
  if not s.is_valid: continue
  p = np.array(s.co[:]); best = None
  for j in kt.query(p, k=min(6, len(rim)))[1]:
    e = rim[j]
    if not e.is_valid: continue
    a, b = np.array(e.verts[0].co[:]), np.array(e.verts[1].co[:]); ab = b - a; t = np.clip((p - a) @ ab / max(ab @ ab, 1e-18), 0, 1); q = a + t * ab; d = np.linalg.norm(q - p)
    if best is None or d < best[0]: best = (d, e, t, q)
  if best is None or best[0] > tol: continue
  d, e, t, q = best
  if t < 0.15 or t > 0.85:           # at an end of the edge: join to that end point
    r = e.verts[0] if t < 0.5 else e.verts[1]
  else:
    ne, r = bmesh.utils.edge_split(e, e.verts[0], t); r.co = Vector(q)
  if r is not s: bmesh.ops.pointmerge(bm, verts=[s, r], merge_co=r.co.copy()); zipped += 1
log["knee"]["zipped"] = zipped
bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
bmesh.ops.dissolve_degenerate(bm, dist=1e-9, edges=bm.edges)
# --- small gaps: closed loops of few edges ---
box = np.array(C["box"]).reshape(3, 2)
def inbox(e): m = hall(np.mean([v.co[:] for v in e.verts], axis=0))[0]; return bool(np.all((m >= box[:, 0]) & (m <= box[:, 1])))
be = [e for e in bm.edges if e.is_boundary and inbox(e)]
f0 = len(bm.faces); bmesh.ops.holes_fill(bm, edges=be, sides=C["gap_sides"]); bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
log["gap_faces"] = len(bm.faces) - f0
bm.normal_update()
be_after = [e for e in bm.edges if e.is_boundary and inbox(e)]
log["open_edges_in_box_after"] = len(be_after); log["faces_out"] = len(bm.faces)
me = ob.data; bm.to_mesh(me); bm.free(); me.update()
bpy.ops.export_scene.gltf(filepath=os.path.join(out, "sakyamuni-closed.glb"), export_format="GLB", use_selection=False, export_apply=False, export_texcoords=False, export_normals=True, export_materials="NONE" if False else "EXPORT")
log["sha256"] = hashlib.sha256(open(os.path.join(out, "sakyamuni-closed.glb"), "rb").read()).hexdigest()
json.dump(log, open(os.path.join(out, "close-log.json"), "w"), indent=1); print(json.dumps(log))
