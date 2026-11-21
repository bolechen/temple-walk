# The round-2 measures on the grafted hand (issue #514; the 3D review's second-round list and the art director's):
#
#   python3 tools/blender/varada-check2.py <varada.json> <out dir>
#
# Reads <out>/sakyamuni-varada.glb, <out>/hand.glb (the hand as placed, stage frame) and the target (target.file), each
# stood at its height, and writes <out>/check2.json:
#   wrist_edge   every open-edge point of the hand within its wrist end lies under the forearm's surface by ≥ 5 mm
#                (signed distance to the figure without the hand, along the nearest face's normal)
#   seam         in the band round the knee box: the gap from each open-edge point to the nearest open-edge point across
#                (not on a face of its own) ≤ 2 mm; pieces of fewer than 50 faces round the box 0; the angle between the
#                normals of faces sharing an edge ≤ 60°
#   knee_area    the area of the faces inside the box (the patch)
#   palm_pitch   the palm plane's normal (wrist, index root, little root) above (+) or below (−) level; −25° to +10°
#   finger       wrist → fingertip against down (−y)
#   sections     long / short axis of the forearm's cross-section just above the joint and of the hand's at its wrist ≤ 1.25
#   hand_width   across the knuckles
import sys, os, json
import numpy as np, trimesh
from scipy.spatial import cKDTree
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; T, Kn = cfg["target"], cfg["knee"]
def stood(p, H):
  m = trimesh.load(p, force="mesh", process=False); v = m.vertices; mn, mx = v.min(0), v.max(0); s = H / (mx[1] - mn[1])
  t = trimesh.Trimesh((v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s, m.faces, process=False)
  t.merge_vertices(merge_tex=True, merge_norm=True); return t   # the glTF file splits points along its seams
res = stood(os.path.join(out, "sakyamuni-varada.glb"), T["height"])
hand = trimesh.load(os.path.join(out, "hand.glb"), force="mesh", process=False); hand.merge_vertices(merge_tex=True, merge_norm=True)
if os.path.exists(os.path.join(out, "hand-final.npy")):   # the hand where the solve put it (same points, same order)
  hand = trimesh.load(os.path.join(out, "hand.glb"), force="mesh", process=False); hand.vertices = np.load(os.path.join(out, "hand-final.npy")); hand.merge_vertices(merge_tex=True, merge_norm=True)
vj = json.load(open(os.path.join(out, "varada.json"))) if os.path.exists(os.path.join(out, "varada.json")) else {}
H = hand.vertices; tw = np.array(vj.get("pose", {}).get("wrist") or json.load(open(os.path.join(out, "hand.json")))["placed"]["wrist"])
tip = H[np.argmin(H[:, 1])]; ax = (tip - tw) / np.linalg.norm(tip - tw); al = (H - tw) @ ax; L = float(al.max())
rep = {}
# the figure without the hand: the result's points farther than 1 cm from any point of the placed hand
near = cKDTree(H).query(res.vertices, k=1)[0] < 0.01
keepf = ~np.any(near[res.faces], axis=1); body = trimesh.Trimesh(res.vertices, res.faces[keepf], process=False)
def boundary_verts(m):
  e = np.sort(m.edges, axis=1); u, c = np.unique(e, axis=0, return_counts=True); return np.unique(u[c == 1])
# wrist edge
hb = boundary_verts(hand); wb = hb[al[hb] < 0.12 * L]   # the ring at the wrist end, not the open edges between the fingers' shells
bsub = body.vertices; sel = np.linalg.norm(bsub - tw, axis=1) < 0.6
bm = trimesh.Trimesh(body.vertices, body.faces[np.all(sel[body.faces], axis=1)], process=False)
q, dist, fi = trimesh.proximity.closest_point(bm, H[wb])
sd = np.einsum("ij,ij->i", H[wb] - q, bm.face_normals[fi])
rep["wrist_edge"] = {"open_edge_points": int(len(wb)), "deepest_under_mm": round(float(-sd.min()) * 1000, 1), "shallowest_under_mm": round(float(-sd.max()) * 1000, 1), "median_under_mm": round(float(-np.median(sd)) * 1000, 1), "nearest_surface_mm_max": round(float(dist.max()) * 1000, 1),
                     "points_less_than_5mm_under": int((sd > -0.005).sum()), "limit_mm": 5}
# seam round the knee box
blo, bhi = np.array(Kn["box"][0]), np.array(Kn["box"][1]); e = Kn["ease"]
V = res.vertices; din = np.minimum((V - blo).min(1), (bhi - V).min(1)); band = (din > -e) & (din < 1.5 * e)
handpt = cKDTree(H).query(V, k=1)[0] < 0.02
rb = boundary_verts(res); rb = rb[band[rb] & ~handpt[rb]]
fadj = {}
for f in res.faces[np.any(np.isin(res.faces, rb), axis=1)]:
  for a in f: fadj.setdefault(a, set()).update(f)
tr = cKDTree(V[rb]); gaps = []
for i, a in enumerate(rb):
  ds, js = tr.query(V[a], k=8)
  g = [d for d, j in zip(ds, js) if j < len(rb) and rb[j] not in fadj.get(a, ())]
  gaps.append(g[0] if g else np.inf)
gaps = np.array(gaps); fin = gaps[np.isfinite(gaps)]
comp = trimesh.graph.connected_components(res.face_adjacency, nodes=np.arange(len(res.faces)), min_len=1)
fc = res.triangles_center; small = 0; small_faces = 0
for cset in comp:
  if len(cset) < 50 and np.all((fc[cset].mean(0) > blo - e) & (fc[cset].mean(0) < bhi + e)): small += 1; small_faces += len(cset)
fa = res.face_adjacency; ang = res.face_adjacency_angles; cen = (fc[fa[:, 0]] + fc[fa[:, 1]]) / 2
cin = np.minimum((cen - blo).min(1), (bhi - cen).min(1)); inband = (cin > -e) & (cin < 1.5 * e)
hand_f = np.any(handpt[res.faces], axis=1); inband &= ~hand_f[fa[:, 0]] & ~hand_f[fa[:, 1]]
rep["seam"] = {"open_edge_points_in_band": int(len(rb)), "gap_mm_p50": round(float(np.percentile(fin, 50)) * 1000, 2) if len(fin) else None,
               "gap_mm_p95": round(float(np.percentile(fin, 95)) * 1000, 2) if len(fin) else None, "gap_mm_max": round(float(fin.max()) * 1000, 2) if len(fin) else None,
               "gaps_over_2mm": int((fin > 0.002).sum()), "small_pieces": small, "small_piece_faces": small_faces,
               "normal_angle_max_deg": round(float(np.degrees(ang[inband].max())), 1), "edges_over_60deg": int((np.degrees(ang[inband]) > 60).sum()), "edges_in_band": int(inband.sum())}
inside = np.all((fc > blo) & (fc < bhi), axis=1) & ~hand_f
rep["knee_area_m2"] = round(float(res.area_faces[inside].sum()), 3)
# palm pitch and finger
fwd = np.array([0, 0, 1.0]); lat = np.cross(ax, fwd); lat /= np.linalg.norm(lat)
if lat[0] > 0: lat = -lat
bandh = H[(al > 0.45 * L) & (al < 0.55 * L)]; qq = bandh @ lat
ir = bandh[np.argmin(np.abs(qq - np.percentile(qq, 88)))]; lr = bandh[np.argmin(np.abs(qq - np.percentile(qq, 5)))]
n = np.cross(ir - tw, lr - tw); n /= np.linalg.norm(n); n = n if n[2] > 0 else -n
rep["palm_pitch_deg"] = {"value": round(float(np.degrees(np.arcsin(n[1]))), 1), "range": [-25, 10], "art_director": [-20, -15]}
rep["finger_vs_down_deg"] = round(float(np.degrees(np.arccos(-ax[1]))), 1)
rep["hand_width_m"] = round(float(np.percentile(qq, 99) - np.percentile(qq, 1)), 3)
rep["hand_length_m"] = round(L, 3)
def ratio(pts, axis):
  a2 = np.linalg.svd(np.c_[pts - pts.mean(0)] - np.outer((pts - pts.mean(0)) @ axis, axis), full_matrices=False)[1]
  return round(float(a2[0] / a2[1]), 3)
fa_dir = ax  # the forearm's own axis at the joint: from the points of the body within 0.4 m above the wrist
fd = np.array(cfg["target"].get("forearm_dir", [0, 0.06, -1.0])); fd = fd / np.linalg.norm(fd)   # from the wrist back toward the elbow
rel = body.vertices - tw; t_ = rel @ fd; radial = np.linalg.norm(rel - np.outer(t_, fd), axis=1)
up = body.vertices[(t_ > 0.1) & (t_ < 0.5) & (radial < 0.3) & (body.vertices[:, 1] > cfg["target"].get("forearm_floor", 3.68))]   # above the thigh it lies on
if len(up) > 50:
  fdir = -fd; sl = up[np.abs((up - tw) @ fd - 0.2) < 0.02]
  rep["sections"] = {"forearm_long_short": ratio(sl, fdir) if len(sl) > 10 else None, "hand_wrist_long_short": ratio(H[(al > 0.05 * L) & (al < 0.1 * L)], ax), "limit": 1.25}
json.dump(rep, open(os.path.join(out, "check2.json"), "w"), indent=1, ensure_ascii=False); print(json.dumps(rep, ensure_ascii=False))
