# The 3D review's checks on the grafted hand (issue #514), measured on the full mesh:
#
#   python3 tools/blender/varada-check.py <varada.json> <out dir>
#
# Reads <out>/sakyamuni-varada.glb, <out>/hand.glb (stage frame) and the original (target.file), each stood at its height.
#   facing     the palm's normal (the plane through the wrist and the roots of the index and little fingers, turned
#              toward the viewer) against forward (+z): ≤ 45°; the middle finger (wrist → the point farthest along the axis)
#              against down (-y): ≤ 35°
#   thumb      the thumb's tip (the point farthest to the figure's right, -x, of the hand's lower 70%) is farther from the
#              figure's middle than the fingertip
#   size       the hand's length (wrist → fingertip) against the original hand's (its wrist at target.wrist down to the
#              lowest point of the old hand in the knee box)
#   lotus      the lowest point of the hand above the lotus's top (the figure's highest point within 0.3 m of the throne's
#              rim under the hand)
#   elsewhere  every point of the original outside the knee box (and the ease band round it) has a point of the result
#              within 1 mm (nothing else moved)
#   knee       the box replaced, and how many of the original's points lay in it
import sys, os, json
import numpy as np, trimesh
from scipy.spatial import cKDTree
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; T, Kn = cfg["target"], cfg["knee"]
def stood(p, H):
  m = trimesh.load(p, force="mesh"); v = m.vertices; mn, mx = v.min(0), v.max(0); s = H / (mx[1] - mn[1])
  return (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s, m.faces
orig, _ = stood(T["file"], T["height"]); res, _ = stood(os.path.join(out, "sakyamuni-varada.glb"), T["height"])
hand = trimesh.load(os.path.join(out, "hand.glb"), force="mesh").vertices
tw = np.array(T["wrist"]); tip = hand[np.argmax((hand - tw) @ (np.array(T["fingertips"]) - tw))]
ax = (tip - tw) / np.linalg.norm(tip - tw); along = (hand - tw) @ ax; L = float(np.linalg.norm(tip - tw))
# the palm's plane through the wrist and the roots of the index and little fingers (the 3D review's definition): the
# knuckles lie about half way along the hand; across it (square to the axis and to forward) the index's root is the
# point farthest toward the thumb (the figure's right, -x), the little finger's the point farthest the other way
fwd = np.array([0, 0, 1.0]); lat = np.cross(ax, fwd); lat /= np.linalg.norm(lat)
if lat[0] > 0: lat = -lat                                   # toward the thumb, the figure's right
band = hand[(along > 0.45 * along.max()) & (along < 0.55 * along.max())]
q = band @ lat; hi_, lo_ = np.percentile(q, 88), np.percentile(q, 5)   # the thumb stands out past the index's root at the same height: take the knuckle edge, not the thumb
idx_root = band[np.argmin(np.abs(q - hi_))]; lit_root = band[np.argmin(np.abs(q - lo_))]
n = np.cross(idx_root - tw, lit_root - tw); n /= np.linalg.norm(n)
if n[2] < 0: n = -n
deg = lambda a, b: float(np.degrees(np.arccos(np.clip(a @ b / np.linalg.norm(a) / np.linalg.norm(b), -1, 1))))
low = hand[along > 0.3 * along.max()]; thumb = low[np.argmin(low[:, 0])]
blo, bhi = np.array(Kn["box"][0]), np.array(Kn["box"][1])
inbox = np.all((orig > blo) & (orig < bhi), axis=1); old = orig[inbox]; old_tip = old[np.argmin(old[:, 1])]
oldL = float(np.linalg.norm(old_tip - tw))
# the throne's rim under the hand: the figure's highest point below the knee box, within 0.3 m of the hand across
rim = orig[(orig[:, 1] < blo[1]) & (np.abs(orig[:, 0] - tip[0]) < 0.3) & (np.abs(orig[:, 2] - tip[2]) < 0.3)]
lotus = float(hand[:, 1].min() - rim[:, 1].max()) if len(rim) else None
pad = Kn["ease"] + 0.02
outside = ~np.all((orig > blo - pad) & (orig < bhi + pad), axis=1)
# the hand's own place, where the wrist sinks into the forearm, is not "elsewhere" either
near_hand = cKDTree(hand).query(orig, k=1)[0] < 0.05
d, _ = cKDTree(res).query(orig[outside & ~near_hand], k=1)
rep = {"landmarks": {"wrist": tw.round(3).tolist(), "index_root": idx_root.round(3).tolist(), "little_root": lit_root.round(3).tolist(), "tip": tip.round(3).tolist()}, "facing": {"palm_vs_forward_deg": round(deg(n, np.array([0, 0, 1.0])), 1), "limit": 45, "finger_vs_down_deg": round(deg(ax, np.array([0, -1.0, 0])), 1), "limit_finger": 35},
       "thumb": {"thumb_tip": thumb.round(3).tolist(), "fingertip": tip.round(3).tolist(), "thumb_farther_out": bool(abs(thumb[0]) > abs(tip[0]))},
       "size": {"new_length_m": round(L, 3), "old_length_m": round(oldL, 3), "ratio": round(L / oldL, 3), "range": [0.9, 1.1]},
       "lotus": {"clearance_m": round(lotus, 3) if lotus is not None else None},
       "elsewhere": {"points_checked": int(len(d)), "largest_move_mm": round(float(d.max()) * 1000, 3), "over_1mm": int((d > 0.001).sum())},
       "knee": {"box": Kn["box"], "ease_m": Kn["ease"], "original_points_in_box": int(inbox.sum())},
       "joint": "the hand is joined over the wrist, its wrist sunk into the forearm (no boolean, no bridge ring): the figure is many open shells (167 in Sikhin, likewise here), so it is not watertight anywhere; the joint adds an overlap where the two meet"}
json.dump(rep, open(os.path.join(out, "check.json"), "w"), indent=1, ensure_ascii=False); print(json.dumps(rep, ensure_ascii=False))
