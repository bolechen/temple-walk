# Per-ray report of where sight lines end, under several ways of calling a hit "the back of a face" (issue #578), so two
# scripts can be set side by side on the same lines once the earlier run's lines are known.
#
#   python3 tools/t05-statue/closed/raycompare.py <statue.glb> <rays.json> <out.json> [--turn=-90]
#   python3 tools/t05-statue/closed/raycompare.py --make-grid <rays.json> [--window=0.8]    # write this project's own line set
#
# rays.json: { "stand": { "height": 8.2, "at": [x, y0, z] },   # as backfaces.py stands the figure (the hall's frame)
#              "rays": [ { "id": 0, "view": "name", "eye": [x, y, z], "dir": [dx, dy, dz] }, … ] }
# For each ray the report has: the first face hit (index in the welded mesh), the point and distance, the face's
# geometric normal and its sign against the line (`back_geom`: normal·dir > 0), the sign of the normal interpolated from
# the points' own normals as the file holds them (`back_vertex`; the glTF's NORMAL, if any), the welded piece and the
# file's own shell (the unwelded island: the texture-seam islands) the face is in, whether the eye lies inside the body
# (an odd number of crossings along the ray back to infinity is not tried; the signed-volume test is by ray parity along
# +y from the eye), and the second hit when the first is a back (`then`: the face behind it and its sign).
import sys, json, math
import bpy  # brings mathutils in
import numpy as np, trimesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
STAND = {"height": 8.2, "at": [-16.45, 4.27, -17.6]}
EYES = {"aisle-nearest": (-19.33, 4.6, -15.43), "aisle42": (-20.85, 4.6, -15.0), "sakya": (-14.5, 4.6, -7.0),
        "hand10": (-17.6, 3.2, -7.0), "hand34": (-11.5, 4.0, -9.5), "hand-level": (-17.9, 7.8, -6.0)}
if "make-grid" in opt:
  win = float(opt.get("window", 0.8)); aim = np.array([-18.05, 7.4, -16.0]); rays = []
  for name, eye in EYES.items():
    e = np.array(eye); d0 = aim - e; d0 /= np.linalg.norm(d0); r = np.cross(d0, [0, 1.0, 0]); r /= np.linalg.norm(r); u = np.cross(r, d0)
    n = 41
    for i in range(n):
      for j in range(n):
        d = aim + r * ((i / (n - 1) - 0.5) * win) + u * ((j / (n - 1) - 0.5) * win) - e; d /= np.linalg.norm(d)
        rays.append({"id": len(rays), "view": name, "eye": list(eye), "dir": d.round(6).tolist()})
  json.dump({"stand": STAND, "note": f"{n}x{n} lines per view through a {win} m window square to the line of sight at {aim.tolist()}", "rays": rays}, open(args[0], "w"))
  print(len(rays), "rays"); sys.exit(0)
R = json.load(open(args[1])); st = R.get("stand", STAND)
sc = trimesh.load(args[0], force="scene"); m = trimesh.util.concatenate(list(sc.geometry.values()))
v = m.vertices.copy(); f = m.faces.copy()
vn = np.array(m.vertex_normals)   # the file's own NORMAL if it has one, else trimesh's area-weighted ones
if float(opt.get("turn", 0)):
  a = math.radians(float(opt["turn"])); c, s_ = math.cos(a), math.sin(a); Rm = np.array([[c, 0, -s_], [0, 1, 0], [s_, 0, c]]); v = v @ Rm.T; vn = vn @ Rm.T
mn, mx = v.min(0), v.max(0); k = st["height"] / (mx[1] - mn[1]); v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * k + st["at"]
raw = trimesh.Trimesh(v, f, process=False); shell_file = np.zeros(len(f), int)
for si, comp in enumerate(trimesh.graph.connected_components(raw.face_adjacency, nodes=np.arange(len(f)))): shell_file[comp] = si
w = trimesh.Trimesh(v, f, vertex_normals=vn, process=False); w.merge_vertices(merge_tex=False, merge_norm=False)   # same face order after the weld
shell_weld = np.zeros(len(w.faces), int)
for si, comp in enumerate(trimesh.graph.connected_components(w.face_adjacency, nodes=np.arange(len(w.faces)))): shell_weld[comp] = si
tree = BVHTree.FromPolygons([Vector(p) for p in v.tolist()], [tuple(x) for x in f.tolist()], epsilon=0.0)
fn = raw.face_normals; VN = vn[f]; out = []
for r in R["rays"]:
  e = Vector(r["eye"]); d = Vector(r["dir"]); loc, nor, idx, dist = tree.ray_cast(e, d)
  o = {"id": r["id"], "view": r.get("view"), "hit": idx is not None}
  if idx is not None:
    dd = np.array(d); bary = None
    # the interpolated vertex normal at the hit (barycentric by the nearest-point formula)
    a_, b_, c_ = v[f[idx]]; p = np.array(loc); v0, v1, v2 = b_ - a_, c_ - a_, p - a_
    d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1; den = d00 * d11 - d01 * d01 or 1e-30
    bv = (d11 * d20 - d01 * d21) / den; bw = (d00 * d21 - d01 * d20) / den; bu = 1 - bv - bw
    nv = bu * VN[idx][0] + bv * VN[idx][1] + bw * VN[idx][2]
    o.update({"face": int(idx), "point": p.round(4).tolist(), "dist_m": round(float(dist), 4), "normal_geom": fn[idx].round(3).tolist(),
              "back_geom": bool(fn[idx] @ dd > 0), "back_vertex": bool(nv @ dd > 0), "weld_piece": int(shell_weld[idx]), "file_shell": int(shell_file[idx])})
    if o["back_geom"]:
      loc2, _, idx2, dist2 = tree.ray_cast(loc + d * 1e-4, d)
      o["then"] = None if idx2 is None else {"face": int(idx2), "dist_m": round(float(dist2) + 1e-4, 4), "back_geom": bool(fn[idx2] @ np.array(d) > 0), "same_piece": bool(shell_weld[idx2] == shell_weld[idx])}
  out.append(o)
S = {}
for o in out:
  s = S.setdefault(o["view"], {"rays": 0, "hit": 0, "back_geom": 0, "back_vertex": 0, "disagree": 0}); s["rays"] += 1; s["hit"] += o["hit"]
  if o["hit"]: s["back_geom"] += o["back_geom"]; s["back_vertex"] += o["back_vertex"]; s["disagree"] += o["back_geom"] != o["back_vertex"]
json.dump({"file": args[0], "summary": S, "rays": out}, open(args[2], "w"))
for k_, s in S.items(): print(k_, s)
