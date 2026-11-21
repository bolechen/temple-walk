# Sakyamuni's right hand in the boon-granting gesture (与愿印), by grafting Sikhin's left hand mirrored (issue #514).
#
#   python3 tools/blender/varada.py <varada.json> <out dir> [--stage=hand|all]
#
# Step 1 (hand): the donor's hand is cut out of Sikhin's mesh below the plane `donor.cut` and inside the box `donor.keep`
# (min, max; it leaves out the robe beside and behind the hand and the sleeve above it),
# welded into one piece (the generated meshes are many unwelded shells; `donor.weld` metres),
# mirrored across x (a left hand becomes a right one; the faces are turned back out after the mirror), and set on
# Sakyamuni's wrist: its wrist-to-fingertips axis along target.wrist→target.fingertips, its palm toward target.palm,
# scaled to Sakyamuni's hand length times target.scale and turned target.turn_deg about its own axis (so the two figures
# do not show the same hand). Writes <out>/hand.glb (stage frame) and <out>/hand.json (where everything came from).
import bpy, bmesh, sys, os, json, math, hashlib
import numpy as np
from mathutils import Vector, Matrix
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
cfg = json.load(open(args[0])); out = args[1]; os.makedirs(out, exist_ok=True)
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
def load(path, H):
  """the file's one mesh, its points put in the stage frame (x, y up, z toward the viewer); returns the object and the
  file → stage transform (scale k, offset) so the result can be put back"""
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.import_scene.gltf(filepath=path)
  obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
  for o in bpy.context.scene.objects: o.select_set(o in obs)
  bpy.context.view_layer.objects.active = obs[0]
  if len(obs) > 1: bpy.ops.object.join()
  ob = bpy.context.view_layer.objects.active; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  co = np.empty(len(ob.data.vertices) * 3); ob.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
  mn, mx = co.min(0), co.max(0); k = H / (mx[2] - mn[2]); off = np.array([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]])
  st = (co - off) * k; st = np.c_[st[:, 0], st[:, 2], -st[:, 1]]          # Blender (x, y, z up) → stage (x, y up, z = -y)
  return ob, st, (k, off)
def to_blender(st): return np.c_[st[:, 0], -st[:, 2], st[:, 1]]
D, T = cfg["donor"], cfg["target"]
log = {"donor": {"file": D["file"], "sha256": sha(D["file"])}, "target": {"file": T["file"], "sha256": sha(T["file"])}}
if T.get("sha256") and log["target"]["sha256"] != T["sha256"]: sys.exit(f"target file is not the registered one: {log['target']['sha256']}")
# --- the donor's hand ---
ob, st, _ = load(D["file"], D["height"])
cp, cn = np.array(D["cut"]["point"]), np.array(D["cut"]["normal"], float); cn /= np.linalg.norm(cn)
# The generated mesh is many unwelded shells, and the hand is a few of them (palm, thumb, fingers) with the wrist on a
# shell that runs on up into the sleeve, and a patch of the palm on a shell of the robe: a shell lying mostly (`whole`)
# or partly (`part`) inside the box `keep` is taken, cut at the wrist and at the box; the robe and the knee, whose
# shells lie mostly outside the box, are left.
K = D["keep"]; lo, hi = np.array(K["min"]), np.array(K["max"]); inbox = np.all((st > lo) & (st < hi), axis=1); below = (st - cp) @ cn > 0
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
fv = np.empty(len(ob.data.polygons) * 3, dtype=np.int64); ob.data.polygons.foreach_get("vertices", fv); F = fv.reshape(-1, 3)
E = np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]; n = len(st)
_, lab = connected_components(coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(n, n)), directed=False)
frac = np.bincount(lab, weights=inbox, minlength=lab.max() + 1) / np.maximum(np.bincount(lab, minlength=lab.max() + 1), 1)
whole = frac >= K.get("whole", 0.8); part = (frac >= K.get("part", 0.4)) & ~whole
keep = (whole[lab] | part[lab]) & inbox & below
for lo2, hi2 in K.get("drop", []): keep &= ~np.all((st > lo2) & (st < hi2), axis=1)   # scraps of robe touching the hand (a box on the robe's shells alone took fingers with it: the shells do not follow the parts)   # every shell kept is still cut at the wrist and the box (a hand shell may run on into the sleeve)
log["donor"]["shells_whole"] = int(whole[np.unique(lab[inbox])].sum()); log["donor"]["shells_part"] = int(part[np.unique(lab[inbox])].sum())
me = ob.data; me.vertices.foreach_set("co", to_blender(st).ravel()); me.update()
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
gone = [f for f in bm.faces if not all(keep[v.index] for v in f.verts)]
bmesh.ops.delete(bm, geom=gone, context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.to_mesh(me); bm.free(); me.update()
log["donor"]["faces_cut"] = len(me.polygons)
# the generated mesh is many unwelded shells: weld points that coincide (within weld metres), so the hand is one piece
# where its shells met; a voxel remesh does not do here (it needs a closed volume, and these shells are open)
bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=D.get("weld", 0.002)); bm.to_mesh(me); bm.free(); me.update()
# keep the largest piece only (a stray bit of robe inside the sphere would make its own island)
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); seen = set(); best = []
for v in bm.verts:
  if v.index in seen: continue
  stack, comp = [v], []
  seen.add(v.index)
  while stack:
    u = stack.pop(); comp.append(u)
    for e in u.link_edges:
      w = e.other_vert(u)
      if w.index not in seen: seen.add(w.index); stack.append(w)
  if len(comp) > len(best): best = comp
bs = set(x.index for x in best); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in bs], context="VERTS")
bm.to_mesh(me); bm.free(); me.update()
for o in bpy.context.scene.objects: o.select_set(o == ob)
bpy.ops.export_scene.gltf(filepath=os.path.join(out, "hand-donor.glb"), export_format="GLB", use_selection=True)   # as cut, in Sikhin's own place
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); P = np.c_[co.reshape(-1, 3)[:, 0], co.reshape(-1, 3)[:, 2], -co.reshape(-1, 3)[:, 1]]
log["donor"]["welded_verts"] = len(P)
bm = bmesh.new(); bm.from_mesh(me); log["donor"]["open_edges"] = sum(1 for e in bm.edges if e.is_boundary); log["donor"]["nonmanifold_edges"] = sum(1 for e in bm.edges if not e.is_manifold and not e.is_boundary); bm.free()
# the donor hand's own frame: the wrist is the middle of what lies nearest the cut; the long axis runs from it to
# the point farthest past the cut (the middle finger's tip); the palm's normal is the thinnest direction, turned toward +z
wr = P[(P - cp) @ cn < np.percentile((P - cp) @ cn, 3)].mean(0)   # the wrist: the middle of the 3% of points nearest the cut
far = P[np.argmax((P - cp) @ cn)]   # the fingertip: the point farthest past the cut (the middle finger's tip, the hand hanging)
ax = (far - wr) / np.linalg.norm(far - wr); c = P.mean(0); _, _, vt = np.linalg.svd(P - c, full_matrices=False)
nrm = vt[2] - (vt[2] @ ax) * ax; nrm /= np.linalg.norm(nrm)
if nrm[2] < 0: nrm = -nrm
log["donor"].update({"wrist": wr.round(3).tolist(), "tip": far.round(3).tolist(), "length_m": round(float(np.linalg.norm(far - wr)), 3), "palm_normal": nrm.round(3).tolist()})
# mirror: x → -x (a left hand into a right one); the frame mirrors with it
M = np.diag([-1.0, 1, 1]); P = P @ M; wr, far, ax, nrm = wr @ M, far @ M, ax @ M, nrm @ M
# the target frame on Sakyamuni
tw, tf = np.array(T["wrist"]), np.array(T["fingertips"]); tax = (tf - tw) / np.linalg.norm(tf - tw)
tn = np.array(T["palm"], float); tn = tn - (tn @ tax) * tax; tn /= np.linalg.norm(tn)
def frame(a, n): return np.c_[a, n, np.cross(a, n)]
R = frame(tax, tn) @ frame(ax, nrm).T
th = math.radians(T.get("turn_deg", 0)); ca, sa = math.cos(th), math.sin(th); a = tax
Rt = np.array([[ca + a[0]**2*(1-ca), a[0]*a[1]*(1-ca) - a[2]*sa, a[0]*a[2]*(1-ca) + a[1]*sa],
               [a[1]*a[0]*(1-ca) + a[2]*sa, ca + a[1]**2*(1-ca), a[1]*a[2]*(1-ca) - a[0]*sa],
               [a[2]*a[0]*(1-ca) - a[1]*sa, a[2]*a[1]*(1-ca) + a[0]*sa, ca + a[2]**2*(1-ca)]])
sc = np.linalg.norm(tf - tw) / np.linalg.norm(far - wr) * T.get("scale", 1.0)
Q = ((P - wr) * sc) @ R.T @ Rt.T + tw - tax * T.get("overlap", 0) + np.array([0, T.get("lift", 0), 0])
me.vertices.foreach_set("co", to_blender(Q).ravel()); me.update()
bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()   # the mirror turned the faces inside out
log["placed"] = {"scale": round(float(sc), 4), "turn_deg": T.get("turn_deg", 0), "wrist": tw.tolist(), "axis": tax.round(3).tolist(), "palm": tn.round(3).tolist()}
for o in bpy.context.scene.objects: o.select_set(o == ob)
bpy.ops.export_scene.gltf(filepath=os.path.join(out, "hand.glb"), export_format="GLB", use_selection=True)
json.dump(log, open(os.path.join(out, "hand.json"), "w"), indent=1); print(json.dumps(log))
if opt.get("stage", "all") == "hand": sys.exit(0)
# --- step 2: Sakyamuni's own knee where the old hand lay, and the new hand joined on ---
# The old hand is fused into the knee (there is no knee surface under it): each point of it, inside the box `knee.box`,
# is moved onto Sakyamuni's own left knee mirrored across x (the same robe, the same folds: the 3D review's third risk),
# fully inside and less toward the box's edges (`knee.ease` metres), so the mesh stays one piece with nothing to stitch.
# Then the new hand is joined to the figure, its wrist sunk `target.overlap` metres into the forearm.
hand_co = Q.copy(); hand_faces = np.array([list(p.vertices) for p in me.polygons])
ob, st, (k, off) = load(T["file"], T["height"])
Kn = cfg["knee"]; blo, bhi = np.array(Kn["box"][0]), np.array(Kn["box"][1])
inb = np.all((st > blo) & (st < bhi), axis=1)
# how far inside the box each point is (to its nearest face), eased to a weight
dist_in = np.minimum((st - blo).min(1), (bhi - st).min(1)); wgt = np.clip(dist_in / Kn["ease"], 0, 1) * inb
# the mirror of the left knee: the figure's points in the mirrored box, their faces, as a BVH to find the nearest point
from mathutils.bvhtree import BVHTree
mlo, mhi = blo * [-1, 1, 1], bhi * [-1, 1, 1]; mlo, mhi = np.minimum(mlo, mhi) - [Kn["margin"], 0, 0], np.maximum(mlo, mhi) + [Kn["margin"], 0, 0]
fv = np.empty(len(ob.data.polygons) * 3, dtype=np.int64); ob.data.polygons.foreach_get("vertices", fv); F = fv.reshape(-1, 3)
inm = np.all((st > mlo - Kn["margin"]) & (st < mhi + Kn["margin"]), axis=1); fm = F[np.all(inm[F], axis=1)]
mir = st * [-1, 1, 1]
tree = BVHTree.FromPolygons([Vector(p) for p in mir], [tuple(f[::-1]) for f in fm])   # the mirror turns the faces round
idx = np.nonzero(wgt > 0)[0]; moved = 0; far_ = 0.0
for i in idx:
  hit = tree.find_nearest(Vector(st[i]))
  if hit[0] is None: continue
  tgt = np.array(hit[0]); d = tgt - st[i]; st[i] = st[i] + wgt[i] * d; moved += 1; far_ = max(far_, float(np.linalg.norm(d)))
log["knee"] = {"box": Kn["box"], "ease": Kn["ease"], "points_in_box": int(inb.sum()), "points_moved": moved, "largest_move_m": round(far_, 3),
               "from": "Sakyamuni's own left knee, mirrored across x"}
# the old hand's sides and back, laid onto the knee, leave folded slivers: relax them in place (Blender's Smooth,
# weighted by the same easing, `knee.relax` passes), then lay them back onto the mirrored knee
me = ob.data; me.vertices.foreach_set("co", to_blender(st).ravel()); me.update()
if Kn.get("relax"):
  vg = ob.vertex_groups.new(name="knee")
  for i in idx: vg.add([int(i)], float(wgt[i]), "REPLACE")
  md = ob.modifiers.new("relax", "SMOOTH"); md.vertex_group = "knee"; md.factor = 1.0; md.iterations = Kn["relax"]
  bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier="relax"); ob.vertex_groups.remove(ob.vertex_groups["knee"])
  co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); st = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
  for i in idx:
    hit = tree.find_nearest(Vector(st[i]))
    if hit[0] is not None: st[i] = st[i] + wgt[i] * (np.array(hit[0]) - st[i])
  log["knee"]["relaxed"] = Kn["relax"]
# where the old hand lay fully inside the box (weight 1), its faces are taken out and the mirrored left knee's own
# faces put in their place (laid onto it, the hand's sides and back folded over and showed inside out); the band at the
# box's edge keeps the figure's own points, laid onto the same surface, so the two meet on it
full = wgt >= 0.999
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
for i, v in enumerate(bm.verts): v.co = Vector(to_blender(st[i][None])[0])
dead = [f for f in bm.faces if all(full[v.index] for v in f.verts)]
bmesh.ops.delete(bm, geom=dead, context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
mdist = np.minimum((mir - blo).min(1), (bhi - mir).min(1)); takem = np.all((mir > blo) & (mir < bhi), axis=1) & (mdist > Kn["ease"] * 0.8)
fpatch = fm[np.all(takem[fm], axis=1)]; used = np.unique(fpatch); remap = {}
for j in used: remap[int(j)] = bm.verts.new(Vector(to_blender(mir[j][None])[0]))
for f in fpatch:
  try: bm.faces.new([remap[int(j)] for j in f[::-1]])
  except ValueError: pass
bm.to_mesh(me); bm.free(); me.update()
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); st = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
log["knee"].update({"faces_taken_out": len(dead), "faces_put_in": int(len(fpatch))})
# the new hand, joined
nb = len(st); allco = np.r_[st, hand_co]
me = ob.data; bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
for p in hand_co: bm.verts.new(Vector(to_blender(p[None])[0]))
bm.verts.ensure_lookup_table()
for f in hand_faces:
  try: bm.faces.new([bm.verts[nb + int(j)] for j in f])
  except ValueError: pass
for i, v in enumerate(bm.verts[:nb]): v.co = Vector(to_blender(st[i][None])[0])
bm.to_mesh(me); bm.free(); me.update()
log["joined"] = {"hand_points": len(hand_co), "hand_faces": len(hand_faces), "how": "joined over the wrist, the hand's wrist sunk into the forearm (no boolean: the figure is many open shells)"}
# back to the file's own frame and units, so the rest of the pipeline (thinning, baking) takes it as it took r1
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
S3 = np.c_[co[:, 0], co[:, 2], -co[:, 1]]; B3 = S3 / k; B3 = np.c_[B3[:, 0], -B3[:, 2], B3[:, 1]] + off
me.vertices.foreach_set("co", B3.ravel()); me.update()
for o in bpy.context.scene.objects: o.select_set(o == ob)
dst = os.path.join(out, "sakyamuni-varada.glb"); bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True, export_normals=True)
log["out"] = {"file": dst, "sha256": sha(dst)}
json.dump(log, open(os.path.join(out, "varada.json"), "w"), indent=1); print(json.dumps({k2: log[k2] for k2 in ("knee", "joined", "out")}))
