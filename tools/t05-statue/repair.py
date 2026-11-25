# Hand repair of a generated statue, as data (issue #370): put the file in the statue's own frame, apply the listed
# operations to its vertices, and write it again. Run headless with Blender as a Python module (pip install bpy):
#
#   python3 tools/t05-statue/repair.py <in.glb> <ops.json> <out.glb>
#
# The frame (the same as views.py): the figure faces the viewer at -y in Blender (+z in the written glTF), x is the
# viewer's right, z (glTF y) up, the lowest point at 0, centred on x and y; the file's own scale (Tripo: 1 unit tall).
# ops.json: { "turn": -90, "ops": [ { "op": "smooth", "note": "…", "seed": [x, y, z], "r": 0.085, "iter": 3000 }, … ] }
#   smooth  Blender's Smooth modifier, `iter` times at `factor` (1), on what lies within r of the seed and is joined to it
#           through the surface (so a fold of robe that only comes near is left alone), weighted by a smooth falloff to
#           nothing at r: takes a ring, cuff or step out of a limb. (#370 tried a hand-written Taubin smoothing and a
#           tube fit first; the first barely moved a 1.4-million-face mesh, the second tore it; docs/t05/SHAKYAMUNI-SAMPLE.md)
#   squeeze  {"below", "k", "band"}: narrow everything under a height (the lotus throne) toward the axis by k
#   headscale {"c", "s", "z0", "fade"}: scale the head about its centre, faded out below the chin (#370, faces of their own)
#   laplace the Laplacian Smooth modifier instead (implicit, keeps volume): moved nothing on this mesh, kept for trying
#   tilt    {"c", "deg", "z0", "fade", "rx", "fx"}: bow the head forward by `deg` about the neck point `c` (a turn about x: the face
#           goes toward the viewer and down), whole above `z0` and easing to nothing over `fade` below it (#463: a figure
#           seen from ten metres below reads frowning and pouting when its face is made for the level; real figures bow)
#   attenuate {"seed", "r", "k", "sr", "iter"}: take down the detail near the seed without moving the face as a whole
#           (#463, the 3D review): the surface within `sr` smoothed hard (`iter` passes of the Smooth modifier) is the
#           broad shape v_s, and each point goes to v_s + k'·(v − v_s), k' easing from `k` at the seed to 1 at `r`: a knit
#           brow kept to k of its depth, lips pushed out kept to k of their lift
#   scale   {"c", "r": [across, up, depth], "rd", "s": [across, up, depth], "back", "below", "fade"}: reshape the mouth or the
#           chin's pad in proportion (#463, the 3D review's second round): each point goes toward c + S·(v − c), weighted
#           by a Gaussian of its distance from c measured in the radii r (0.05 at one radius), then back by `back`; and
#           nothing above `below` (eased over `fade`), so the nose over a mouth is left as it is. File units; the figure's
#           frame here (x across, −y toward the viewer, z up).
#   groove  {"points": [[x, y, z], …], "depth", "width", "dimples": {"r", "d"}}: carve a shallow groove back along a
#           line of points (the mouth's slit as it was, #463 round four): each point within `width` of the line goes back
#           (+y) by up to `depth` (a Gaussian across the line), and at the line's two ends a small dimple d deep within r
#   facex   {"y0", "fade", "k", "rx", "front", "ymin", "fadeLow"}: narrow the lower face across by k about the middle, whole below y0 − fade
#           and nothing at y0 (the cheekbones), only within rx of the middle and in front of `front` (−y beyond it: the
#           ears and the back of the head stay)
#   push    move what lies within r of the seed along `dir` by up to `d` (falloff as above): to straighten a finger or
#           part a fingertip from the throne.
# Each op prints how many points it moved and the largest move, so the edit is written down and can be redone.
import bpy, sys, math, json, os
import numpy as np
from mathutils import Matrix
src, opsf, dst = sys.argv[1:4]
spec = json.load(open(opsf))
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active; me = ob.data
mw = ob.matrix_world.copy(); ob.parent = None; ob.matrix_world = Matrix.Identity(4); me.transform(mw)
me.transform(Matrix.Rotation(math.radians(spec.get("turn", 0)), 4, "Z"))
# Tripo writes each point once per UV island; weld them, or an edit opens cracks along the seams
import bmesh
# the weld is at 1e-8, not 1e-6 (#701): at 1e-6 it joins points of different seams that are a few micrometres apart, collapsing 210 faces of the 1.46 million and opening 210 edges (and non-manifold ones); at 1e-8 only points a seam shares exactly are joined, and the original stays closed
bm = bmesh.new(); bm.from_mesh(me); nv = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-8); print(json.dumps({"weld": [nv, len(bm.verts)]})); bm.to_mesh(me); bm.free()
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
mn, mx = co.min(0), co.max(0); co -= [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]]
ed = np.empty(len(me.edges) * 2, dtype=np.int64); me.edges.foreach_get("vertices", ed); ed = ed.reshape(-1, 2)
log = []
def region(seed, r):
  d = np.linalg.norm(co - seed, axis=1); inside = d < r
  # flood through edges from the vertex nearest the seed, staying inside the sphere
  start = int(np.argmin(d)); keep = np.zeros(len(co), bool); keep[start] = True
  e = ed[inside[ed[:, 0]] & inside[ed[:, 1]]]
  while True:
    grow = keep[e[:, 0]] ^ keep[e[:, 1]]
    if not grow.any(): break
    keep[e[grow].ravel()] = True
  w = np.where(keep, 0.5 - 0.5 * np.cos(np.pi * np.clip(1 - d / r, 0, 1)), 0.0)   # 1 at the seed, 0 at r
  return keep, w
DUMP = os.environ.get("REPAIR_DUMP")   # a folder: the points before each op and the faces, as .npy, for finding which op made what (#701)
if DUMP:
  os.makedirs(DUMP, exist_ok=True); np.save(os.path.join(DUMP, "faces.npy"), np.array([list(pl.vertices) for pl in me.polygons], dtype=np.int32))
for _k, op in enumerate(spec["ops"]):
  if DUMP: np.save(os.path.join(DUMP, f"before{_k:02d}.npy"), co.astype(np.float32))
  if op["op"] == "groove":
    before = co.copy(); L = np.array(op["points"], float); dep, wid = op["depth"], op["width"]
    # distance of each point to the polyline, in the x–z plane of the face (the groove runs across, seen from the front)
    best = np.full(len(co), np.inf); near_y = np.zeros(len(co))
    sel = np.nonzero((co[:, 0] > L[:, 0].min() - 3 * wid) & (co[:, 0] < L[:, 0].max() + 3 * wid) & (co[:, 2] > L[:, 2].min() - 4 * wid) & (co[:, 2] < L[:, 2].max() + 4 * wid))[0]
    P = co[sel][:, [0, 2]]
    for a, b in zip(L[:-1], L[1:]):
      A, Bv = a[[0, 2]], b[[0, 2]]; t = np.clip(((P - A) @ (Bv - A)) / max((Bv - A) @ (Bv - A), 1e-12), 0, 1)
      d = np.linalg.norm(P - (A + t[:, None] * (Bv - A)), axis=1); ny = a[1] + t * (b[1] - a[1])
      m = d < best[sel]; best[sel[m]] = d[m]; near_y[sel[m]] = ny[m]
    # only the front surface near the line's own depth, not the inside of the mouth or the cheek behind
    front = np.abs(co[:, 1] - near_y) < 6 * wid
    g = np.where(front, np.exp(-0.5 * (best / (wid / 2)) ** 2), 0); co[:, 1] += dep * g
    if op.get("dimples"):
      for e in (L[0], L[-1]):
        dd = np.linalg.norm(co - e, axis=1); gd = np.exp(-3 * (dd / op["dimples"]["r"]) ** 2); co[:, 1] += op["dimples"]["d"] * gd
    mv = np.linalg.norm(co - before, axis=1)
    log.append({"op": "groove", "note": op.get("note", ""), "points": int((mv > 1e-6).sum()), "moved_max": round(float(mv.max()), 5)}); print(json.dumps(log[-1])); continue
  if op["op"] == "snapshot":   # {"name"}: the points as they are now, for a later `hold`
    globals().setdefault("_snaps", {})[op["name"]] = co.copy(); log.append({"op": "snapshot", "note": op.get("note", ""), "name": op["name"]}); continue
  if op["op"] == "hold":
    # {"from", "z0", "z1"}: give back the snapshot's points from z0 up (whole) and ease to none at z1 below it (smoothstep), so that what lies above
    # z0 is exactly as the snapshot had it: the eyes, brows and nose stay as the bow left them and only the lower face is worked (#701, the art director:
    # 「以 r3c 的脸为底只动下巴」)
    snap = globals()["_snaps"][op["from"]]; u = np.clip((co[:, 2] - op["z1"]) / (op["z0"] - op["z1"]), 0, 1); w = u * u * (3 - 2 * u)
    before = co.copy(); co[:] = snap + (1 - w)[:, None] * (co - snap); mv = np.linalg.norm(co - before, axis=1)
    log.append({"op": "hold", "note": op.get("note", ""), "points": int((mv > 1e-9).sum()), "moved_max": round(float(mv.max()), 5), "left_above_z0_max": float(np.linalg.norm(co - snap, axis=1)[co[:, 2] >= op["z0"]].max())}); print(json.dumps(log[-1])); continue
  if op["op"] == "lowerback":
    # {"d", "z0", "z1", "fz", "x0", "x1", "front", "ffront", "smooth": {"iter", "lam"}}: the lower face (lower lip, chin and jaw as one mass)
    # pressed back by up to d (+y: away from the viewer), whole between z1 and z0 (z0 the slit's side), easing to nothing over fz below z1
    # and over the top 0.04 above z0 is not touched (nothing above z0); across it is whole within x0 of the middle and eases out by x1
    # (the ears stand beyond x1); only what lies in front of `front` (the neck's axis), eased over ffront. Then the points it moved are
    # relaxed toward the mean of their neighbours (`iter` passes of `lam`, weighted by the same field) so that no ridge is left where the
    # field ends (#701: the g4 trial's facex pinched the ear lobe and the neck; this field has no x scaling, only a smooth push)
    z = co[:, 2]; sm = lambda t: t * t * (3 - 2 * t)
    wz = sm(np.clip((op["z0"] - z) / op.get("fz0", 0.02), 0, 1)) * sm(np.clip((z - (op["z1"] - op["fz"])) / op["fz"], 0, 1))
    wx = 1 - sm(np.clip((np.abs(co[:, 0]) - op["x0"]) / (op["x1"] - op["x0"]), 0, 1))
    wf = sm(np.clip((op["front"] - co[:, 1]) / op["ffront"], 0, 1)); w = wz * wx * wf
    before = co.copy(); co[:, 1] += op["d"] * w
    sp = op.get("smooth")
    if sp:
      cnt = np.bincount(ed.ravel(), minlength=len(co)).astype(float)
      for _ in range(sp["iter"]):
        acc = np.zeros_like(co); np.add.at(acc, ed[:, 0], co[ed[:, 1]]); np.add.at(acc, ed[:, 1], co[ed[:, 0]])
        mean = acc / np.maximum(cnt, 1)[:, None]; co += sp["lam"] * w[:, None] * (mean - co)
    # no triangle may turn over (#701): where the push and the relaxation together turned one (a few millimetres across, at the jaw's edge
    # where the field is easing out), the move of its points and of their neighbours is halved, again until none is
    if "_tri" not in globals(): globals()["_tri"] = np.array([list(pl.vertices) for pl in me.polygons], dtype=np.int64)
    def _nrm(c):
      a_, b_, c_ = c[_tri[:, 0]], c[_tri[:, 1]], c[_tri[:, 2]]; x_ = np.cross(b_ - a_, c_ - a_); return x_ / np.maximum(np.linalg.norm(x_, axis=1, keepdims=True), 1e-30)
    n_before = _nrm(before); undone = 0
    for _ in range(12):
      bad = np.nonzero((_nrm(co) * n_before).sum(1) < 0)[0]
      if not len(bad): break
      # halved at the turned triangle's points and eased back to the full move over six rings of neighbours (a halving at the one ring left a dimple)
      ring = np.full(len(co), 99); ring[_tri[bad].ravel()] = 0
      for k_ in range(1, 7):
        a_, b_ = ring[ed[:, 0]], ring[ed[:, 1]]; g_ = (a_ == k_ - 1) & (b_ == 99); ring[ed[g_, 1]] = k_; g_ = (b_ == k_ - 1) & (a_ == 99); ring[ed[g_, 0]] = k_
      f_ = np.where(ring < 7, 1 - 0.5 * (1 - ring / 7.0), 1.0)
      co[:] = before + f_[:, None] * (co - before); undone += 1
    mv = np.linalg.norm(co - before, axis=1)
    log.append({"op": "lowerback", "note": op.get("note", ""), "points": int((mv > 1e-9).sum()), "moved_max": round(float(mv.max()), 5), "fold_passes": undone, "above_z0_max_move": float(mv[before[:, 2] > op["z0"]].max()) if (before[:, 2] > op["z0"]).any() else 0.0, "folds_left": int((((_nrm(co) * n_before).sum(1)) < 0).sum())}); print(json.dumps(log[-1])); continue
  if op["op"] == "facex":
    before = co.copy(); z = co[:, 2]; f = op["fade"]
    # the half-width test and the front plane were hard steps: across the plane (a 4 mm layer from cheek to cheek) the points on one side
    # narrowed and the points on the other did not, and the surface there folded over on itself (#701: 120 triangles of Krakucchanda's
    # L2 turned their normals more than 90°, all made by this op). Both now ease to nothing over `ffade` (file units, 0.012 by default,
    # about 10 cm on the stage) and `fx` (0.02, about 17 cm), as smoothstep.
    sm = lambda u: u * u * (3 - 2 * u)
    t = np.clip((op["y0"] - z) / f, 0, 1) * (1 - sm(np.clip((np.abs(co[:, 0]) - (op["rx"] - op.get("fx", 0.02))) / op.get("fx", 0.02), 0, 1))) * sm(np.clip((op["front"] - co[:, 1]) / op.get("ffade", 0.012), 0, 1))
    if "ymin" in op: t *= np.clip((z - op["ymin"]) / op.get("fadeLow", 1e-6), 0, 1)   # and easing out again down the neck
    co[:, 0] *= 1 + (op["k"] - 1) * t
    mv = np.linalg.norm(co - before, axis=1)
    log.append({"op": "facex", "note": op.get("note", ""), "points": int((mv > 1e-9).sum()), "moved_max": round(float(mv.max()), 5)}); print(json.dumps(log[-1])); continue
  if op["op"] == "depthk":
    # depth (toward the viewer, −y) scaled by k toward the head's upright axis (y = axis) inside an ellipse about c
    # (radii r: across, up), a soft hole round the lips (hole: c and radii), and fading to nothing above `top` and
    # beyond |x| = `xmax` (the cheekbones, the front of the ears) and inside the nose's wings (`nose`: c and radii)
    before = co.copy(); c = np.array(op["c"], float); r = np.array(op["r"], float)
    d = ((co[:, 0] - c[0]) / r[0]) ** 2 + ((co[:, 2] - c[2]) / r[1]) ** 2; g = np.exp(-3 * d) * (co[:, 1] < c[1] + op.get("front", 1e9))
    for key in ("hole", "nose"):
      if key in op:
        h = op[key]; dh = ((co[:, 0] - h["c"][0]) / h["r"][0]) ** 2 + ((co[:, 2] - h["c"][1]) / h["r"][1]) ** 2; g *= 1 - np.exp(-3 * dh)
    if "top" in op: g *= np.clip((op["top"] - co[:, 2]) / op.get("fade", 0.01), 0, 1)
    if "xmax" in op: g *= np.clip((op["xmax"] - np.abs(co[:, 0])) / op.get("fade", 0.01), 0, 1)
    if "bottom" in op: g *= np.clip((co[:, 2] - op["bottom"]) / op.get("fade", 0.01), 0, 1)
    co[:, 1] = op["axis"] + (co[:, 1] - op["axis"]) * (1 + (op["k"] - 1) * g)
    mv = np.linalg.norm(co - before, axis=1)
    log.append({"op": "depthk", "note": op.get("note", ""), "points": int((mv > 1e-9).sum()), "moved_max": round(float(mv.max()), 5)}); print(json.dumps(log[-1])); continue
  if op["op"] == "lidclamp":
    # the outer end of a closed eye's upper lid, which stands off the temple like a fin seen from the side: in the outer
    # part of the eye (from `x0` outward to `x1`, across; between `h0` and `h1` in height), the surface is kept within
    # `cap` of a line drawn up the face from the cheek under the eye (`hb`) to the brow over it (`ht`), each read at the
    # same place across as the foremost surface there; the clamp eases in over `ease` from x0, so the middle of the
    # eye keeps its carving
    before = co.copy(); x, dep, h = co[:, 0], -co[:, 1], co[:, 2]; sg = np.sign(op["x1"] - op["x0"])
    t = (x - op["x0"]) * sg; span = abs(op["x1"] - op["x0"])
    sel = np.nonzero((t >= 0) & (t <= span) & (h >= op["h0"]) & (h <= op["h1"]) & (dep > op["front"]))[0]
    def surf(hh):   # the foremost depth in thin bins across at height hh
      band = np.nonzero((np.abs(h - hh) < op["bin"]) & (dep > op["front"]) & ((x - op["x0"]) * sg >= -op["bin"]) & ((x - op["x0"]) * sg <= span + op["bin"]))[0]
      edges = np.arange(min(op["x0"], op["x1"]) - op["bin"], max(op["x0"], op["x1"]) + 2 * op["bin"], op["bin"])
      k = np.digitize(x[band], edges); best = np.full(len(edges) + 1, np.nan)
      for i, d in zip(k, dep[band]):
        if np.isnan(best[i]) or d > best[i]: best[i] = d
      ok = ~np.isnan(best); xs = np.r_[edges[0] - op["bin"], edges][ok] + op["bin"] / 2
      return lambda q: np.interp(q, xs, best[ok])
    top, bot = surf(op["ht"]), surf(op["hb"])
    xs_, hs_ = x[sel], h[sel]; f = np.clip((hs_ - op["hb"]) / (op["ht"] - op["hb"]), 0, 1)
    ref = bot(xs_) + f * (top(xs_) - bot(xs_)) + op["cap"]
    wgt = np.clip(t[sel] / op["ease"], 0, 1)
    over = dep[sel] - ref; m_ = over > 0
    newdep = dep[sel] - np.where(m_, over * wgt, 0)
    co[sel, 1] = -newdep
    mv = np.linalg.norm(co - before, axis=1)
    log.append({"op": "lidclamp", "note": op.get("note", ""), "points": int((mv > 1e-9).sum()), "moved_max": round(float(mv.max()), 5)}); print(json.dumps(log[-1])); continue
  if op["op"] == "scale":
    before = co.copy(); c = np.array(op["c"], float); r = np.array(op["r"], float); S = np.array(op["s"], float)
    d = (co - c) / [r[0], r[2], r[1]]; g = np.exp(-3 * (d * d).sum(1))
    # "rd": the depth's own radii, wider than the shape's, so the whole mouth recedes and not only its foremost points
    # (a narrow depth weight left a rim round the lips: the 3D review's third round)
    rd = np.array(op.get("rd", op["r"]), float); dd = (co - c) / [rd[0], rd[2], rd[1]]; gd = np.exp(-3 * (dd * dd).sum(1))
    if "below" in op: fz = np.clip((op["below"] - co[:, 2]) / op.get("fade", 0.003), 0, 1); g *= fz; gd *= fz
    target = c + (co - c) * [S[0], S[2], S[1]]; target[:, 1] += op.get("back", 0)
    co = co + g[:, None] * (target - co) * [1, 0, 1] + gd[:, None] * (target - co) * [0, 1, 0]
    mv = np.linalg.norm(co - before, axis=1)
    log.append({"op": "scale", "note": op.get("note", ""), "points": int((mv > 1e-6).sum()), "moved_max": round(float(mv.max()), 5)}); print(json.dumps(log[-1])); continue
  if op["op"] in ("squeeze", "headscale", "zband", "xband", "tilt"):
    before = co.copy(); z = co[:, 2]
    if op["op"] == "squeeze":
      # narrow the throne under the figure: below `below` (file units of height) the points come in toward the axis by
      # `k` across and in depth, easing back to 1 over `band` above it, so a lotus wider than the knees fits its seat
      t = np.clip((z - op["below"]) / op.get("band", 0.03), 0, 1); k = 1 + (op["k"] - 1) * (1 - t)
      co[:, 0] *= k; co[:, 1] *= k
    elif op["op"] == "zband":
      # shorten (k < 1) the trunk between z0 and z1 (file units of height): points inside come down toward z0 by k, and
      # everything above comes down by what the band lost, so the head and shoulders keep their shape (3D review risk 3:
      # the upper body read long)
      z0, z1, k = op["z0"], op["z1"], op["k"]
      co[:, 2] = np.where(z <= z0, z, np.where(z <= z1, z0 + (z - z0) * k, z - (z1 - z0) * (1 - k)))
    elif op["op"] == "xband":
      # widen or narrow across only (x), between z0 and z1, easing in and out over `fade` either side (the shoulders)
      z0, z1, k, f = op["z0"], op["z1"], op["k"], op.get("fade", 0.03)
      t = np.clip(np.minimum((z - (z0 - f)) / f, ((z1 + f) - z) / f), 0, 1); co[:, 0] *= 1 + (k - 1) * t
    elif op["op"] == "tilt":
      # the head bowed about the neck: the angle grows from nothing at z0 - fade to `deg` at z0 and above, so the neck
      # bends over the band instead of shearing; the figure faces -y here, so forward is -y
      c = np.array(op["c"], float); f = op.get("fade", 0.03)
      a = np.radians(op["deg"]) * np.clip((z - (op["z0"] - f)) / f, 0, 1); dy, dz = co[:, 1] - c[1], co[:, 2] - c[2]
      # only the head: across, the turn is whole within rx - fx of the middle and nothing at rx (a raised hand beside the
      # head stays where it is)
      if "rx" in op: a *= np.clip((op["rx"] - np.abs(co[:, 0] - c[0])) / op.get("fx", 0.02), 0, 1)
      co[:, 1] = c[1] + dy * np.cos(a) - dz * np.sin(a); co[:, 2] = c[2] + dy * np.sin(a) + dz * np.cos(a)
    else:
      # give one figure's head its own proportions (a face of its own among seven of one family): scale about the head's
      # centre `c` by `s` (x across, y depth, z up), fading to nothing between the chin `z0` and `z0 - fade`
      c = np.array(op["c"], float); sc = np.array(op["s"], float)
      t = np.clip((z - (op["z0"] - op.get("fade", 0.03))) / op.get("fade", 0.03), 0, 1)
      co = c + (co - c) * (1 + (sc - 1) * t[:, None])
    mv = np.linalg.norm(co - before, axis=1)
    log.append({"op": op["op"], "note": op.get("note", ""), "points": int((mv > 1e-9).sum()), "moved_max": round(float(mv.max()), 5)}); print(json.dumps(log[-1])); continue
  seed = np.array(op["seed"], float); r = op["r"]; keep, w = region(seed, r)
  before = co.copy()
  if op["op"] == "attenuate":
    ks, _ = region(seed, op.get("sr", 2 * r))
    me.vertices.foreach_set("co", co.ravel()); me.update()
    vg = ob.vertex_groups.new(name="fix"); vg.add([int(i) for i in np.nonzero(ks)[0]], 1.0, "REPLACE")
    md = ob.modifiers.new("fix", "SMOOTH"); md.vertex_group = "fix"; md.factor = 1.0; md.iterations = op.get("iter", 400)
    # the smoothed copy is read from the evaluated mesh; the mesh itself is left as it was
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg).data
    cs = np.empty(len(ev.vertices) * 3); ev.vertices.foreach_get("co", cs); cs = cs.reshape(-1, 3)
    ob.modifiers.remove(md); ob.vertex_groups.remove(vg)
    if "cap" in op:
      # a ridge (a lid's edge standing off the face like a fin) brought back to within `cap` of the smoothed surface;
      # whatever already lies within it is left as it is
      # only what stands out from the face: the hollows (the eye's own slit, the socket) are left as they are
      dv = co - cs; n = np.linalg.norm(dv, axis=1); hc = seed + np.array([0.0, op.get("back", 0.0), 0.0])
      out = (dv * (cs - hc)).sum(1) > 0
      f = np.where(out & (n > op["cap"]), op["cap"] / np.maximum(n, 1e-12), 1.0)
      f = 1 - (1 - f) * w; co = np.where(keep[:, None], cs + f[:, None] * dv, co)
    else:
      kk = 1 - (1 - op["k"]) * w
      co = np.where(keep[:, None], cs + kk[:, None] * (co - cs), co)
  elif op["op"] in ("smooth", "laplace"):
    # Blender's Laplacian Smooth modifier (an implicit solve, so a broad ring goes in a few steps; volume kept),
    # weighted by the falloff over the joined region
    me.vertices.foreach_set("co", co.ravel()); me.update()
    vg = ob.vertex_groups.new(name="fix"); idx = np.nonzero(keep)[0]
    for i in idx: vg.add([int(i)], float(w[i]), "REPLACE")
    if op["op"] == "smooth":   # the plain Smooth modifier, repeated (explicit; shrinks a little where weighted fully)
      md = ob.modifiers.new("fix", "SMOOTH"); md.vertex_group = "fix"; md.factor = op.get("factor", 1.0); md.iterations = op.get("iter", 100)
    else:
      md = ob.modifiers.new("fix", "LAPLACIANSMOOTH"); md.vertex_group = "fix"; md.iterations = op.get("iter", 10)
      md.lambda_factor = op.get("lambda", 2.0); md.lambda_border = 0; md.use_volume_preserve = True; md.use_normalized = True
    bpy.context.view_layer.objects.active = ob; ob.select_set(True); bpy.ops.object.modifier_apply(modifier="fix"); ob.vertex_groups.remove(ob.vertex_groups["fix"])
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
  elif op["op"] == "push":
    v = np.array(op["dir"], float); v /= np.linalg.norm(v); co += (op["d"] * w)[:, None] * v
  mv = np.linalg.norm(co - before, axis=1)
  log.append({"op": op["op"], "note": op.get("note", ""), "points": int(keep.sum()), "moved_max": round(float(mv.max()), 5), "moved_mean": round(float(mv[keep].mean()), 5)})
  print(json.dumps(log[-1]))
if DUMP: np.save(os.path.join(DUMP, "final.npy"), co.astype(np.float32))
me.vertices.foreach_set("co", co.ravel()); me.update(); me.validate()
# shade by the surface as it now is: drop the normals stored in the file (glTF import keeps them as custom split
# normals, which would carry an edited surface's old shading, or hide a ring the shape has), and smooth by angle
def fresh_normals(o):
  bpy.context.view_layer.objects.active = o; o.select_set(True)
  if o.data.has_custom_normals: bpy.ops.mesh.customdata_custom_splitnormals_clear()
  for f in o.data.polygons: f.use_smooth = True
fresh_normals(ob)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=False, export_normals=True, export_apply=True)
json.dump({"src": src, "ops": opsf, "dst": dst, "log": log}, open(dst + ".log.json", "w"), indent=1)
