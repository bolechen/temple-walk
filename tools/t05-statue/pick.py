# Points on a statue's surface in its own frame (issue #370; the "pick a point on the model" tool that
# docs/t05/STATUE-PIPELINE.md §一 3② asked for, after #287 read the Śākyamuni's forearm wrong three times off a picture).
#   python3 tools/t05-statue/pick.py <in.glb> name:x,z[:from] ...  [--scale=8.6] [--topz=0.52]   (top: x, depth; cast down from topz)
# x, z are read off a views.py/grid.py picture (front: x to the viewer's right, z up; side pictures: --from=right gives
# x as the depth toward the viewer). A line is cast from the front (or from the figure's right side, or from above) and
# the first surface it meets is reported, in file units and, scaled, in the frame tools/t05-hall/paint.js reads:
# metres, x to the viewer's right, y up from the lowest point, z toward the viewer.
import bpy, sys, math, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = {a[2:].split("=")[0]: a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--") and "=" in a}
S = float(opt.get("scale", 1)); bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=args[0])
ob = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]; me = ob.data; me.transform(ob.matrix_world)
me.transform(Matrix.Rotation(math.radians(float(opt.get("turn", 0))), 4, "Z"))
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); mn, mx = co.min(0), co.max(0)
me.transform(Matrix.Translation((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2])))
bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
out = {}
for a in args[1:]:
  name, xz, *fr = a.split(":"); u, v = map(float, xz.split(",")); fr = fr[0] if fr else "front"
  o, d = {"front": (Vector((u, -5, v)), Vector((0, 1, 0))), "right": (Vector((-5, -u, v)), Vector((1, 0, 0))), "top": (Vector((u, -v, float(opt.get("topz", 5)))), Vector((0, 0, -1))), "back": (Vector((u, 5, v)), Vector((0, -1, 0)))}[fr]
  loc, n, i, dist = bvh.ray_cast(o, d)
  if loc is None: out[name] = None; continue
  fig = [loc.x, loc.z, -loc.y]   # paint frame, file units
  out[name] = {"units": [round(c, 4) for c in fig], "m": [round(c * S, 3) for c in fig], "n": [round(n.x, 2), round(n.z, 2), round(-n.y, 2)]}
print(json.dumps(out, indent=0))
