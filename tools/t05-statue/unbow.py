# A bowed figure's mesh with its bow turned back about the neck (issue #463: the lip measures read the profile in the
# figure's own upright frame, so a receding chin under a bowed head is not read as no hollow under the lip).
#
#   python3 tools/t05-statue/unbow.py <statue.glb> <face.json> <deg> <out.glb>
#
# The points above the neck's pivot (face.json "neck": {"c": [y, z]}, stage frame at face.json "height") are turned back
# by `deg` about it, as cheek-lip.py turns them; the file is written in the stage frame (metres, glTF y up).
import sys, json
import numpy as np, trimesh
src, facef, deg, dst = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
face = json.load(open(facef)); H = face["height"]; yc, zc = face["neck"]["c"]
m = trimesh.load(src, force="mesh"); v = m.vertices; mn, mx = v.min(0), v.max(0); s = H / (mx[1] - mn[1])
v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s
a = np.radians(deg) * (v[:, 1] > yc - 0.3)   # only the head and neck (the bow fades in over the neck; above it, whole)
dy, dz = v[:, 1] - yc, v[:, 2] - zc
v = np.c_[v[:, 0], yc + dy * np.cos(a) + dz * np.sin(a), zc + dz * np.cos(a) - dy * np.sin(a)]
m.vertices = v; m.export(dst); print(dst)
