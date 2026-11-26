# The whole figure from where a visitor stands (issue #701): Blender's workbench, clay, a studio light; for judging the bow of the head, the neck behind it and the ears against the shoulders.
#
#   python3 tools/t05-statue/whole-views.py <statue.glb> <out prefix> <face.json> [--az=0,50,90] [--dist=14] [--h=1.6] [--look=5.5] [--lens=70] [--turn=deg]
#
# --az: angles round the figure in degrees, 0 in front of it and 90 at its right side (the figure's left, seen from its front: the stage's +x is its left); --dist: metres from the figure's axis;
# --h: the eye's height over the floor of the hall (the figure stands on a plinth of 0.4 m); --look: the height of the point the camera looks at, over the floor too. Writes <prefix>-az<angle>.png, 700 px square.
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
xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
ob.data.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs)))); ob.data.update()
sc = bpy.context.scene; sc.render.engine = "BLENDER_WORKBENCH"; sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "SINGLE"; sc.display.shading.single_color = (0.8, 0.78, 0.74); sc.display.shading.show_shadows = True
sc.render.resolution_x = sc.render.resolution_y = 700; w = bpy.data.worlds.new("w"); w.color = (0.12, 0.12, 0.13); sc.world = w
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c")); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = float(opt.get("lens", 70)); cam.data.sensor_width = 36
D = float(opt.get("dist", 14)) / s; H = (float(opt.get("h", 1.6)) - 0.4) / s; L = (float(opt.get("look", 5.5)) - 0.4) / s
for az in [float(a) for a in str(opt.get("az", "0,50,90")).split(",")]:
  a = math.radians(az); cam.location = Vector((D * math.sin(a), -D * math.cos(a), H)); cam.rotation_euler = (Vector((0, 0, L)) - cam.location).to_track_quat("-Z", "Y").to_euler()
  sc.render.filepath = f"{pre}-az{int(az)}.png"; bpy.ops.render.render(write_still=True)
