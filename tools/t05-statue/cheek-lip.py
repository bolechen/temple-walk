# Do the cheeks stand in front of the lips? (issue #463, the 3D review's fifth round: "the cheeks' foremost point, about
# 0.5 w out from the mouth's middle, no further forward than the lips' foremost point + 0.1 w", measured with the head's
# bow turned back, so that "forward" is the way the face looks.)
#
#   python3 tools/t05-statue/cheek-lip.py <statue.glb> <points.json> <face.json> [w_m]
#
# points.json as face-ratios.py takes it ("height", "mouth", "tilt"); face.json the figure's neck pivot ("neck": {"c": [y, z]} in the
# stage frame). w is the mouth's width in metres (face-ratios.py's w_m), given or measured.
import sys, json, subprocess, os
import numpy as np, trimesh
glb, ptsf, facef = sys.argv[1:4]; here = os.path.dirname(os.path.abspath(__file__))
pts, face = json.load(open(ptsf)), json.load(open(facef))
w = float(sys.argv[4]) if len(sys.argv) > 4 else json.loads(subprocess.run([sys.executable, os.path.join(here, "face-ratios.py"), "mesh", glb, ptsf], capture_output=True, text=True, check=True).stdout)["w_m"]
m = trimesh.load(glb, force="mesh"); v = m.vertices; mn, mx = v.min(0), v.max(0); s = pts["height"] / (mx[1] - mn[1])
v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s
# the bow turned back about the neck: points above the pivot come back (−z) by the tilt
yc, zc = face["neck"]["c"]; a = np.radians(pts.get("tilt", 0)); dy, dz = v[:, 1] - yc, v[:, 2] - zc
v = np.c_[v[:, 0], yc + dy * np.cos(a) + dz * np.sin(a), zc + dz * np.cos(a) - dy * np.sin(a)]
m.vertices = v; ray = trimesh.ray.ray_triangle.RayMeshIntersector(m)
def front(x, ys):
  o = np.c_[np.full_like(ys, x), ys, np.full_like(ys, 5.0)]; loc, idx, _ = ray.intersects_location(o, np.tile([0, 0, -1.0], (len(o), 1)), multiple_hits=False)
  z = np.full(len(ys), np.nan); z[idx] = loc[:, 2]; return z
# the mouth's height, unbowed: the slit given in points.json is the bowed one, turned back the same way
my = pts["mouth"][1]; mz = np.nanmax(front(0.0, np.array([my])))
my_u = yc + (my - yc) * np.cos(a) + (mz - zc) * np.sin(a)
ys = np.arange(my_u - 0.5 * w, my_u + 0.5 * w, 0.002)
lips = np.nanmax(np.r_[front(-0.02, ys), front(0.0, ys), front(0.02, ys)])
cheek = {side: float(np.nanmax(front(sg * 0.5 * w, ys))) for side, sg in (("left", 1), ("right", -1))}
out = {"w_m": round(w, 3), "lipsFront_m": round(float(lips), 4), "cheekFront_m": {k: round(c, 4) for k, c in cheek.items()},
       "cheekMinusLips_w": {k: round((c - lips) / w, 3) for k, c in cheek.items()}, "limit_w": 0.1,
       "pass": all((c - lips) / w <= 0.1 for c in cheek.values())}
print(json.dumps(out, ensure_ascii=False))
