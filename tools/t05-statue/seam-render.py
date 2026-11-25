# Where the face meets the rest of a baked statue (hairline, ear root, neck), as the normal map shows it: eye-render.py's Cycles, sun and clay, from any side (issue #701).
#
#   python3 tools/t05-statue/eye-render.py <statue.glb> <out.png> <look height, stage m> <face.json> [--az=0 degrees round the figure, 0 in front, 90 at its left] [--lx=0 look point across, stage m] [--dist=10] [--samples=48] [--lens=400] [--camz=<camera height, stage m>]
#
# Blender's workbench ignores normal maps, so the 60k levels' fringe cannot be seen there; this draws it (slowly: about a minute). The glTF importer
# wires each material's normal map in; the base colour is replaced by one grey so that only the shape and the map are looked at.
import bpy, sys, math, json
from mathutils import Vector
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
src, out, ey, facef = args; face = json.load(open(facef)); s = face["height"] / face["fileHeight"]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
ms = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in ms:
  for slot in o.material_slots:
    nt = slot.material.node_tree
    for n in nt.nodes:
      if n.type == "BSDF_PRINCIPLED": n.inputs["Base Color"].default_value = (0.7, 0.68, 0.64, 1); n.inputs["Roughness"].default_value = 0.6
      for l in list(nt.links):
        if l.to_node == n and l.to_socket.name == "Base Color": nt.links.remove(l)
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = int(opt.get("samples", 48)); sc.cycles.use_denoising = False
sc.render.resolution_x = sc.render.resolution_y = 600
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.35; w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.55, 1); sc.world = w
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.0; sun.rotation_euler = (math.radians(65), 0, math.radians(25)); sc.collection.objects.link(sun)
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c")); sc.collection.objects.link(cam); sc.camera = cam
import math as _m
az = _m.radians(float(opt.get("az", 0))); Dm = float(opt.get("dist", 10)) / s; z = float(ey) / s; lx = float(opt.get("lx", 0)) / s
cam.data.lens = float(opt.get("lens", 400)); cam.data.sensor_width = 36; camz = float(opt.get("camz", 1.6)) / s
cam.location = Vector((Dm * _m.sin(az), -Dm * _m.cos(az), camz)); cam.rotation_euler = (Vector((lx, 0, z)) - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.render.filepath = out; bpy.ops.render.render(write_still=True)
