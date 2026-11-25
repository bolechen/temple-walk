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
if C.get("knee", True):
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
  from PIL import Image, ImageDraw
  cell = C["cell_mm"] / 1000; ox, oy = Kb[0, 0], Kb[1, 0]; W = int((Kb[0, 1] - ox) / cell) + 1; Hh = int((Kb[1, 1] - oy) / cell) + 1
  log["knee"] = {"sheet_faces": len(sheet), "pieces": [len(x) for x in pieces[:5]]}
  # the robe the sheet lies over goes: old faces whose front view falls in the sheet's footprint and which lie within `cover_cm` of it
  sheet_set = set(sheet)
  sh_tree = BVHTree.FromPolygons([v.co.copy() for v in bm.verts], [tuple(v.index for v in f.verts) for f in sheet], epsilon=0.0)
  fimg = Image.new("L", (W, Hh), 0); fd = ImageDraw.Draw(fimg)
  for f in sheet: fd.polygon([((q[0] - ox) / cell, (q[1] - oy) / cell) for q in hall(np.array([v.co[:] for v in f.verts]))], fill=255)
  foot = np.array(fimg) > 0; covered = []
  for f in bm.faces:
    if not all(OLD[v] for v in f.verts): continue
    hp = hall(fc(f))[0]
    if not np.all((hp >= Kb[:, 0]) & (hp <= Kb[:, 1])): continue
    i = int((hp[0] - ox) / cell); j = int((hp[1] - oy) / cell)
    if not (0 <= i < W and 0 <= j < Hh and foot[j, i]): continue
    near = sh_tree.find_nearest(Vector(fc(f)))
    if near[0] is not None and near[3] * K * 100 <= C["cover_cm"]: covered.append(f)
  bmesh.ops.delete(bm, geom=covered, context="FACES")
  bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
  bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
  OLD = {v: o for v, o in zip(bm.verts, old_mask())}
  rim = [e for e in bm.edges if e.is_boundary and all(OLD[v] for v in e.verts) and in_knee(np.mean([v.co[:] for v in e.verts], axis=0))]
  log["knee"]["robe_faces_under_the_sheet"] = len(covered); log["knee"]["rim_edges"] = len(rim)
  def cycles_of(es):
    """the ordered closed loops of a set of boundary edges, and what was not a simple loop"""
    adj = defaultdict(list)
    for e in es: adj[e.verts[0]].append(e.verts[1]); adj[e.verts[1]].append(e.verts[0])
    seen = set(); loops = []; odd = []
    for v0 in adj:
      if v0 in seen: continue
      comp = []; st = [v0]; seen.add(v0)
      while st:
        u = st.pop(); comp.append(u)
        for w in adj[u]:
          if w not in seen: seen.add(w); st.append(w)
      if all(len(adj[u]) == 2 for u in comp):
        order = [comp[0]]; prev = None; cur = comp[0]
        while True:
          nxt = [w for w in adj[cur] if w is not prev]; nxt = nxt[0] if prev is not None or True else nxt[0]
          if nxt is order[0]: break
          order.append(nxt); prev, cur = cur, nxt
          if len(order) > len(comp): break
        loops.append(order)
      else: odd.append(len(comp))
    return loops, odd
  rim_loops, rim_odd = cycles_of(rim)
  log["knee"]["rim_loops"] = [len(l) for l in rim_loops]; log["knee"]["rim_not_simple"] = rim_odd
  # the sheet's core: what lies `band_cm` or more from the robe's cut edge
  rimv = np.array([v.co[:] for l in rim_loops for v in l]) if rim_loops else np.zeros((0, 3)); rk = cKDTree(rimv) if len(rimv) else None
  drop = [f for f in sheet if rk is not None and rk.query(fc(f))[0] * K * 100 < C["band_cm"][0]]
  bmesh.ops.delete(bm, geom=drop, context="FACES")
  bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
  bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
  OLD = {v: o for v, o in zip(bm.verts, old_mask())}
  inner = [e for e in bm.edges if e.is_boundary and not all(OLD[v] for v in e.verts) and in_knee(np.mean([v.co[:] for v in e.verts], axis=0))]
  in_loops, in_odd = cycles_of(inner)
  log["knee"]["core_dropped_near_rim"] = len(drop); log["knee"]["inner_loops"] = [len(l) for l in in_loops]; log["knee"]["inner_not_simple"] = in_odd
  # a ladder between each rim loop and the inner loop nearest it
  def face_normal_at(e):
    return np.array(e.link_faces[0].normal[:]) if e.link_faces else np.zeros(3)
  bands = 0; thin = 0
  for A in rim_loops:
    if not in_loops: break
    ca = np.mean([v.co[:] for v in A], axis=0); B = min(in_loops, key=lambda L: np.linalg.norm(np.mean([v.co[:] for v in L], axis=0) - ca))
    if len(B) < 8: continue
    pa = np.array([v.co[:] for v in A]); pb = np.array([v.co[:] for v in B])
    # same sense: the loops' turning about their common middle seen from the front (x, y)
    def turn(p): q = p[:, [0, 2]] - p[:, [0, 2]].mean(0); return np.sum(q[:-1, 0] * q[1:, 1] - q[1:, 0] * q[:-1, 1])
    if turn(pa) * turn(pb) < 0: B = B[::-1]; pb = pb[::-1]
    j0 = int(np.argmin(np.linalg.norm(pb - pa[0], axis=1))); B = B[j0:] + B[:j0]; pb = np.roll(pb, -j0, axis=0)
    n, m = len(A), len(B); i = j = 0; tris = []
    while i < n or j < m:
      a0, a1, b0, b1 = A[i % n], A[(i + 1) % n], B[j % m], B[(j + 1) % m]
      adv_a = j >= m or (i < n and np.linalg.norm(np.array(a1.co[:]) - np.array(b0.co[:])) <= np.linalg.norm(np.array(a0.co[:]) - np.array(b1.co[:])))
      if adv_a: tris.append((a0, a1, b0)); i += 1
      else: tris.append((b0, b1, a0)); j += 1
    for t in tris:
      q = np.array([v.co[:] for v in t]); nn = np.cross(q[1] - q[0], q[2] - q[0])
      ref = np.zeros(3)
      for u, w in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
        e = bm.edges.get((u, w))
        if e is not None and e.link_faces: ref = ref + np.array(e.link_faces[0].normal[:])
      vs = list(t) if nn @ ref >= 0 else [t[0], t[2], t[1]]
      try: bm.faces.new(vs); bands += 1
      except ValueError: pass
  log["knee"]["band_faces"] = bands
  bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()

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
