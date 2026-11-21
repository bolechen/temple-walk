# Sakyamuni's right hand in the boon-granting gesture (与愿印), by grafting Sikhin's left hand mirrored (issue #514).
#
#   python3 tools/blender/varada.py <varada.json> <out dir> [--stage=hand|all]
#
# Step 1 (hand): the donor's hand is cut out of Sikhin's mesh below the plane `donor.cut` and within `donor.keep`,
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
K = D["keep"]; keep = ((st - cp) @ cn > 0) & (np.linalg.norm(st - K["centre"], axis=1) < K["radius"]) & (st[:, 0] > K["xmin"])
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
# the donor hand's own frame: the wrist is the middle of what lies within 2 cm of the cut; the long axis runs from it to
# the farthest point (the middle finger's tip); the palm's normal is the thinnest direction, turned toward +z
wr = P[np.abs((P - cp) @ cn) < 0.02].mean(0); far = P[np.argmax(np.linalg.norm(P - wr, axis=1))]
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
