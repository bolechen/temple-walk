# Orthographic close-ups of one part of a statue, in the stage's frame, with a metre grid drawn on (issue #514: to read
# where a hand, a wrist or a knee lies before cutting).
#
#   python3 tools/blender/look.py <in.glb> <height m> <out prefix> <cx> <cy> <cz> <size m> [views: front,left,right,below,top]
#
# The statue is stood `height` metres tall in the stage's frame (x across, the figure's left at +x; y up from its seat;
# z toward the viewer: Blender's x, -y, z with the file turned as the stage turns it, which for these files is none),
# lit by Blender's workbench, and seen orthographically `size` metres across, centred on (cx, cy, cz). Each picture is
# <out prefix>-<view>.png, 900 px square, with grid lines every 0.1 m labelled in the stage's coordinates.
import bpy, sys, math
from mathutils import Vector
import numpy as np
a = sys.argv[1:]; src, H, out = a[0], float(a[1]), a[2]; cx, cy, cz, size = map(float, a[3:7]); views = (a[7] if len(a) > 7 else "front,left").split(",")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in obs: o.select_set(True)
bpy.context.view_layer.objects.active = obs[0]
if len(obs) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
co = np.empty(len(ob.data.vertices) * 3); ob.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
mn, mx = co.min(0), co.max(0); k = H / (mx[2] - mn[2])
# stage (x, y up, z toward viewer) = (bx, bz, -by) after centring x/y and putting the base at 0
co = (co - [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]]) * k
ob.data.vertices.foreach_set("co", co.ravel()); ob.data.update()
sc = bpy.context.scene; sc.render.engine = "BLENDER_WORKBENCH"; sc.render.resolution_x = sc.render.resolution_y = 900
sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "SINGLE"; sc.display.shading.single_color = (0.75, 0.72, 0.66)
sc.display.shading.show_cavity = True
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = size; cam.data.clip_end = 100
C = Vector((cx, -cz, cy))   # the stage's point in Blender's frame
dirs = {"front": Vector((0, -1, 0)), "left": Vector((1, 0, 0)), "right": Vector((-1, 0, 0)), "below": Vector((0, -0.0001, -1)), "top": Vector((0, 0.0001, 1))}
from PIL import Image, ImageDraw
for vname in views:
  d = dirs[vname]; cam.location = C + d * 20
  cam.rotation_euler = (C - cam.location).to_track_quat("-Z", "Z" if vname not in ("below", "top") else "Y").to_euler()
  f = f"{out}-{vname}.png"; sc.render.filepath = f; bpy.ops.render.render(write_still=True)
  # the picture's axes in the stage's frame: right and up
  ax = {"front": ((1, 0, 0), (0, 1, 0)), "left": ((0, 0, -1), (0, 1, 0)), "right": ((0, 0, 1), (0, 1, 0)), "below": ((1, 0, 0), (0, 0, 1)), "top": ((1, 0, 0), (0, 0, -1))}[vname]
  c3 = np.array([cx, cy, cz]); im = Image.open(f).convert("RGB"); dr = ImageDraw.Draw(im); px = 900 / size
  for i, (axis, horiz) in enumerate(((ax[0], True), (ax[1], False))):
    A = np.array(axis); c0 = float(c3 @ A)
    for t in np.arange(math.floor((c0 - size / 2) * 10) / 10, c0 + size / 2, 0.1):
      p = (t - c0) * px + 450
      if horiz: dr.line([(p, 0), (p, 900)], fill=(200, 40, 40)); dr.text((p + 2, 2), f"{t:.1f}", fill=(255, 255, 0))
      else: q = 450 - (t - c0) * px; dr.line([(0, q), (900, q)], fill=(40, 40, 200)); dr.text((2, q + 2), f"{t:.1f}", fill=(0, 255, 255))
  dr.text((300, 880), f"{vname}: right = {ax[0]}, up = {ax[1]}", fill=(255, 255, 255)); im.save(f)
  print(f)
