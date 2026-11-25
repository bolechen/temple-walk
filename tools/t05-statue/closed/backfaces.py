# Sight lines that end on the back of a face, from where a visitor stands (issue #578, the second stage's first check).
#
#   python3 tools/t05-statue/closed/backfaces.py <statue.glb> <out.json> [--window=0.8] [--aim=-18.05,7.4,-16.0] [--turn=-90]
#
# Stands the figure as the white-box hall does (tools/t05-hall/stage.js: scaled to 8.2 m by its own height, centred on x
# and z by its bounding box, feet at the altar's top plus the plinth, the hall's metres: x -16.45, y 4.27, z -17.6), then,
# from each eye below, shoots a square grid of lines through a window of `--window` metres across, centred on `--aim`
# (the right wrist) and square to the line of sight, and counts the lines whose first hit is the back of a face (the
# face's normal turned away from the eye). Welding is by position only, as three would after mergeVertices, so the seams
# of the texture do not count as open.
# This follows the description of the earlier runs (docs/t05/evidence/514-r2-e/J-back-faces.json: "rays of the hall's
# cameras round the wrist, 31 x 31 for the acceptance views, 41 x 41 for the visitor positions, first hit a back face");
# the script of those runs is not in the repository, and the window size is not recorded there, so `--window` was set
# by running the original's face-processed file (sakyamuni-f1) and matching its 0 / 147 / 0 (see the report).
import sys, json, math
import bpy  # brings mathutils in
import numpy as np, trimesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
win = float(opt.get("window", 0.8)); aim = np.array([float(x) for x in opt.get("aim", "-18.05,7.4,-16.0").split(",")])
HEIGHT, X, Y0, Z = 8.2, -16.45, 4.27, -17.6
EYES = {
  "knee34-close": None,  # the five acceptance views of the earlier runs are not in the repository with their eyes; the visitor positions are
  "aisle-nearest (-19.33, 4.6, -15.43), 3.2 m": (-19.33, 4.6, -15.43),
  "aisle-nearest-old (-19.12, 4.6, -15.79)": (-19.12, 4.6, -15.79),
  "aisle42 (-20.85, 4.6, -15.0), 4.2 m": (-20.85, 4.6, -15.0),
  "sakya (-14.5, 4.6, -7.0), 10.1 m": (-14.5, 4.6, -7.0),
  "sakya-old (-13.31, 4.6, -8.01)": (-13.31, 4.6, -8.01),
  "cam-hand10 (-17.6, 3.2, -7.0)": (-17.6, 3.2, -7.0),
  "cam-hand34 (-11.5, 4.0, -9.5)": (-11.5, 4.0, -9.5),
  "cam-hand-level (-17.9, 7.8, -6.0)": (-17.9, 7.8, -6.0),
}
extra = [a for a in sys.argv[1:] if a.startswith("--eye=")]
for a in extra:
  n, p = a[6:].split(":"); EYES[n] = tuple(float(x) for x in p.split(","))
def stood(path):
  sc = trimesh.load(path, force="scene"); m = trimesh.util.concatenate(list(sc.geometry.values()))
  v = m.vertices.copy(); f = m.faces
  if float(opt.get("turn", 0)):   # the Tripo original faces +x; repair.py's `turn` -90 puts it on +z, as the hall's files are
    a = math.radians(float(opt["turn"])); c, s_ = math.cos(a), math.sin(a); v = v @ np.array([[c, 0, -s_], [0, 1, 0], [s_, 0, c]]).T
  # glTF (x, y up, z toward the viewer) is the hall's frame already, facing +z
  mn, mx = v.min(0), v.max(0); s = HEIGHT / (mx[1] - mn[1])
  v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s + [X, Y0, Z]
  t = trimesh.Trimesh(v, f, process=False); t.merge_vertices(merge_tex=False, merge_norm=False)
  return t
m = stood(args[0]); V = m.vertices; F = m.faces
tree = BVHTree.FromPolygons([Vector(p) for p in V.tolist()], [tuple(x) for x in F.tolist()], epsilon=0.0)
fn = m.face_normals
out = {"file": args[0], "faces": int(len(F)), "window_m": win, "views": {}}
for name, eye in EYES.items():
  if eye is None: continue
  e = np.array(eye); d0 = aim - e; dist = np.linalg.norm(d0); d0 /= dist
  up = np.array([0, 1.0, 0]); r = np.cross(d0, up); r /= np.linalg.norm(r); u = np.cross(r, d0)
  n = 41 if "(" in name else 31
  back = 0; tot = 0; pts = []; hits = 0; near = 0
  for i in range(n):
    for j in range(n):
      tgt = aim + r * ((i / (n - 1) - 0.5) * win) + u * ((j / (n - 1) - 0.5) * win)
      d = tgt - e; d /= np.linalg.norm(d)
      loc, nor, idx, dd = tree.ray_cast(Vector(e), Vector(d))
      tot += 1
      if idx is not None:
        hits += 1; near += int(np.linalg.norm(np.array(loc) - tgt) < 0.15)
      if idx is not None and float(np.dot(fn[idx], d)) > 0: back += 1; pts.append(np.array(loc).round(3).tolist())
  out["views"][name] = {"back": back, "rays": tot, "hit": hits, "hit_within_0.15m_of_the_aimed_point": near, "dist_m": round(float(dist), 2), "first_back_hits": pts[:5]}
  print(name, back, "/", tot)
json.dump(out, open(args[1], "w"), indent=1)
