# Orthographic and close views of one statue file, drawn by Blender's workbench (matcap-free studio light, no textures),
# for judging hands, forearms and robe edges before and after hand repair (issue #370). Run headless:
#
#   python3 tools/t05-statue/views.py <in.glb> <outdir> [--turn=deg] [--only=name,name]
#
# The statue is put in its own frame first: facing +y in Blender (the viewer stands at -y... see FRAME below), feet on
# z 0, centred on x. Tripo models face +x; --turn rotates about the vertical before anything is measured.
# Views: front, right (the figure's right, viewer's left), back, top, and close views of the right hand (front, side,
# below-front), the left hand (from above and front), the bared right shoulder and the robe's edge across the chest.
import bpy, sys, math, os, json
from mathutils import Vector, Matrix
args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = {a[2:].split("=")[0]: (a.split("=", 1)[1] if "=" in a else True) for a in sys.argv[1:] if a.startswith("--")}
src, out = args[0], args[1]; os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
if len(objs) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
# bake the import's node transforms into the vertices, then turn the vertices themselves (an object rotation under an
# imported parent node is easily lost)
mw = ob.matrix_world.copy(); ob.parent = None; ob.matrix_world = Matrix.Identity(4); ob.data.transform(mw)
turn = math.radians(float(opt.get("turn", 0))); ob.data.transform(Matrix.Rotation(turn, 4, "Z")); ob.data.update()
# FRAME: the figure faces -y (toward a camera standing at -y), x is the viewer's right, z up, feet at z 0, height 1 unit
# per unit of the file. Measured from the vertices so the same views fall on the same parts of any file of this figure.
# shade by the surface as it now is: drop the normals stored in the file (glTF import keeps them as custom split
# normals, which would carry an edited surface's old shading, or hide a ring the shape has), and smooth by angle
def fresh_normals(o):
  bpy.context.view_layer.objects.active = o; o.select_set(True)
  if o.data.has_custom_normals: bpy.ops.mesh.customdata_custom_splitnormals_clear()
  for f in o.data.polygons: f.use_smooth = True
fresh_normals(ob)
vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))); mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
c = (mn + mx) / 2; ob.data.transform(Matrix.Translation((-c.x, -c.y, -mn.z))); ob.data.update()
H = mx.z - mn.z; W = mx.x - mn.x; D = mx.y - mn.y
info = {"file": src, "tris": sum(len(p.vertices) - 2 for p in ob.data.polygons), "verts": len(ob.data.vertices), "size": [W, D, H]}
sc = bpy.context.scene; sc.render.engine = "BLENDER_WORKBENCH"; sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "SINGLE"
sc.display.shading.single_color = (0.66, 0.54, 0.38); sc.display.shading.show_cavity = True; sc.display.shading.cavity_type = "BOTH"
sc.display.shading.show_shadows = False; sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("w") if not sc.world else sc.world
sc.render.resolution_x = sc.render.resolution_y = int(opt.get("px", 1200))
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
def shoot(name, at, look, ortho=None, lens=50):
  if opt.get("only") and name not in opt["only"].split(","): return
  cam.location = at; d = Vector(look) - Vector(at); cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
  if ortho: cam.data.type = "ORTHO"; cam.data.ortho_scale = ortho
  else: cam.data.type = "PERSP"; cam.data.lens = lens
  cam.data.clip_end = 1000; sc.render.filepath = os.path.join(out, name + ".png"); bpy.ops.render.render(write_still=True)
s = max(W, H) * 1.05
shoot("front", (0, -10 * H, H / 2), (0, 0, H / 2), s); shoot("back", (0, 10 * H, H / 2), (0, 0, H / 2), s)
shoot("right", (-10 * H, 0, H / 2), (0, 0, H / 2), s); shoot("left", (10 * H, 0, H / 2), (0, 0, H / 2), s)
shoot("top", (0, -0.001, 10 * H), (0, 0, 0), s)
# Close views, placed by fractions of the figure's box (the earth-touching hand hangs at the viewer's left, low).
def P(fx, fy, fz): return (fx * W / 2, fy * D / 2, fz * H)
shoot("rhand-front", P(-0.55, -3.0, 0.42), P(-0.55, -0.6, 0.38), None, 70)
shoot("rhand-side", P(-2.6, -0.7, 0.42), P(-0.6, -0.6, 0.38), None, 70)
shoot("rhand-low", P(-0.6, -2.4, 0.15), P(-0.55, -0.6, 0.38), None, 60)
shoot("lhand-top", P(0.1, -1.2, 0.95), P(0.1, -0.4, 0.5), None, 60)
shoot("lhand-front", P(0.1, -3.0, 0.52), P(0.1, -0.4, 0.5), None, 70)
shoot("shoulder", P(-0.9, -2.6, 0.78), P(-0.25, -0.2, 0.68), None, 55)
shoot("chest", P(0.0, -3.0, 0.7), P(0.0, -0.2, 0.66), None, 60)
# --zoom=x,z,half[,side]: an orthographic close view centred on (x, z) of the frame, half-size `half`, from the front
# (or side=right: from the figure's right), with a grid every 0.01 unit drawn by the caller from the numbers printed here
if opt.get("zoom"):
  zx, zz, hh, *sd = opt["zoom"].split(","); zx, zz, hh = float(zx), float(zz), float(hh)
  if sd and sd[0] == "right": shoot("zoom", (-10 * H, zx, zz), (0, zx, zz), 2 * hh)
  elif sd and sd[0] == "back": shoot("zoom", (zx, 10 * H, zz), (zx, 0, zz), 2 * hh)   # x of the frame grows to the picture's LEFT
  else: shoot("zoom", (zx, -10 * H, zz), (zx, 0, zz), 2 * hh)
  info["zoom"] = {"x": zx, "z": zz, "half": hh, "side": sd[0] if sd else "front"}
# --probe=x,z;x,z: where a line straight in from the front meets the surface (the depth y of the nearest hit)
if opt.get("probe"):
  dg = bpy.context.evaluated_depsgraph_get(); info["probe"] = []
  for pr in opt["probe"].split(";"):
    px, pz = map(float, pr.split(",")); hit, loc, nrm, idx, _o, _m = sc.ray_cast(dg, Vector((px, -10, pz)), Vector((0, 1, 0)))
    info["probe"].append({"at": [px, pz], "hit": [round(v, 4) for v in loc] if hit else None, "n": [round(v, 3) for v in nrm] if hit else None})
json.dump(info, open(os.path.join(out, "info.json"), "w"), indent=1); print(json.dumps(info))
