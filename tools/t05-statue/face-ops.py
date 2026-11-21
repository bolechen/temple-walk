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
   "c": B(*c_m), "r": [round(k * w / s, 5) for k in R["mouth"]["r"]], "rd": [round(k * w / s, 5) for k in R["mouth"].get("rd", R["mouth"]["r"])],
   "s": R["mouth"]["s"], "back": round(R["mouth"]["back"] * faceW / s, 5),
   # nothing at the base of the nose, the whole move by the upper lip's foremost point: the philtrum recedes all the way up
   "below": round(sn_y / s, 5), "fade": round(max(sn_y - (slit + (P["upperLip"][0] - P["slit"][0])), 0.02) / s, 5)},
  {"op": "scale", "note": f"chin's pad: depth ×{R['chin']['s'][2]} about the hollow under the lip (y {round(sm_y, 3)}), radius {R['chin']['r'][0]} mouth widths, centred {R['chin']['drop']} w below the slit; nothing above the slit",
   "c": B(*c_c), "r": [round(k * w / s, 5) for k in R["chin"]["r"]], "s": R["chin"]["s"], "below": round((slit - 0.02) / s, 5), "fade": round(0.03 / s, 5)},
]
# the jaw's line lifted a little either side of the chin (the chin's pad no longer a ball: the 3D review's third round)
if R.get("jaw"):
  J = R["jaw"]
  for sg, side in ((1, "left"), (-1, "right")):
    jx, jy = sg * J["x"] * w, slit - J["drop"] * w
    ops.append({"op": "push", "note": f"the jaw's line lifted {J['d']} of the face's width on the {side}, {J['x']} w out and {J['drop']} w below the slit (face-ops.py)",
                "seed": B(jx, jy, z_at(jx, jy)), "r": round(J["r"] * w / s, 5), "dir": [0, 0, 1], "d": round(J["d"] * faceW / s, 5)})
# the hollow under the lower lip filled by a share of its depth (measured square to the line from the lower lip to the chin)
if R.get("fill"):
  d_m = f["sulcus"] * w * R["fill"]["k"]
  ops.append({"op": "push", "note": f"the hollow under the lip filled by {R['fill']['k']} of its depth ({round(f['sulcus'] * w, 3)} m), radius {R['fill']['r']} mouth widths (face-ops.py)",
              "seed": B(0.0, sm_y, z_at(0, sm_y)), "r": round(R["fill"]["r"] * w / s, 5), "dir": [0, -1, 0], "d": round(d_m / s, 5)})
# r7 (the 3D review's fourth round: "a thin lip, told by its slit and its colour, not by its volume"): the lips' volume and
# the philtrum's pad taken down, the lower face narrowed below the cheekbones, then a shallow groove carved back along the
# slit as it was before (measured here, on the bowed mesh before these ops) with a small dimple at each corner
span = pts["browY"] - slit
if R.get("flatten"):
  Fl = R["flatten"]
  ops.append({"op": "attenuate", "note": f"the lips' volume kept to {Fl['k']} of itself, radius {Fl['r']} w, smoothed over {Fl['sr']} w (face-ops.py)",
              "seed": B(0.0, slit, z_at(0, slit)), "r": round(Fl["r"] * w / s, 5), "sr": round(Fl["sr"] * w / s, 5), "k": Fl["k"], "iter": Fl.get("iter", 800)})
if R.get("philtrumPad"):
  Pp = R["philtrumPad"]; py = (slit + (P["upperLip"][0] - P["slit"][0]) + sn_y) / 2
  ops.append({"op": "attenuate", "note": f"the philtrum's pad kept to {Pp['k']} of itself (face-ops.py)", "seed": B(0.0, py, z_at(0, py)),
              "r": round(Pp["r"] * w / s, 5), "sr": round(Pp["sr"] * w / s, 5), "k": Pp["k"], "iter": Pp.get("iter", 500)})
if R.get("facex"):
  Fx = R["facex"]; cheek = slit + Fx["cheek"] * span
  ops.append({"op": "facex", "note": f"the lower face narrowed ×{Fx['k']} across below the cheekbones (y {round(cheek, 3)}), easing over {Fx['fade']} of the brow-to-mouth span, and out again down the neck (face-ops.py)",
              "y0": round(cheek / s, 5), "fade": round(Fx["fade"] * span / s, 5), "k": Fx["k"], "rx": round(1.0 / s, 5), "front": round(0.45 / s, 5),
              "ymin": round((slit - Fx["neck"] * span) / s, 5), "fadeLow": round(0.25 * span / s, 5)})
if R.get("groove"):
  G = R["groove"]; line = []
  for x in np.linspace(f["corners"]["R"], f["corners"]["L"], 15):
    yy = np.arange(slit - 0.03, slit + 0.0301, 0.002); zz = np.array([z_at(x, y) for y in yy])
    kk = np.polyfit(yy, zz, 1); ys = float(yy[np.argmax(np.polyval(kk, yy) - zz)]); line.append(B(float(x) * R["mouth"]["s"][0], ys, z_at(x, ys)))
  ops.append({"op": "groove", "note": f"a groove {G['depth']} w deep and {G['width']} w wide carved back along the slit as it was, corner dimples {G['dimple']['d']} w deep (face-ops.py)",
              "points": line, "depth": round(G["depth"] * w / s, 5), "width": round(G["width"] * w / s, 5),
              "dimples": {"r": round(G["dimple"]["r"] * w / s, 5), "d": round(G["dimple"]["d"] * w / s, 5)}})
print(json.dumps(ops, ensure_ascii=False, indent=1))
