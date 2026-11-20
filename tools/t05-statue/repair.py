# Hand repair of a generated statue, as data (issue #370): put the file in the statue's own frame, apply the listed
# operations to its vertices, and write it again. Run headless with Blender as a Python module (pip install bpy):
#
#   python3 tools/t05-statue/repair.py <in.glb> <ops.json> <out.glb>
#
# The frame (the same as views.py): the figure faces the viewer at -y in Blender (+z in the written glTF), x is the
# viewer's right, z (glTF y) up, the lowest point at 0, centred on x and y; the file's own scale (Tripo: 1 unit tall).
# ops.json: { "turn": -90, "ops": [ { "op": "taubin", "note": "…", "seed": [x, y, z], "r": 0.06, "iter": 40 }, … ] }
#   taubin  smooth what lies within r of the seed and is joined to it through the surface (so a fold of robe that only
#           comes near is left alone), weighted by a smooth falloff to nothing at r, with Taubin's two-step smoothing
#           (λ 0.5, μ -0.53), which takes out ridges and steps without shrinking the limb.
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
  seed = np.array(op["seed"], float); r = op["r"]; keep, w = region(seed, r)
  before = co.copy()
  if op["op"] == "taubin":
    e = ed[keep[ed[:, 0]] | keep[ed[:, 1]]]
    deg = np.bincount(e.ravel(), minlength=len(co)).astype(float); deg[deg == 0] = 1
    for _ in range(op.get("iter", 30)):
      for lam in (0.5, -0.53):
        s = np.zeros_like(co); np.add.at(s, e[:, 0], co[e[:, 1]]); np.add.at(s, e[:, 1], co[e[:, 0]])
        co += (lam * w)[:, None] * (s / deg[:, None] - co)
  elif op["op"] == "tube":
    # a limb is a tube: find its axis from the points (their longest spread), then within the band [t0, t1] along it
    # (metres of the file from the seed) set each point's distance from the axis to what the tube has just outside the
    # band at the same angle round it, so a ring, cuff or step is taken out and the limb keeps its own section
    P = co[keep] - seed; c0 = P.mean(0); U, S, Vt = np.linalg.svd(P - c0, full_matrices=False); ax = Vt[0]
    if np.dot(ax, op.get("up", [0, 0, 1])) < 0: ax = -ax
    t = (co - seed) @ ax; q = co - seed - np.outer(t, ax) - (c0 - np.dot(c0, ax) * ax)
    b1 = np.cross(ax, [1.0, 0, 0]); b1 /= np.linalg.norm(b1); b2 = np.cross(ax, b1)
    th = np.arctan2(q @ b2, q @ b1); rho = np.linalg.norm(q, axis=1)
    t0, t1, m = op["t0"], op["t1"], op.get("margin", 0.012); bins = 72
    def prof(lo, hi):
      sel = keep & (t > lo) & (t < hi); k = ((th[sel] + np.pi) / (2 * np.pi) * bins).astype(int) % bins
      out = np.full(bins, np.nan)
      for i in range(bins):
        v = rho[sel][k == i]
        if len(v): out[i] = np.median(v)
      return out
    if op.get("print"):
      for tt in np.arange(-r, r, 0.006): print(round(float(tt), 3), np.round(np.nanmedian(prof(tt, tt + 0.006)), 4))
    lo, hi = prof(t0 - m, t0), prof(t1, t1 + m)
    sel = keep & (t >= t0) & (t <= t1); k = ((th + np.pi) / (2 * np.pi) * bins).astype(int) % bins
    f = np.clip((t - t0) / (t1 - t0), 0, 1); target = lo[k] * (1 - f) + hi[k] * f
    ok = sel & np.isfinite(target) & (rho > 1e-6)
    edge = np.clip(np.minimum(t - t0, t1 - t) / op.get("soft", 0.006), 0, 1)   # ease in at the band's ends
    s_ = np.where(ok, 1 + (target / np.maximum(rho, 1e-9) - 1) * edge, 1.0)
    co[ok] = seed + np.outer(t[ok], ax) + (c0 - np.dot(c0, ax) * ax) + q[ok] * s_[ok][:, None]
    keep = ok
  elif op["op"] == "laplace":
    # Blender's Laplacian Smooth modifier (an implicit solve, so a broad ring goes in a few steps; volume kept),
    # weighted by the falloff over the joined region
    me.vertices.foreach_set("co", co.ravel()); me.update()
    vg = ob.vertex_groups.new(name="fix"); idx = np.nonzero(keep)[0]
    for i in idx: vg.add([int(i)], float(w[i]), "REPLACE")
    if op.get("kind") == "smooth":   # the plain Smooth modifier, repeated (explicit; shrinks a little where weighted fully)
      md = ob.modifiers.new("fix", "SMOOTH"); md.vertex_group = "fix"; md.factor = op.get("factor", 1.0); md.iterations = op.get("iter", 100)
    else:
      md = ob.modifiers.new("fix", "LAPLACIANSMOOTH"); md.vertex_group = "fix"; md.iterations = op.get("iter", 10)
      md.lambda_factor = op.get("lambda", 2.0); md.lambda_border = 0; md.use_volume_preserve = True; md.use_normalized = True
    bpy.context.view_layer.objects.active = ob; ob.select_set(True); print("apply", bpy.ops.object.modifier_apply(modifier="fix"), len(ob.modifiers)); ob.vertex_groups.remove(ob.vertex_groups["fix"])
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
for m in [s for s in bpy.data.materials]: pass
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=False, export_normals=True, export_apply=True)
json.dump({"src": src, "ops": opsf, "dst": dst, "log": log}, open(dst + ".log.json", "w"), indent=1)
