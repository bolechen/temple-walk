# The face's reshaping ops for one figure, worked out from its own landmarks rather than tuned by hand (issue #463, the
# 3D review's second round: "the other six take the same recipe, its numbers given by their anchors").
#
#   python3 tools/t05-statue/face-ops.py <statue.glb> <points.json> [--recipe=<face-recipe.json>] > ops.json
#
# <statue.glb> is the figure as repair.py leaves it before these ops (bowed, if it is to be bowed); points.json as
# face-ratios.py's mesh mode takes it ("height", "mouth", "browY"). The landmarks are found on the mesh by the same
# measures (face-ratios.py), then the recipe (defaults below, the review's values) is laid on them:
#   mouth  `scale` about the slit's middle, radii in mouth widths, nothing above the base of the nose
#   chin   `scale` of the chin's pad in depth about the hollow under the lip, radius in mouth widths, nothing above the slit
# Writes the ops in file units (repair.py's frame: x across, −y toward the viewer, z up), each with a note of where its
# numbers came from.
import sys, json, subprocess, os
import numpy as np, trimesh
glb, ptsf = sys.argv[1], sys.argv[2]
opt = dict(a[2:].split("=", 1) for a in sys.argv[3:] if a.startswith("--"))
R = {"mouth": {"r": [1.3, 0.6, 1.3], "s": [1.12, 0.85, 0.8], "back": 0.015},
     "chin": {"r": [0.8, 0.8, 0.8], "s": [1.0, 1.0, 0.85], "drop": 0.45}}
if "recipe" in opt: R.update(json.load(open(opt["recipe"])))
here = os.path.dirname(os.path.abspath(__file__))
pts = json.load(open(ptsf))
f = json.loads(subprocess.run([sys.executable, os.path.join(here, "face-ratios.py"), "mesh", glb, ptsf], capture_output=True, text=True, check=True).stdout)
m = trimesh.load(glb, force="mesh"); v = m.vertices; mn, mx = v.min(0), v.max(0); H = mx[1] - mn[1]; s = pts["height"] / H
m.vertices = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s
ray = trimesh.ray.ray_triangle.RayMeshIntersector(m)
def z_at(x, y):
  loc, _, _ = ray.intersects_location([[x, y, 20.0]], [[0, 0, -1.0]], multiple_hits=False); return float(loc[0][2])
w, faceW, slit = f["w_m"], f["faceW_m"], f["slit"]; P = f["points"]
sn_y = P["noseBase"][0] if not pts.get("tilt") else slit + (P["noseBase"][0] - P["slit"][0])   # heights above the slit hold under a small bow
sm_y = slit - (P["slit"][0] - P["sulcus"][0])
B = lambda x, y, z: [round(x / s, 5), round(-z / s, 5), round(y / s, 5)]   # the figure's stage frame (m) → repair.py's file frame
c_m = (0.0, slit, z_at(0, slit)); c_c = (0.0, slit - R["chin"]["drop"] * w, z_at(0, sm_y))
ops = [
  {"op": "scale", "note": f"mouth: across ×{R['mouth']['s'][0]}, height ×{R['mouth']['s'][1]}, depth ×{R['mouth']['s'][2]} about the slit's middle, back {R['mouth']['back']} of the face's width; radii {R['mouth']['r']} mouth widths; nothing above the base of the nose (face-ops.py: w {w} m, face {faceW} m, slit y {slit}, nose base y {round(sn_y, 3)})",
   "c": B(*c_m), "r": [round(k * w / s, 5) for k in R["mouth"]["r"]], "s": R["mouth"]["s"], "back": round(R["mouth"]["back"] * faceW / s, 5),
   "below": round((sn_y - 0.01) / s, 5), "fade": round(0.02 / s, 5)},
  {"op": "scale", "note": f"chin's pad: depth ×{R['chin']['s'][2]} about the hollow under the lip (y {round(sm_y, 3)}), radius {R['chin']['r'][0]} mouth widths, centred {R['chin']['drop']} w below the slit; nothing above the slit",
   "c": B(*c_c), "r": [round(k * w / s, 5) for k in R["chin"]["r"]], "s": R["chin"]["s"], "below": round((slit - 0.02) / s, 5), "fade": round(0.03 / s, 5)},
]
# the hollow under the lower lip filled by a share of its depth (measured square to the line from the lower lip to the chin)
if R.get("fill"):
  d_m = f["sulcus"] * w * R["fill"]["k"]
  ops.append({"op": "push", "note": f"the hollow under the lip filled by {R['fill']['k']} of its depth ({round(f['sulcus'] * w, 3)} m), radius {R['fill']['r']} mouth widths (face-ops.py)",
              "seed": B(0.0, sm_y, z_at(0, sm_y)), "r": round(R["fill"]["r"] * w / s, 5), "dir": [0, -1, 0], "d": round(d_m / s, 5)})
print(json.dumps(ops, ensure_ascii=False, indent=1))
