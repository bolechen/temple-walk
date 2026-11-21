# Hand repair of a generated statue, as data (issue #370): put the file in the statue's own frame, apply the listed
# operations to its vertices, and write it again. Run headless with Blender as a Python module (pip install bpy):
#
#   python3 tools/t05-statue/repair.py <in.glb> <ops.json> <out.glb>
#
# The frame (the same as views.py): the figure faces the viewer at -y in Blender (+z in the written glTF), x is the
# viewer's right, z (glTF y) up, the lowest point at 0, centred on x and y; the file's own scale (Tripo: 1 unit tall).
# ops.json: { "turn": -90, "ops": [ { "op": "smooth", "note": "…", "seed": [x, y, z], "r": 0.085, "iter": 3000 }, … ] }
#   smooth  Blender's Smooth modifier, `iter` times at `factor` (1), on what lies within r of the seed and is joined to it
#           through the surface (so a fold of robe that only comes near is left alone), weighted by a smooth falloff to
#           nothing at r: takes a ring, cuff or step out of a limb. (#370 tried a hand-written Taubin smoothing and a
#           tube fit first; the first barely moved a 1.4-million-face mesh, the second tore it; docs/t05/SHAKYAMUNI-SAMPLE.md)
#   squeeze  {"below", "k", "band"}: narrow everything under a height (the lotus throne) toward the axis by k
#   headscale {"c", "s", "z0", "fade"}: scale the head about its centre, faded out below the chin (#370, faces of their own)
#   laplace the Laplacian Smooth modifier instead (implicit, keeps volume): moved nothing on this mesh, kept for trying
#   push    move what lies within r of the seed along `dir` by up to `d` (falloff as above): to straighten a finger or
#           part a fingertip from the throne.
# Each op prints how many points it moved and the largest move, so the edit is written down and can be redone.
import bpy, sys, math, json
import numpy as np
from mathutils import Matrix
src, opsf, dst = sys.argv[1:4]
spec = json.load(open(opsf))
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active; me = ob.data
mw = ob.matrix_world.copy(); ob.parent = None; ob.matrix_world = Matrix.Identity(4); me.transform(mw)
me.transform(Matrix.Rotation(math.radians(spec.get("turn", 0)), 4, "Z"))
# Tripo writes each point once per UV island; weld them, or an edit opens cracks along the seams
import bmesh
bm = bmesh.new(); bm.from_mesh(me); nv = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6); print(json.dumps({"weld": [nv, len(bm.verts)]})); bm.to_mesh(me); bm.free()
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
mn, mx = co.min(0), co.max(0); co -= [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]]
ed = np.empty(len(me.edges) * 2, dtype=np.int64); me.edges.foreach_get("vertices", ed); ed = ed.reshape(-1, 2)
log = []
def region(seed, r):
  d = np.linalg.norm(co - seed, axis=1); inside = d < r
  # flood through edges from the vertex nearest the seed, staying inside the sphere
  start = int(np.argmin(d)); keep = np.zeros(len(co), bool); keep[start] = True
  e = ed[inside[ed[:, 0]] & inside[ed[:, 1]]]
  while True:
    grow = keep[e[:, 0]] ^ keep[e[:, 1]]
    if not grow.any(): break
    keep[e[grow].ravel()] = True
  w = np.where(keep, 0.5 - 0.5 * np.cos(np.pi * np.clip(1 - d / r, 0, 1)), 0.0)   # 1 at the seed, 0 at r
  return keep, w
for op in spec["ops"]:
  if op["op"] in ("squeeze", "headscale", "zband", "xband"):
    before = co.copy(); z = co[:, 2]
    if op["op"] == "squeeze":
      # narrow the throne under the figure: below `below` (file units of height) the points come in toward the axis by
      # `k` across and in depth, easing back to 1 over `band` above it, so a lotus wider than the knees fits its seat
      t = np.clip((z - op["below"]) / op.get("band", 0.03), 0, 1); k = 1 + (op["k"] - 1) * (1 - t)
      co[:, 0] *= k; co[:, 1] *= k
    elif op["op"] == "zband":
      # shorten (k < 1) the trunk between z0 and z1 (file units of height): points inside come down toward z0 by k, and
      # everything above comes down by what the band lost, so the head and shoulders keep their shape (3D review risk 3:
      # the upper body read long)
      z0, z1, k = op["z0"], op["z1"], op["k"]
      co[:, 2] = np.where(z <= z0, z, np.where(z <= z1, z0 + (z - z0) * k, z - (z1 - z0) * (1 - k)))
    elif op["op"] == "xband":
      # widen or narrow across only (x), between z0 and z1, easing in and out over `fade` either side (the shoulders)
      z0, z1, k, f = op["z0"], op["z1"], op["k"], op.get("fade", 0.03)
      t = np.clip(np.minimum((z - (z0 - f)) / f, ((z1 + f) - z) / f), 0, 1); co[:, 0] *= 1 + (k - 1) * t
    else:
      # give one figure's head its own proportions (a face of its own among seven of one family): scale about the head's
      # centre `c` by `s` (x across, y depth, z up), fading to nothing between the chin `z0` and `z0 - fade`
      c = np.array(op["c"], float); sc = np.array(op["s"], float)
      t = np.clip((z - (op["z0"] - op.get("fade", 0.03))) / op.get("fade", 0.03), 0, 1)
      co = c + (co - c) * (1 + (sc - 1) * t[:, None])
    mv = np.linalg.norm(co - before, axis=1)
    log.append({"op": op["op"], "note": op.get("note", ""), "points": int((mv > 1e-9).sum()), "moved_max": round(float(mv.max()), 5)}); print(json.dumps(log[-1])); continue
  seed = np.array(op["seed"], float); r = op["r"]; keep, w = region(seed, r)
  before = co.copy()
  if op["op"] in ("smooth", "laplace"):
    # Blender's Laplacian Smooth modifier (an implicit solve, so a broad ring goes in a few steps; volume kept),
    # weighted by the falloff over the joined region
    me.vertices.foreach_set("co", co.ravel()); me.update()
    vg = ob.vertex_groups.new(name="fix"); idx = np.nonzero(keep)[0]
    for i in idx: vg.add([int(i)], float(w[i]), "REPLACE")
    if op["op"] == "smooth":   # the plain Smooth modifier, repeated (explicit; shrinks a little where weighted fully)
      md = ob.modifiers.new("fix", "SMOOTH"); md.vertex_group = "fix"; md.factor = op.get("factor", 1.0); md.iterations = op.get("iter", 100)
    else:
      md = ob.modifiers.new("fix", "LAPLACIANSMOOTH"); md.vertex_group = "fix"; md.iterations = op.get("iter", 10)
      md.lambda_factor = op.get("lambda", 2.0); md.lambda_border = 0; md.use_volume_preserve = True; md.use_normalized = True
    bpy.context.view_layer.objects.active = ob; ob.select_set(True); bpy.ops.object.modifier_apply(modifier="fix"); ob.vertex_groups.remove(ob.vertex_groups["fix"])
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
  elif op["op"] == "push":
    v = np.array(op["dir"], float); v /= np.linalg.norm(v); co += (op["d"] * w)[:, None] * v
  mv = np.linalg.norm(co - before, axis=1)
  log.append({"op": op["op"], "note": op.get("note", ""), "points": int(keep.sum()), "moved_max": round(float(mv.max()), 5), "moved_mean": round(float(mv[keep].mean()), 5)})
  print(json.dumps(log[-1]))
me.vertices.foreach_set("co", co.ravel()); me.update(); me.validate()
# shade by the surface as it now is: drop the normals stored in the file (glTF import keeps them as custom split
# normals, which would carry an edited surface's old shading, or hide a ring the shape has), and smooth by angle
def fresh_normals(o):
  bpy.context.view_layer.objects.active = o; o.select_set(True)
  if o.data.has_custom_normals: bpy.ops.mesh.customdata_custom_splitnormals_clear()
  for f in o.data.polygons: f.use_smooth = True
fresh_normals(ob)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=False, export_normals=True, export_apply=True)
json.dump({"src": src, "ops": opsf, "dst": dst, "log": log}, open(dst + ".log.json", "w"), indent=1)
