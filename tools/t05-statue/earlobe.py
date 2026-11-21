# How far each earlobe's lowest point hangs above the shoulder under it (issue #463: the art director added "earlobes
# all but reaching the shoulders", from the owner's travelogue, quoted second-hand, to the list of the face's points;
# measured only, nothing changed).
#
#   python3 tools/t05-statue/earlobe.py <statue.glb> <height m>
#
# In the figure's stage frame (metres): the lobe is the lowest point of the surface beside the head (|x| 0.5–0.95 m,
# from 1.2 m above the slit's usual height down, behind the face) that a ray cast down from just under it does not meet
# within 3 cm (it hangs free); the shoulder is what that ray meets next, within 2 m. Ears stand behind the face (z −0.3 to
# −1.0 m), which keeps the robe in front of the chest out.
import sys, json, numpy as np, trimesh
m = trimesh.load(sys.argv[1], force="mesh"); H = float(sys.argv[2]); v = m.vertices; mn, mx = v.min(0), v.max(0); s = H / (mx[1] - mn[1])
m.vertices = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s; V = m.vertices
ray = trimesh.ray.ray_triangle.RayMeshIntersector(m); out = {}
for side, sg in (("L", 1), ("R", -1)):
  sel = (sg * V[:, 0] > 0.5) & (sg * V[:, 0] < 0.95) & (V[:, 1] > 0.72 * H) & (V[:, 1] < 0.86 * H) & (V[:, 2] < -0.3) & (V[:, 2] > -1.0)
  idx = np.nonzero(sel)[0]; order = idx[np.argsort(V[idx, 1])]
  for i in order[:4000]:   # from the lowest up: the first point under which there is a gap is the lobe's lowest
    p = V[i]; loc, _, _ = ray.intersects_location([p - [0, 0.005, 0]], [[0, -1.0, 0]], multiple_hits=False)
    if len(loc) and 0.03 < p[1] - loc[0][1] < 2.0:
      out[side] = {"lobe": [round(float(q), 3) for q in p], "shoulder": [round(float(q), 3) for q in loc[0]], "gap_m": round(float(p[1] - loc[0][1]), 3)}; break
print(json.dumps(out))
