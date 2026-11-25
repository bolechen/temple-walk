# Close views of one statue's mouth, for judging the lips by shape (issue #701): the face from the front at the mouth's height
# (10 m, long lens), from the side, and from a visitor's eye 10 m in front and 1.6 m up, with the figure on its 0.4 m plinth.
# Blender's workbench, a studio light, no colour: shape only (software drawing says nothing of the real light, which is T4's).
#
#   python3 tools/t05-statue/lip-views.py <statue.glb> <out prefix> <face.json> [--turn=deg] [--mouth=y_stage_m] [--unbow=deg] [--frontlens=mm] [--sidelens=mm] [--sidedy=m] [--sidey=file units, the face's depth the side view is aimed at]
#
# face.json is the figure's own (tools/t05-statue/<name>/face.json: "height", "fileHeight", "features.mouth"). Writes
# <prefix>-front.png, -side.png, -below.png, 600 px square each. `--mouth` overrides the mouth's height (a bowed head's lies lower).
import bpy, sys, math, json
from mathutils import Vector, Matrix
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = {a[2:].split("=")[0]: (a.split("=", 1)[1] if "=" in a else True) for a in sys.argv[1:] if a.startswith("--")}
src, pre, facef = args; face = json.load(open(facef)); s = face["height"] / face["fileHeight"]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
if len(objs) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active; mw = ob.matrix_world.copy(); ob.parent = None; ob.matrix_world = Matrix.Identity(4); ob.data.transform(mw)
ob.data.transform(Matrix.Rotation(math.radians(float(opt.get("turn", 0))), 4, "Z")); ob.data.update()
xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
ob.data.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs)))); ob.data.update()   # centred, feet on 0
if "unbow" in opt:   # the head turned back by the bow (face-build's --tilt) about the neck's pivot, to see the profile as the figure stands upright (#701): stage y up, z toward the viewer; here height is z and depth is -y
  a = math.radians(float(opt["unbow"])); cy, cz = face["neck"]["c"]; ys_ = cy / s
  for v in ob.data.vertices:
    if v.co.z > ys_:
      dh = v.co.z - ys_; dd = -v.co.y - cz / s; v.co.z = ys_ + dh * math.cos(a) + dd * math.sin(a); v.co.y = -(cz / s + dd * math.cos(a) - dh * math.sin(a))
  ob.data.update()
my = float(opt.get("mouth", face["features"]["mouth"][1])) / s   # file units
# the face looks toward -y here; the head's centre in x is 0
sc = bpy.context.scene; sc.render.engine = "BLENDER_WORKBENCH"; sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "SINGLE"; sc.display.shading.single_color = (0.8, 0.78, 0.74)
sc.display.shading.show_shadows = True; sc.render.resolution_x = sc.render.resolution_y = 600; sc.render.film_transparent = False
w = bpy.data.worlds.new("w"); w.color = (0.12, 0.12, 0.13); sc.world = w
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c")); sc.collection.objects.link(cam); sc.camera = cam
def shot(name, pos, look, mm):
  cam.data.lens = mm; cam.data.sensor_width = 36; cam.location = Vector(pos)
  cam.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat("-Z", "Y").to_euler(); sc.render.filepath = f"{pre}-{name}.png"; bpy.ops.render.render(write_still=True)
D = 10 / s; plinth = 0.4 / s
shot("front", (0, -D, my), (0, 0, my), float(opt.get("frontlens", 400)))
sy = float(opt.get("sidey", 0)); sz = my - float(opt.get("sidedy", 0)) / s
shot("side", (D, sy, sz), (0, sy, sz), float(opt.get("sidelens", 400)))
shot("below", (0, -D, 1.6 / s), (0, 0, my), 300) if False else shot("below", (0, -D, (1.6 - 0.4) / s), (0, 0, my), 300)
