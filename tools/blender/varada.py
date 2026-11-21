# Sakyamuni's right hand in the boon-granting gesture (与愿印), by grafting Sikhin's left hand mirrored (issue #514).
#
#   python3 tools/blender/varada.py <varada.json> <out dir> [--stage=hand|all]
#
# Step 1 (hand): the donor's hand is cut out of Sikhin's mesh below the plane `donor.cut` and inside the box `donor.keep`
# (min, max; it leaves out the robe beside and behind the hand and the sleeve above it),
# welded into one piece (the generated meshes are many unwelded shells; `donor.weld` metres),
# mirrored across x (a left hand becomes a right one; the faces are turned back out after the mirror), and set on
# Sakyamuni's wrist: its wrist-to-fingertips axis along target.wrist→target.fingertips, its palm toward target.palm,
# scaled to Sakyamuni's hand length times target.scale and turned target.turn_deg about its own axis (so the two figures
# do not show the same hand). Writes <out>/hand.glb (stage frame) and <out>/hand.json (where everything came from).
import bpy, bmesh, sys, os, json, math, hashlib
import numpy as np
from mathutils import Vector, Matrix
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
cfg = json.load(open(args[0])); out = args[1]; os.makedirs(out, exist_ok=True)
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
def load(path, H):
  """the file's one mesh, its points put in the stage frame (x, y up, z toward the viewer); returns the object and the
  file → stage transform (scale k, offset) so the result can be put back"""
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.import_scene.gltf(filepath=path)
  obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
  for o in bpy.context.scene.objects: o.select_set(o in obs)
  bpy.context.view_layer.objects.active = obs[0]
  if len(obs) > 1: bpy.ops.object.join()
  ob = bpy.context.view_layer.objects.active; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  co = np.empty(len(ob.data.vertices) * 3); ob.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
  mn, mx = co.min(0), co.max(0); k = H / (mx[2] - mn[2]); off = np.array([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]])
  st = (co - off) * k; st = np.c_[st[:, 0], st[:, 2], -st[:, 1]]          # Blender (x, y, z up) → stage (x, y up, z = -y)
  return ob, st, (k, off)
def to_blender(st): return np.c_[st[:, 0], -st[:, 2], st[:, 1]]
D, T = cfg["donor"], cfg["target"]
log = {"donor": {"file": D["file"], "sha256": sha(D["file"])}, "target": {"file": T["file"], "sha256": sha(T["file"])}}
if T.get("sha256") and log["target"]["sha256"] != T["sha256"]: sys.exit(f"target file is not the registered one: {log['target']['sha256']}")
# --- the donor's hand ---
ob, st, _ = load(D["file"], D["height"])
cp, cn = np.array(D["cut"]["point"]), np.array(D["cut"]["normal"], float); cn /= np.linalg.norm(cn)
# The generated mesh is many unwelded shells, and the hand is a few of them (palm, thumb, fingers) with the wrist on a
# shell that runs on up into the sleeve, and a patch of the palm on a shell of the robe: a shell lying mostly (`whole`)
# or partly (`part`) inside the box `keep` is taken, cut at the wrist and at the box; the robe and the knee, whose
# shells lie mostly outside the box, are left.
K = D["keep"]; lo, hi = np.array(K["min"]), np.array(K["max"]); inbox = np.all((st > lo) & (st < hi), axis=1); below = (st - cp) @ cn > 0
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
fv = np.empty(len(ob.data.polygons) * 3, dtype=np.int64); ob.data.polygons.foreach_get("vertices", fv); F = fv.reshape(-1, 3)
E = np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]; n = len(st)
_, lab = connected_components(coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(n, n)), directed=False)
frac = np.bincount(lab, weights=inbox, minlength=lab.max() + 1) / np.maximum(np.bincount(lab, minlength=lab.max() + 1), 1)
whole = frac >= K.get("whole", 0.8); part = (frac >= K.get("part", 0.4)) & ~whole
keep = (whole[lab] | part[lab]) & inbox & below
for lo2, hi2 in K.get("drop", []): keep &= ~np.all((st > lo2) & (st < hi2), axis=1)   # scraps of robe touching the hand (a box on the robe's shells alone took fingers with it: the shells do not follow the parts)   # every shell kept is still cut at the wrist and the box (a hand shell may run on into the sleeve)
log["donor"]["shells_whole"] = int(whole[np.unique(lab[inbox])].sum()); log["donor"]["shells_part"] = int(part[np.unique(lab[inbox])].sum())
me = ob.data; me.vertices.foreach_set("co", to_blender(st).ravel()); me.update()
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
gone = [f for f in bm.faces if not all(keep[v.index] for v in f.verts)]
bmesh.ops.delete(bm, geom=gone, context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.to_mesh(me); bm.free(); me.update()
log["donor"]["faces_cut"] = len(me.polygons)
# the generated mesh is many unwelded shells: weld points that coincide (within weld metres), so the hand is one piece
# where its shells met; a voxel remesh does not do here (it needs a closed volume, and these shells are open)
bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=D.get("weld", 0.002)); bm.to_mesh(me); bm.free(); me.update()
# keep the largest piece only (a stray bit of robe inside the sphere would make its own island)
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); seen = set(); best = []
for v in bm.verts:
  if v.index in seen: continue
  stack, comp = [v], []
  seen.add(v.index)
  while stack:
    u = stack.pop(); comp.append(u)
    for e in u.link_edges:
      w = e.other_vert(u)
      if w.index not in seen: seen.add(w.index); stack.append(w)
  if len(comp) > len(best): best = comp
bs = set(x.index for x in best); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in bs], context="VERTS")
bm.to_mesh(me); bm.free(); me.update()
if D.get("fill_holes"):
  # the donor's own small openings (the fingertips' ends are open on the generated shells and read black from below)
  # closed: every hole of at most `fill_holes` edges
  bm = bmesh.new(); bm.from_mesh(me); f0 = len(bm.faces); bmesh.ops.holes_fill(bm, edges=bm.edges, sides=D["fill_holes"])
  bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3]); log["donor"]["holes_filled_faces"] = len(bm.faces) - f0
  bm.to_mesh(me); bm.free(); me.update()
# a scrap of robe that shares a shell and a place with the fingers is a single open sheet, where a finger is a closed
# tube: a face whose inward line (against its normal) meets nothing of the hand within `donor.sheet` metres is dropped
if D.get("sheet"):
  from mathutils.bvhtree import BVHTree as _B
  bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); tree_h = _B.FromBMesh(bm); lone = []
  for f in bm.faces:
    c0 = f.calc_center_median(); nrm_ = f.normal
    # both ways along the normal (the generated shells' faces do not all face out): a tube is met one way or the other
    if tree_h.ray_cast(c0 - nrm_ * 1e-4, -nrm_, D["sheet"])[0] is None and tree_h.ray_cast(c0 + nrm_ * 1e-4, nrm_, D["sheet"])[0] is None: lone.append(f)
  bmesh.ops.delete(bm, geom=lone, context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
  bm.to_mesh(me); bm.free(); me.update(); log["donor"]["sheet_faces_dropped"] = len(lone)
for o in bpy.context.scene.objects: o.select_set(o == ob)
bpy.ops.export_scene.gltf(filepath=os.path.join(out, "hand-donor.glb"), export_format="GLB", use_selection=True)   # as cut, in Sikhin's own place
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); P = np.c_[co.reshape(-1, 3)[:, 0], co.reshape(-1, 3)[:, 2], -co.reshape(-1, 3)[:, 1]]
log["donor"]["welded_verts"] = len(P)
bm = bmesh.new(); bm.from_mesh(me); log["donor"]["open_edges"] = sum(1 for e in bm.edges if e.is_boundary); log["donor"]["nonmanifold_edges"] = sum(1 for e in bm.edges if not e.is_manifold and not e.is_boundary); bm.free()
if D.get("scrap"):
  # the scrap of Sikhin's knee robe that came with the fingertips (round 2: "删掉中指尖那块衣角"): in the hand's own frame
  # (u along it from the wrist's cut to the middle fingertip, v across, w out of the palm) it is a fan on the palm side
  # and one past the little finger's edge; each box `scrap` is [[u0, u1], [v0, v1], [w0, w1]] and its faces are taken out
  wr_ = P[(P - cp) @ cn < np.percentile((P - cp) @ cn, 3)].mean(0); far_ = P[np.argmax((P - cp) @ cn)]; ax_ = (far_ - wr_) / np.linalg.norm(far_ - wr_)
  _, _, vt_ = np.linalg.svd(P - P.mean(0), full_matrices=False); n_ = vt_[2] - (vt_[2] @ ax_) * ax_; n_ /= np.linalg.norm(n_); n_ = n_ if n_[2] > 0 else -n_
  L_ = np.linalg.norm(far_ - wr_); uu = (P - wr_) @ ax_ / L_; vv = (P - wr_) @ np.cross(ax_, n_); ww = (P - wr_) @ n_
  inscrap = np.zeros(len(P), bool)
  for (u0_, u1_), (v0_, v1_), (w0_, w1_) in D["scrap"]: inscrap |= (uu > u0_) & (uu < u1_) & (vv > v0_) & (vv < v1_) & (ww > w0_) & (ww < w1_)
  cutP0 = P[inscrap].copy()   # where the cut went, for the smoothing below
  bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
  bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(inscrap[v.index] for v in f.verts)], context="FACES")
  bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS"); bm.to_mesh(me); bm.free(); me.update()
  co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); P = np.c_[co.reshape(-1, 3)[:, 0], co.reshape(-1, 3)[:, 2], -co.reshape(-1, 3)[:, 1]]
  log["donor"]["scrap_points"] = int(inscrap.sum())
  if D.get("fill_holes"):   # what the cut opened in the fingers' own surface closed again
    bm = bmesh.new(); bm.from_mesh(me); f0 = len(bm.faces); bmesh.ops.holes_fill(bm, edges=bm.edges, sides=D["fill_holes"])
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3]); log["donor"]["holes_filled_after_scrap"] = len(bm.faces) - f0
    if D.get("scrap_smooth"):
      # (the cut runs through the faces as they lay, so it leaves a saw-toothed edge along the little finger, read as a
      # ragged line where the hand meets the knee (the 3D review's third point); the points within `r` metres of what was
      # cut are smoothed a few times, the points split along the texture's seams welded first so the surface holds together)
      SS = D["scrap_smooth"]; bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6); bm.verts.ensure_lookup_table()
      from scipy.spatial import cKDTree as _KD
      Pc = np.array([[v.co.x, v.co.z, -v.co.y] for v in bm.verts]); cutp = cutP0
      near_c = _KD(cutp).query(Pc, k=1)[0] < SS.get("r", 0.02) if len(cutp) else np.zeros(len(Pc), bool)
      vs_ = [bm.verts[i] for i in np.nonzero(near_c)[0]]
      for _ in range(SS.get("iterations", 6)): bmesh.ops.smooth_vert(bm, verts=vs_, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
      log["donor"]["scrap_smoothed_points"] = len(vs_)
    bm.to_mesh(me); bm.free(); me.update()
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); P = np.c_[co.reshape(-1, 3)[:, 0], co.reshape(-1, 3)[:, 2], -co.reshape(-1, 3)[:, 1]]
# the donor hand's own frame: the wrist is the middle of what lies nearest the cut; the long axis runs from it to
# the point farthest past the cut (the middle finger's tip); the palm's normal is the thinnest direction, turned toward +z
wr = P[(P - cp) @ cn < np.percentile((P - cp) @ cn, 3)].mean(0)   # the wrist: the middle of the 3% of points nearest the cut
far = P[np.argmax((P - cp) @ cn)]   # the fingertip: the point farthest past the cut (the middle finger's tip, the hand hanging)
ax = (far - wr) / np.linalg.norm(far - wr); c = P.mean(0); _, _, vt = np.linalg.svd(P - c, full_matrices=False)
nrm = vt[2] - (vt[2] @ ax) * ax; nrm /= np.linalg.norm(nrm)
if nrm[2] < 0: nrm = -nrm
log["donor"].update({"wrist": wr.round(3).tolist(), "tip": far.round(3).tolist(), "length_m": round(float(np.linalg.norm(far - wr)), 3), "palm_normal": nrm.round(3).tolist()})
# mirror: x → -x (a left hand into a right one); the frame mirrors with it
M = np.diag([-1.0, 1, 1]); P = P @ M; wr, far, ax, nrm = wr @ M, far @ M, ax @ M, nrm @ M
# the target frame on Sakyamuni
tw, tf = np.array(T["wrist"]), np.array(T["fingertips"]); tax = (tf - tw) / np.linalg.norm(tf - tw)
tn = np.array(T["palm"], float); tn = tn - (tn @ tax) * tax; tn /= np.linalg.norm(tn)
def frame(a, n): return np.c_[a, n, np.cross(a, n)]
R = frame(tax, tn) @ frame(ax, nrm).T
th = math.radians(T.get("turn_deg", 0)); ca, sa = math.cos(th), math.sin(th); a = tax
Rt = np.array([[ca + a[0]**2*(1-ca), a[0]*a[1]*(1-ca) - a[2]*sa, a[0]*a[2]*(1-ca) + a[1]*sa],
               [a[1]*a[0]*(1-ca) + a[2]*sa, ca + a[1]**2*(1-ca), a[1]*a[2]*(1-ca) - a[0]*sa],
               [a[2]*a[0]*(1-ca) - a[1]*sa, a[2]*a[1]*(1-ca) + a[0]*sa, ca + a[2]**2*(1-ca)]])
sc = np.linalg.norm(tf - tw) / np.linalg.norm(far - wr) * T.get("scale", 1.0)
Q = ((P - wr) * sc) @ R.T @ Rt.T + tw - tax * T.get("overlap", 0) + np.array([0, T.get("lift", 0), 0])
PO = T.get("pose")
if PO:
  # Round 2 (the art director and the 3D review; the T05 lead's ruling of 2026-11-21): the hand bent and laid with its
  # back on the knee. Along the hand (u, 0 at the wrist's cut, 1 at the middle fingertip) the first `u0` is left
  # straight and the fingers bend toward the palm by `bend_deg`, reached by `u1` on a smooth step, the bend laid on
  # the hand's middle line so its length is kept; the hand is then stood at `wrist`, its straight part pointing down
  # and tipped forward by `pitch_deg` (the palm's normal raised as much), turned `turn_deg` about it, at `scale`.
  P0, wr0, ax0, n0 = P @ M, wr @ M, ax @ M, nrm @ M   # the donor's own (left-hand) frame; the mirror is the lateral sign below
  L0 = float(np.linalg.norm(far - wr)); lat0 = np.cross(ax0, n0)
  u = (P0 - wr0) @ ax0 / L0; v = (P0 - wr0) @ lat0; w = (P0 - wr0) @ n0
  sc = PO.get("scale", T.get("scale", 0.97)); u0, u1, bd = PO.get("u0", 0.4), PO.get("u1", 0.6), math.radians(PO["bend_deg"])
  stp = lambda x: np.clip((x - u0) / (u1 - u0), 0, 1) ** 2 * (3 - 2 * np.clip((x - u0) / (u1 - u0), 0, 1))
  def bendgeo(bd):
    grid = np.linspace(0, 1.05, 400); tg = bd * stp(grid); ds = np.diff(grid, prepend=0) * L0 * sc
    cx_, cz_ = np.cumsum(np.cos(tg) * ds), np.cumsum(np.sin(tg) * ds); th_ = bd * stp(u)
    return np.interp(u, grid, cx_) - w * sc * np.sin(th_), np.interp(u, grid, cz_) + w * sc * np.cos(th_)
  du, dn = bendgeo(bd)
  a_ = math.radians(PO["pitch_deg"]); D = np.array([0, -math.cos(a_), math.sin(a_)]); N = np.array([0, math.sin(a_), math.cos(a_)])
  t_ = math.radians(PO.get("turn_deg", 5)); N = math.cos(t_) * N + math.sin(t_) * np.cross(D, N); X = np.cross(D, N)
  TP = T.get("taper")
  CU = PO.get("curl")
  def curl(du_, dn_):
    # variant B (the art director, 2026-11-21): the fingers' middle joints bent toward the palm, `curl.deg` across
    # the hand rising to `curl.little_deg` on the little finger's side, about the line across the fingers at `curl.u`
    # of the hand's length, eased in over `curl.ease`
    if not CU: return du_, dn_
    piv = np.abs(u - CU["u"]) < 0.01; pu, pn = du_[piv].mean(), dn_[piv].mean()
    side = np.clip(v / CU.get("v_little", 0.2), 0, 1)
    k_ = np.clip((u - CU["u"]) / CU.get("ease", 0.06), 0, 1); k_ = k_ * k_ * (3 - 2 * k_)
    ph_ = np.radians(CU["deg"] + (CU["little_deg"] - CU["deg"]) * side) * k_
    c_, s_ = np.cos(ph_), np.sin(ph_); a_, b_ = du_ - pu, dn_ - pn
    return pu + c_ * a_ - s_ * b_, pn + s_ * a_ + c_ * b_
  def place(W, geo=None):
    du_, dn_ = geo if geo is not None else (du, dn); du_, dn_ = curl(du_, dn_)
    Q = W + np.outer(du_, D) + np.outer(dn_, N) + np.outer(-v * sc, X)
    RD = PO.get("round")
    if RD:   # the wrist's section rounded (the 3D review: long / short ≤ 1.25 so the turned hand meets the forearm unseen):
      # over its last `round.length` metres its width across (X) is drawn in toward `round.ratio` times its thickness
      s_ = (Q - W) @ D; k_ = 1 - np.clip(s_ / RD["length"], 0, 1); k_ = k_ * k_ * (3 - 2 * k_)
      sec = (Q - W) - np.outer(s_, D); xw = sec @ X; nw = sec @ N; band_ = s_ < RD["length"]
      wid = np.percentile(xw[band_], 98) - np.percentile(xw[band_], 2); thk = np.percentile(nw[band_], 98) - np.percentile(nw[band_], 2)
      f_ = min(1.0, RD["ratio"] * thk / max(wid, 1e-6)); xm = np.median(xw[band_])
      Q = Q + np.outer((xw - xm) * (f_ - 1) * k_, X)
      log.setdefault("pose", {})["round"] = {"width_m": round(float(wid), 3), "thickness_m": round(float(thk), 3), "ratio_before": round(float(wid / thk), 3), "factor": round(float(f_), 3)}
    if TP:   # the wrist's last `taper.length` metres drawn in toward the hand's axis (see below)
      s_ = (Q - W) @ D; k_ = np.clip(s_ / TP["length"], 0, 1); f_ = TP["to"] + (1 - TP["to"]) * k_ * k_ * (3 - 2 * k_)
      axial = W + np.outer(s_, D); Q = axial + (Q - axial) * f_[:, None]
    return Q
  W = np.array(PO["wrist"], float); Q = place(W)
  tw, tax, tn = W, D, N; T = dict(T); T["overlap"] = 0; T.pop("taper", None)
  log.setdefault("pose", {}).update({"wrist": W.tolist(), "pitch_deg": PO["pitch_deg"], "bend_deg": PO["bend_deg"], "u0": u0, "u1": u1, "turn_deg": PO.get("turn_deg", 5), "scale": sc,
                 "palm_bend_deg": 0.0, "finger_length_change": "none (the bend is laid along the middle line)"})
# the wrist's open edge stood out of the forearm as a broken ring (the 3D review, round 2): the hand's last
# `taper.length` metres toward the wrist are drawn in toward the hand's own axis, to `taper.to` of their width at the
# very end, so the whole ring sinks under the forearm's surface
if T.get("taper"):
  tl, tt = T["taper"]["length"], T["taper"]["to"]; base = tw - tax * T.get("overlap", 0)
  s_ = (Q - base) @ tax; k_ = np.clip(s_ / tl, 0, 1); f_ = tt + (1 - tt) * k_ * k_ * (3 - 2 * k_)
  axial = base + np.outer(s_, tax); Q = axial + (Q - axial) * f_[:, None]
  log["taper"] = {"length_m": tl, "to": tt, "points": int((s_ < tl).sum())}
me.vertices.foreach_set("co", to_blender(Q).ravel()); me.update()
bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()   # the mirror turned the faces inside out
log["placed"] = {"scale": round(float(sc), 4), "turn_deg": T.get("turn_deg", 0), "wrist": tw.tolist(), "axis": tax.round(3).tolist(), "palm": tn.round(3).tolist()}
for o in bpy.context.scene.objects: o.select_set(o == ob)
bpy.ops.export_scene.gltf(filepath=os.path.join(out, "hand.glb"), export_format="GLB", use_selection=True)
json.dump(log, open(os.path.join(out, "hand.json"), "w"), indent=1); print(json.dumps(log))
if opt.get("stage", "all") == "hand": sys.exit(0)
# --- step 2: Sakyamuni's own knee where the old hand lay, and the new hand joined on ---
# The old hand is fused into the knee (there is no knee surface under it): each point of it, inside the box `knee.box`,
# is moved onto Sakyamuni's own left knee mirrored across x (the same robe, the same folds: the 3D review's third risk),
# fully inside and less toward the box's edges (`knee.ease` metres), so the mesh stays one piece with nothing to stitch.
# Then the new hand is joined to the figure, its wrist sunk `target.overlap` metres into the forearm.
hand_co = Q.copy(); hand_faces = np.array([list(p.vertices) for p in me.polygons])
ob, st, (k, off) = load(T["file"], T["height"])
Kn = cfg["knee"]; blo, bhi = np.array(Kn["box"][0]), np.array(Kn["box"][1])
inb = np.all((st > blo) & (st < bhi), axis=1)
if Kn.get("mode") == "surface":
  # Round 2 (the 3D review: the patch's seam was a hard edge with debris). The right knee is not the left one mirrored
  # (the legs are crossed, the right on top: over most of the knee the two lie 5 cm or more apart), so a patch cut
  # from the left never meets the right without a seam. Instead the old hand is pressed into the knee it lies on, and
  # the mesh stays one piece: over the hand's place (the box seen from the front, x and y), the knee's front is
  # taken as the left knee's mirrored front, corrected by a smooth surface so that it meets the right knee's own front
  # round the box's sides and foot; every point of the figure standing in front of it there is laid back onto it,
  # fully `ease` metres inside the box's outline and less toward it. The hand's faces that faced away from the viewer
  # (its sides, its palm on the knee) are taken out, and the pressed sheet is relaxed on the surface.
  from scipy.interpolate import RBFInterpolator
  # The knee is described as a surface over a sheet: by default its depth (z) over the front (x, y); with
  # `knee.cylinder` its distance from an upright line through the knee (x, z) over the angle round that line (as arc
  # length at `r0`) and the height, which follows the knee round to its outer side where the old fingers lay
  sblo, sbhi = blo.copy(), bhi.copy(); cyl = Kn.get("cylinder")
  if cyl:
    xc, zc, r0 = cyl["x"], cyl["z"], cyl["r0"]
    fwd = lambda P: np.c_[r0 * np.arctan2(P[:, 0] - xc, P[:, 2] - zc), P[:, 1], np.hypot(P[:, 0] - xc, P[:, 2] - zc)]
    inv = lambda C: np.c_[xc + C[:, 2] * np.sin(C[:, 0] / r0), C[:, 1], zc + C[:, 2] * np.cos(C[:, 0] / r0)]
    blo = np.array([r0 * math.radians(cyl["deg"][0]), blo[1], 0.0]); bhi = np.array([r0 * math.radians(cyl["deg"][1]), bhi[1], 9.0])
  else:
    fwd = inv = lambda P: P
  stS = st; st = fwd(stS)
  cell = Kn.get("cell", 0.02)
  def front(P, sel):
    ij = np.floor(P[sel][:, :2] / cell).astype(int); z = P[sel][:, 2]; dct = {}
    for (a, b), zz in zip(map(tuple, ij), z):
      if zz > dct.get((a, b), -9): dct[(a, b)] = zz
    return dct
  pad = 0.25; lo2, hi2 = blo[:2] - pad, bhi[:2] + pad
  mirp = fwd(stS * [-1, 1, 1]); near2 = lambda P: np.all((P[:, :2] > lo2) & (P[:, :2] < hi2), axis=1) & (P[:, 2] > Kn.get("zmin", 0.8))
  Bm = front(mirp, near2(mirp)); Dm = front(st, near2(st))
  # the correction is fitted on a ring of cells just outside the box's sides and foot (not its head, where the forearm lies)
  ring = []
  for (a, b), z in Dm.items():
    c = (np.array([a, b]) + 0.5) * cell; dx = max(blo[0] - c[0], c[0] - bhi[0]); dy = blo[1] - c[1]
    if c[1] > bhi[1] - Kn.get("head", 0.35): continue
    out_ = max(dx, dy)
    if 0.02 < out_ < Kn.get("ringW", 0.12) and ((a, b) in Bm or not Kn.get("useLeft", False)): ring.append((c[0], c[1], z - Bm.get((a, b), 0.0)))
  ring = np.array(ring)
  # one smooth surface (a thin-plate spline with smoothing `smooth`) through the right knee's own front round the box
  # and the left knee's mirrored front inside it (cells of `cell` metres, the foremost point of each)
  # (round 2, third try) the left knee mirrored lies about 0.2 m behind the right one (the right leg is on top and
  # forward) and has gaps near the box's head, so it is no guide: the surface is the thin-plate spline through the
  # right knee's own front round the box's sides and foot alone, and never stands in front of the figure's front as
  # it was (the old hand lay on the knee, so the knee was behind it)
  fitp = None
  if not Kn.get("useLeft", False):
    fitp = np.array([(x, y, Dm[(int(np.floor(x / cell)), int(np.floor(y / cell)))]) for x, y, z in ring])
  else:
    inner = [((a + 0.5) * cell, (b + 0.5) * cell, z) for (a, b), z in Bm.items() if blo[0] < (a + 0.5) * cell < bhi[0] and blo[1] < (b + 0.5) * cell < bhi[1]]
    fitp = np.r_[np.array([(x, y, z + Bm[(int(np.floor(x / cell)), int(np.floor(y / cell)))]) for x, y, z in ring]), np.array(inner)]
  # a low-order shape first (a polynomial of degree `poly` in the two sheet coordinates, least squares), so the surface
  # cannot run away where the ring says nothing (the box's head), then the spline on what it leaves, smoothed hard
  dg = Kn.get("poly", 2)
  def pbasis(xy): return np.stack([xy[:, 0] ** i * xy[:, 1] ** j for i in range(dg + 1) for j in range(dg + 1 - i)], 1)
  pc = np.linalg.lstsq(pbasis(fitp[:, :2]), fitp[:, 2], rcond=None)[0]
  res_ = fitp[:, 2] - pbasis(fitp[:, :2]) @ pc
  surf = RBFInterpolator(fitp[:, :2], res_, kernel="thin_plate_spline", smoothing=Kn.get("smooth", 5.0), neighbors=Kn.get("neighbors", 200))
  Ssurf = lambda xy: pbasis(np.atleast_2d(xy)) @ pc + surf(np.atleast_2d(xy))
  # every face of the figure whose middle lies over the box (seen from the front) and in front of the knee's surface
  # (or within `behind` metres of it) is taken out: the old hand and the torn robe under it
  me = ob.data; me.vertices.foreach_set("co", to_blender(stS).ravel()); me.update()   # the mesh into the stage frame first
  bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
  F0 = np.array([[v.index for v in f.verts] for f in bm.faces]); fc0 = fwd(stS[F0].mean(1))
  din_f = np.minimum((fc0[:, :2] - blo[:2]).min(1), (bhi[:2] - fc0[:, :2]).min(1)); cand = np.nonzero(din_f > 0)[0]
  # the sheet's nodes, and where it may lie: where the surface faces the viewer (its slope under `slope`) and the figure
  # has a front there; old faces go only where the sheet lies `skirt` metres or more inside its own edge
  from scipy.ndimage import distance_transform_edt
  sk, tk, gs = Kn.get("skirt", 0.04), Kn.get("tuck", 0.005), Kn.get("grid", 0.015)
  xs = np.arange(blo[0] - sk, bhi[0] + sk + 1e-9, gs); ys = np.arange(blo[1] - sk, bhi[1] + sk + 1e-9, gs)
  GX, GY = np.meshgrid(xs, ys); GZ = Ssurf(np.c_[GX.ravel(), GY.ravel()]).reshape(GX.shape)
  Dn = np.array([[Dm.get((int(np.floor(x / cell)), int(np.floor(y / cell))), np.nan) for x in xs] for y in ys])
  if Kn.get("clamp", False): GZ = np.where(np.isfinite(Dn), np.minimum(GZ, Dn), GZ)
  if Kn.get("blur"):
    # (round 2, fourth try) round the old hand there is only the knee's outer side and the lap, both far behind its
    # front, so nothing round it says where the knee's front is; the old hand itself does: it lay on the knee. The
    # surface is the figure's front as it was, blurred (a Gaussian of `blur` metres) so the fingers run together into
    # one swell, set back `inset` metres (about the hand's thickness) inside the box, the setting back eased in over
    # `ease` metres from the box's outline so the sheet meets the figure as it is
    from scipy.ndimage import gaussian_filter, distance_transform_edt as _edt
    fin = np.isfinite(Dn); idxn = _edt(~fin, return_distances=False, return_indices=True); Df = Dn[tuple(idxn)]
    GB = gaussian_filter(Df, Kn["blur"] / gs, mode="nearest")
    # not at the box's head: there the figure's front is the old wrist (carried with the arm and cut), not the knee
    # (the inner side, toward the lap, may take a wider easing, `easeInner`: there the knee meets the robe's own folds
    # beside the little finger, and a short easing left a step seen from the figure's left; the 3D review's choice (b))
    e0, e1 = Kn.get("ease", 0.12), Kn.get("easeInner", Kn.get("ease", 0.12))
    dd = np.minimum(np.minimum((GX - blo[0]) / e0, (bhi[0] - GX) / e1), (GY - blo[1]) / e0); wv = np.clip(dd, 0, 1); wv = wv * wv * (3 - 2 * wv)
    De = gaussian_filter(Df, Kn.get("edgeBlur", 0.025) / gs, mode="nearest")   # the figure's front at the outline, its cell noise smoothed a little
    if Kn.get("innerToOutside"):
      # (at the inner side the figure's front at the outline is still the old hand, which stood proud of the robe beside
      # it: eased to that, the knee ended in a ridge over the lap's robe, read as a step from the figure's left. There it
      # is eased instead to the robe just outside the box, the front of the sheet's last column, row by row)
      jo = int(np.argmin(np.abs(xs - (bhi[0] + Kn.get("innerOut", sk)))))   # (read just past the edge: the robe is no cylinder)
      Dout = De[:, jo:jo + 1].copy()
      if Kn.get("innerRay"):
        # (the robe's own distance from the knee's line just past the edge, found by a ray toward that line for each row,
        # not the foremost point of a cell, which on the sloping robe stood 1-2 cm before it)
        from mathutils.bvhtree import BVHTree
        tree = BVHTree.FromPolygons([tuple(p) for p in stS], [tuple(f) for f in F0])
        ang = (bhi[0] + Kn.get("innerOut", sk)) / r0; out_ = np.array([math.sin(ang), 0.0, math.cos(ang)]); hits = 0
        for j_, yy in enumerate(ys):
          o_ = np.array([xc, yy, zc]) + 2.5 * out_; hit = tree.ray_cast(Vector(o_), Vector(-out_), 2.5)
          if hit[0] is not None: Dout[j_, 0] = 2.5 - hit[3]; hits += 1
        log["knee_inner_ray_rows"] = [hits, len(ys)]
      a_ = np.clip((GX - (bhi[0] - e1)) / e1, 0, 1); a_ = a_ * a_ * (3 - 2 * a_)
      De = (1 - a_) * De + a_ * Dout
      if Kn.get("outerRay"):
        # (the knee's outer side the same way: there too the figure's front at the edge was the old fingers, and seen
        # from the figure's right the sheet's edge stood out of the robe as a fin down to the lotus)
        ang = (blo[0] - Kn.get("innerOut", sk)) / r0; out_ = np.array([math.sin(ang), 0.0, math.cos(ang)]); Dlo = np.full((len(ys), 1), np.nan); hits = 0
        for j_, yy in enumerate(ys):
          o_ = np.array([xc, yy, zc]) + 2.5 * out_; hit = tree.ray_cast(Vector(o_), Vector(-out_), 2.5)
          if hit[0] is not None: Dlo[j_, 0] = 2.5 - hit[3]; hits += 1
        jl = int(np.argmin(np.abs(xs - (blo[0] - Kn.get("innerOut", sk))))); Dlo = np.where(np.isfinite(Dlo), Dlo, De[:, jl:jl + 1])
        b_ = np.clip(((blo[0] + e0) - GX) / e0, 0, 1); b_ = b_ * b_ * (3 - 2 * b_)
        De = (1 - b_) * De + b_ * Dlo; log["knee_outer_ray_rows"] = [hits, len(ys)]
    insetF = Kn.get("inset", 0.12)
    if Kn.get("insetMask"):
      # (the setting back is for where the old hand lay on the knee, not for the bare knee round it: set back everywhere,
      # the knee's outer side was dug 0.28 m in, read from the figure's right as a fin down to the lotus. The hand is found
      # as what stands proud of the knee: a wide blur of the front with the hand's cells replaced by it, three times over)
      IM = Kn["insetMask"]; Kk = gaussian_filter(Df, IM.get("blur", 0.3) / gs, mode="nearest")
      for _ in range(3):
        Mh = Df > Kk + IM.get("thr", 0.06); Kk = gaussian_filter(np.where(Mh, Kk, Df), IM.get("blur", 0.3) / gs, mode="nearest")
      wm = np.clip(gaussian_filter(Mh.astype(float), IM.get("soft", 0.05) / gs) * 2, 0, 1)
      insetF = insetF * wm; log["knee_inset_mask_cells"] = int(Mh.sum())
    GZ = (1 - wv) * De + wv * (GB - insetF)   # the figure's own front at the outline, the blurred knee inside
  gy_, gx_ = np.gradient(GZ, gs); okS = np.hypot(gx_, gy_) < Kn.get("slope", 1.2)
  dkeys = set(Dm.keys()); hasF = np.array([[(int(np.floor(x / cell)), int(np.floor(y / cell))) in dkeys for x in xs] for y in ys])
  inbox_ = (GX > blo[0]) & (GX < bhi[0]) & (GY > blo[1]) & (GY < bhi[1])
  lay = okS & hasF if not Kn.get("blur") else okS.copy()   # with the blurred front every node has a value (gaps filled from the nearest)
  from scipy.ndimage import binary_opening, binary_closing, label as _lab
  lay = binary_closing(lay, iterations=2) if Kn.get("blur") else binary_opening(lay, iterations=2); lab_, nl_ = _lab(lay)
  if nl_ > 1: sizes = np.bincount(lab_.ravel()); sizes[0] = 0; lay = lab_ == sizes.argmax()
  core = lay & inbox_ & (distance_transform_edt(lay) * gs > sk)
  dcore = distance_transform_edt(~core) * gs; tt_ = np.clip(dcore / sk, 0, 1); GZ = GZ - tk * tt_ * tt_ * (3 - 2 * tt_)
  if Kn.get("innerTuck"):
    # (on the inner side the sheet's border goes `innerTuck` metres under the robe beside it, which then lies over it, so
    # the two meet in a crease and no edge of the sheet stands before the robe: the 3D review's step)
    ai = np.clip((GX - (bhi[0] - 0.05)) / 0.05, 0, 1); ai = ai * ai * (3 - 2 * ai)
    GZ = GZ - Kn["innerTuck"] * ai * tt_ * tt_ * (3 - 2 * tt_)
  lay &= dcore <= sk
  if Kn.get("skirtUnder") and cyl:
    # (the sheet's border past the box is meant to lie under the figure's own surface; it followed the sheet's shape
    # and in places came out through the robe beside the box, a step of 1-2 cm. Each of its nodes outside the box is put
    # at least `skirtUnder` metres under the robe there, found by a ray toward the knee's line)
    from mathutils.bvhtree import BVHTree
    tree_s = BVHTree.FromPolygons([tuple(p) for p in stS], [tuple(f) for f in F0]); nsk = 0
    for j_, i_ in zip(*np.nonzero(lay & ~inbox_)):
      ang = xs[i_] / r0; o_ = np.array([xc + 2.5 * math.sin(ang), ys[j_], zc + 2.5 * math.cos(ang)]); d_ = -np.array([math.sin(ang), 0.0, math.cos(ang)])
      hit = tree_s.ray_cast(Vector(o_), Vector(d_), 2.5)
      if hit[0] is not None and GZ[j_, i_] > 2.5 - hit[3] - Kn["skirtUnder"]: GZ[j_, i_] = 2.5 - hit[3] - Kn["skirtUnder"]; nsk += 1
    log["knee_skirt_pushed_under"] = nsk
  ci = np.clip(np.round((fc0[cand, 0] - xs[0]) / gs).astype(int), 0, len(xs) - 1); cj = np.clip(np.round((fc0[cand, 1] - ys[0]) / gs).astype(int), 0, len(ys) - 1)
  incore = core[cj, ci]; inlay = lay[cj, ci]
  # inside the core everything in front of the knee goes; in the band where the sheet's edge is sunk under the figure's
  # own surface, only what stands in front of the sheet (it would show as a patch over it)
  gone_f = cand[(incore & (fc0[cand, 2] > GZ[cj, ci] - Kn.get("behind", 0.08))) | (inlay & ~incore & (fc0[cand, 2] > GZ[cj, ci] + Kn.get("front", 0.003)))]
  bmesh.ops.delete(bm, geom=[bm.faces[i] for i in gone_f], context="FACES")
  bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
  # scraps left round the box (pieces of fewer than `island` faces within `skirt` of it) go too
  bm.faces.ensure_lookup_table(); seen = set(); small = []
  for f in bm.faces:
    if f.index in seen: continue
    comp, stack = [], [f]; seen.add(f.index)
    while stack:
      g = stack.pop(); comp.append(g)
      for e in g.edges:
        for h in e.link_faces:
          if h.index not in seen: seen.add(h.index); stack.append(h)
    if len(comp) < Kn.get("island", 50):
      cc = np.mean([[v.co.x, v.co.z] for g in comp for v in g.verts], axis=0)
      if np.all((cc > sblo[:2] - 0.15) & (cc < sbhi[:2] + 0.15)): small += comp
  bmesh.ops.delete(bm, geom=list(set(small)), context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
  # the knee's front laid in as a regular sheet over the box and `skirt` metres past it, its border sunk `tuck` metres
  # behind the surface so the figure's own faces round the box lie over it and no edge shows
  nx = len(xs); gv = {}
  def node(j, i):
    if (j, i) not in gv: gv[(j, i)] = bm.verts.new(Vector(to_blender(inv(np.array([[xs[i], ys[j], GZ[j, i]]])))[0]))
    return gv[(j, i)]
  nf = 0
  for j in range(len(ys) - 1):
    for i in range(nx - 1):
      if lay[j, i] and lay[j, i + 1] and lay[j + 1, i + 1]: bm.faces.new([node(j, i), node(j, i + 1), node(j + 1, i + 1)]); nf += 1
      if lay[j, i] and lay[j + 1, i + 1] and lay[j + 1, i]: bm.faces.new([node(j, i), node(j + 1, i + 1), node(j + 1, i)]); nf += 1
  bm.normal_update(); bm.to_mesh(me); bm.free(); me.update()
  co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); st = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
  log["knee"] = {"mode": "surface", "box": Kn["box"], "ring_cells": int(len(ring)), "faces_taken_out": int(len(gone_f)), "scrap_faces_taken_out": len(set(small)),
                 "sheet_faces": nf, "sheet_spacing_m": gs, "skirt_m": sk, "tuck_m": tk,
                 "sheet_area_m2": round(float(lay.sum() * gs * gs), 3), "replaced_area_m2": round(float(core.sum() * gs * gs), 3),
                 "from": "Sakyamuni's own left knee mirrored across x, corrected (thin-plate spline) to meet the right knee round the box's sides and foot",
                 "cylinder": cyl}
  blo, bhi = sblo, sbhi
  if opt.get("stage") == "knee":   # the knee alone, in the stage frame, with the sheet's grid for looking at
    for o in bpy.context.scene.objects: o.select_set(o == ob)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, "knee.glb"), export_format="GLB", use_selection=True)
    np.savez(os.path.join(out, "knee-grid.npz"), xs=xs, ys=ys, GZ=GZ, lay=lay, core=core, okS=okS, hasF=hasF, Dn=Dn, ring=ring, r0=(cyl or {}).get("r0", 1.0))
    json.dump(log, open(os.path.join(out, "varada.json"), "w"), indent=1); sys.exit(0)
  inb = np.zeros(len(st), bool); Kn = dict(Kn); Kn["relax"] = 0; Kn["weld"] = 0; Kn["skip"] = True
if not Kn.get("skip"):   # round 1's mirrored patch (knee.mode absent)
  # how far inside the box each point is (to its nearest face), eased to a weight
  dist_in = np.minimum((st - blo).min(1), (bhi - st).min(1)); wgt = np.clip(dist_in / Kn["ease"], 0, 1) * inb
  # the mirror of the left knee: the figure's points in the mirrored box, their faces, as a BVH to find the nearest point
  from mathutils.bvhtree import BVHTree
  mlo, mhi = blo * [-1, 1, 1], bhi * [-1, 1, 1]; mlo, mhi = np.minimum(mlo, mhi) - [Kn["margin"], 0, 0], np.maximum(mlo, mhi) + [Kn["margin"], 0, 0]
  fv = np.empty(len(ob.data.polygons) * 3, dtype=np.int64); ob.data.polygons.foreach_get("vertices", fv); F = fv.reshape(-1, 3)
  inm = np.all((st > mlo - Kn["margin"]) & (st < mhi + Kn["margin"]), axis=1); fm = F[np.all(inm[F], axis=1)]
  mir = st * [-1, 1, 1]
  tree = BVHTree.FromPolygons([Vector(p) for p in mir], [tuple(f[::-1]) for f in fm])   # the mirror turns the faces round
  idx = np.nonzero(wgt > 0)[0]; moved = 0; far_ = 0.0
  for i in idx:
    hit = tree.find_nearest(Vector(st[i]))
    if hit[0] is None: continue
    tgt = np.array(hit[0]); d = tgt - st[i]; st[i] = st[i] + wgt[i] * d; moved += 1; far_ = max(far_, float(np.linalg.norm(d)))
  log["knee"] = {"box": Kn["box"], "ease": Kn["ease"], "points_in_box": int(inb.sum()), "points_moved": moved, "largest_move_m": round(far_, 3),
                 "from": "Sakyamuni's own left knee, mirrored across x"}
  # the old hand's sides and back, laid onto the knee, leave folded slivers: relax them in place (Blender's Smooth,
  # weighted by the same easing, `knee.relax` passes), then lay them back onto the mirrored knee
  me = ob.data; me.vertices.foreach_set("co", to_blender(st).ravel()); me.update()
  if Kn.get("relax"):
    vg = ob.vertex_groups.new(name="knee")
    for i in idx: vg.add([int(i)], float(wgt[i]), "REPLACE")
    md = ob.modifiers.new("relax", "SMOOTH"); md.vertex_group = "knee"; md.factor = 1.0; md.iterations = Kn["relax"]
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier="relax"); ob.vertex_groups.remove(ob.vertex_groups["knee"])
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); st = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
    for i in idx:
      hit = tree.find_nearest(Vector(st[i]))
      if hit[0] is not None: st[i] = st[i] + wgt[i] * (np.array(hit[0]) - st[i])
    log["knee"]["relaxed"] = Kn["relax"]
  # where the old hand lay fully inside the box (weight 1), its faces are taken out and the mirrored left knee's own
  # faces put in their place (laid onto it, the hand's sides and back folded over and showed inside out); the band at the
  # box's edge keeps the figure's own points, laid onto the same surface, so the two meet on it
  full = wgt >= 0.999
  bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
  for i, v in enumerate(bm.verts): v.co = Vector(to_blender(st[i][None])[0])
  dead = [f for f in bm.faces if all(full[v.index] for v in f.verts)]
  bmesh.ops.delete(bm, geom=dead, context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
  mdist = np.minimum((mir - blo).min(1), (bhi - mir).min(1)); takem = np.all((mir > blo) & (mir < bhi), axis=1) & (mdist > Kn["ease"] * 0.8)
  fpatch = fm[np.all(takem[fm], axis=1)]; used = np.unique(fpatch); remap = {}
  for j in used: remap[int(j)] = bm.verts.new(Vector(to_blender(mir[j][None])[0]))
  for f in fpatch:
    try: bm.faces.new([remap[int(j)] for j in f[::-1]])
    except ValueError: pass
  bm.to_mesh(me); bm.free(); me.update()
  co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); st = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
  log["knee"].update({"faces_taken_out": len(dead), "faces_put_in": int(len(fpatch))})
  # the seam: points within the band at the box's edge welded to `knee.weld` metres, islands of fewer than `knee.island`
  # faces inside the box dropped, and the band smoothed (`knee.seamSmooth` passes) so the two surfaces meet without a step
  if Kn.get("weld"):
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    stv = np.array([[v.co.x, v.co.z, -v.co.y] for v in bm.verts]); dist2 = np.minimum((stv - blo).min(1), (bhi - stv).min(1))
    band = [v for v in bm.verts if -Kn["ease"] < dist2[v.index] < Kn["ease"] * 1.5]
    n0 = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=band, dist=Kn["weld"]); welded = n0 - len(bm.verts)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table(); seen = set(); small = []
    for f in bm.faces:
      if f.index in seen: continue
      comp, stack = [], [f]; seen.add(f.index)
      while stack:
        g = stack.pop(); comp.append(g)
        for e in g.edges:
          for h in e.link_faces:
            if h.index not in seen: seen.add(h.index); stack.append(h)
      if len(comp) < Kn.get("island", 50):
        cc = np.mean([[v.co.x, v.co.z, -v.co.y] for g in comp for v in g.verts], axis=0)
        if np.all((cc > blo - Kn["ease"]) & (cc < bhi + Kn["ease"])): small += comp
    bmesh.ops.delete(bm, geom=list(set(small)), context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(me); bm.free(); me.update()
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); st = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
    dist2 = np.minimum((st - blo).min(1), (bhi - st).min(1)); bandw = np.clip(1 - np.abs(dist2) / Kn["ease"], 0, 1)
    vg = ob.vertex_groups.new(name="seam")
    for i in np.nonzero(bandw > 0)[0]: vg.add([int(i)], float(bandw[i]), "REPLACE")
    md = ob.modifiers.new("seam", "SMOOTH"); md.vertex_group = "seam"; md.factor = 0.8; md.iterations = Kn.get("seamSmooth", 20)
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier="seam"); ob.vertex_groups.remove(ob.vertex_groups["seam"])
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); st = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
    log["knee"].update({"welded_points": int(welded), "islands_dropped_faces": len(set(small)), "seam_smooth": Kn.get("seamSmooth", 20)})
AR = cfg.get("arm")
if PO and PO.get("solve"):
  # how far forward the wrist must come for the back of the hand to lie `solve.gap` metres off the knee as it now is:
  # the knee's front as cells of 2 cm (the foremost point of each, below the forearm), the hand's points against it
  sel = (st[:, 2] > 0.8) & (st[:, 1] < PO["solve"].get("below", 3.68)) & (st[:, 0] > -2.6) & (st[:, 0] < -0.9)
  cf = {}
  for (a, b), zz in zip(map(tuple, np.floor(st[sel][:, :2] / 0.02).astype(int)), st[sel][:, 2]):
    if zz > cf.get((a, b), -9): cf[(a, b)] = zz
  W0 = np.array(PO["wrist0"], float)
  palm_only = u < PO["solve"].get("palm_u", u0) if PO["solve"].get("palm_only") else np.ones(len(u), bool)
  def gaps(Qd):
    kk = np.floor(Qd[:, :2] / 0.02).astype(int)
    return np.array([q[2] - cf.get((a, b), -9.0) for q, (a, b) in zip(Qd, map(tuple, kk))])
  def gap(d, geo=None, sel_=None):
    Q_ = place(W0 + [0, 0, d], geo); g = gaps(Q_); sel_ = palm_only if sel_ is None else sel_
    # (with `solve.x_max`, only the palm's outer part, across from the little finger, is laid on the knee: the inner
    # side is left to the knee's wider easing there, the 3D review's choice (b))
    g = g[sel_ & (g > -8) & (Q_[:, 0] < PO["solve"].get("x_max", 9.0))]
    return g.min() if len(g) else 9.0
  lo_, hi_ = 0.0, 0.8
  for _ in range(30):
    mid = (lo_ + hi_) / 2
    if gap(mid) < PO["solve"]["gap"]: lo_ = mid
    else: hi_ = mid
  dsol = hi_; W = W0 + [0, 0, dsol]; AR = dict(AR); AR["shift"] = float(dsol)
  if PO["solve"].get("bend_range"):
    # the fingers then bent from the knuckles toward the back of the hand as far as the knee lets them (within
    # `bend_range` degrees), their tips kept `solve.tip_gap` metres off it
    # (toward the back is negative; if even straight they run into the knee, the least bend toward the palm that clears it)
    # (the fingers are what lies past the part the wrist was solved on: the knuckles are that part's own contact)
    fingers = u >= PO["solve"].get("palm_u", u0); b_best = None; trials = []
    for bdeg in np.arange(PO["solve"]["bend_range"][0], PO["solve"]["bend_range"][1] + 0.01, 1.0):
      gb = gap(dsol, bendgeo(math.radians(bdeg)), fingers); trials.append((float(bdeg), gb))
      if gb >= PO["solve"].get("tip_gap", 0.01): b_best = float(bdeg); break
    if b_best is None: b_best = max(trials, key=lambda t: t[1])[0]
    Q0 = place(W, bendgeo(0.0)); g0 = gaps(Q0); g0[~fingers | (g0 < -8)] = 9; j0 = int(np.argmin(g0)); k0 = tuple(np.floor(Q0[j0, :2] / 0.02).astype(int))
    src0 = st[sel][np.all(np.floor(st[sel][:, :2] / 0.02).astype(int) == list(k0), axis=1)]
    log["pose"]["straight_finger_limit"] = {"gap_m": round(float(g0[j0]), 4), "hand_point": Q0[j0].round(3).tolist(), "u": round(float(u[j0]), 3), "v": round(float(v[j0]), 3), "w": round(float(w[j0]), 3),
                                             "front_point": src0[np.argmax(src0[:, 2])].round(3).tolist() if len(src0) else None}
    du, dn = bendgeo(math.radians(b_best)); log["pose"]["bend_deg"] = float(b_best)
    log["pose"]["tip_gap_m"] = round(float(gap(dsol, None, fingers)), 4)
  hand_co = place(W); tw = W
  np.savez(os.path.join(out, "hand-final.npz"), points=hand_co, faces=hand_faces)   # the hand as joined (hand.glb is it before the solve)
  log["pose"].update({"wrist0": W0.tolist(), "solved_shift_m": round(float(dsol), 4), "wrist": W.round(4).tolist(), "gap_m": round(float(gap(dsol)), 4)})
  gall = gaps(place(W)); gall = gall[palm_only & (gall > -8)]; log["pose"]["palm_least_gap_m"] = round(float(gall.min()), 4)   # the whole palm, inner side too (negative: into the knee)
  Qd = place(W); kk = np.floor(Qd[:, :2] / 0.02).astype(int); gg = np.array([q[2] - cf.get((a, b), -9) for q, (a, b) in zip(Qd, map(tuple, kk))])
  j_ = int(np.argmin(gg)); a_, b_ = map(int, kk[j_]); src = st[sel][np.all(np.floor(st[sel][:, :2] / 0.02).astype(int) == [a_, b_], axis=1)]
  log["pose"]["limit"] = {"hand_point": Qd[j_].round(3).tolist(), "front_z": round(float(cf[(a_, b_)]), 3), "front_point": src[np.argmax(src[:, 2])].round(3).tolist()}
if AR:
  # Round 2 (the T05 lead's ruling; the 3D review's measures, issue #514 items 3 and 4): the whole right arm brought
  # forward so the hand can lie on the knee with its palm no more than 10° up. The upper arm turns about the shoulder
  # (`pivot`) by the angle that carries the elbow `shift` metres forward, faded out over the shoulder (`shoulder`: from
  # full at the lower height to nothing at the upper) and toward the side of the chest (`inner_x`, `inner_band`), so the
  # robe's edge and the chest do not move; the forearm, a tube round the line `axis_pts` lying on the thigh, is carried
  # the same `shift` straight forward (its shape, length and lie on the thigh kept), the two blended across the elbow
  # (`elbow_blend`, in z). What is left of the old hand past the new wrist (`cut`) is taken out.
  st0 = st.copy(); Pv, Ev = np.array(AR["pivot"]), np.array(AR["elbow"]); dl = AR["shift"]
  def rot(p, ph):
    r = p - Pv; c_, s_ = math.cos(ph), math.sin(ph)
    return Pv + np.c_[r[:, 0], r[:, 1] * c_ + r[:, 2] * s_, -r[:, 1] * s_ + r[:, 2] * c_]
  lo_, hi_ = 0.0, 0.5
  for _ in range(60):
    mid = (lo_ + hi_) / 2
    if rot(Ev[None], mid)[0, 2] - Ev[2] < dl: lo_ = mid
    else: hi_ = mid
  ph = (lo_ + hi_) / 2; Edisp = rot(Ev[None], ph)[0] - Ev
  sm = lambda x: np.clip(x, 0, 1) ** 2 * (3 - 2 * np.clip(x, 0, 1))
  x_, y_, z_ = st[:, 0], st[:, 1], st[:, 2]
  # which points are the arm's: inside a generous tube round the arm's own line (`upper_axis` from the shoulder to the
  # elbow, `axis_pts` along the forearm; radii `upper_tube`, `tube` times `slack`) and on a surface facing out from that
  # line (normal against the line's outward direction above `facing`): the thigh's top under the forearm, the robe at
  # the hip and the chest beside the arm face the other way, so they stay where they are
  nrm_ = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("normal", nrm_); nrm_ = nrm_.reshape(-1, 3); nrm_ = np.c_[nrm_[:, 0], nrm_[:, 2], -nrm_[:, 1]]
  def tube(pts, radii, plane):
    bestE, bestR = np.full(len(st), np.inf), np.zeros_like(st)
    for a0, a1 in zip(pts[:-1], pts[1:]):
      dvec = a1 - a0; tpar = np.clip((st - a0) @ dvec / (dvec @ dvec), 0, 1); foot = a0 + np.outer(tpar, dvec); off_ = st - foot
      third = 3 - plane[0] - plane[1]   # past either end of a segment the distance along it counts too
      e = ((off_[:, plane[0]] / radii[0]) ** 2 + (off_[:, plane[1]] / radii[1]) ** 2 + (off_[:, third] / min(radii)) ** 2) ** 0.5
      better = e < bestE; bestE[better] = e[better]; bestR[better] = off_[better]
    return bestE, bestR / np.maximum(np.linalg.norm(bestR, axis=1), 1e-9)[:, None]
  ap = np.array(AR["axis_pts"]); slack = AR.get("slack", 1.4); fac = AR.get("facing", 0.2)
  eF, rF = tube(ap, AR["tube"], (0, 1)); eU, rU = tube(np.array(AR["upper_axis"]), AR["upper_tube"], (0, 2))
  fore = (eF < slack) & (np.einsum("ij,ij->i", nrm_, rF) > fac) & (z_ > ap[0][2] - 0.3)
  upper = (eU < slack) & (np.einsum("ij,ij->i", nrm_, rU) > fac) & (y_ < AR["shoulder"][0]) & ~fore
  w_in = sm((AR["inner_x"] - x_) / AR["inner_band"]); w_sh = sm((AR["shoulder"][0] - y_) / (AR["shoulder"][0] - AR["shoulder"][1]))
  w_t = sm((z_ - AR["elbow_blend"][0]) / (AR["elbow_blend"][1] - AR["elbow_blend"][0]))
  trans = np.array([0, 0, dl])
  dsp = np.zeros_like(st)
  ui = np.nonzero(upper)[0]; dsp[ui] = ((rot(st[ui], ph) - st[ui]) * (1 - w_t[ui, None]) + trans * w_t[ui, None]) * (w_in[ui] * w_sh[ui])[:, None]
  fi = np.nonzero(fore)[0]; dsp[fi] = ((rot(st[fi], ph) - st[fi]) * (1 - w_t[fi, None]) + trans * w_t[fi, None])
  if AR.get("ylock"):
    # near the shoulder the turn moves the front of the arm up as well as forward, which lifts the shoulder's line in
    # the front outline; there the move is kept level (no rise), fully above ylock[0], fading out by ylock[1]
    y0_, y1_ = AR["ylock"]; dsp[:, 1] *= sm((y0_ - y_) / (y0_ - y1_))
  st = st + dsp
  mv = np.linalg.norm(dsp, axis=1); band = (upper & ((w_sh < 0.999) | (w_in < 0.999)) & (mv > 0))
  # what is left of the old hand past the new wrist, and the forearm's own end cap there
  cutz = (tw[2] + AR["cut_dz"]) if "cut_dz" in AR else AR.get("cut_z"); gone_n = 0
  me = ob.data; me.vertices.foreach_set("co", to_blender(st).ravel()); me.update()
  if cutz is not None:
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    # (each point keeps its index from before the deletions below, which number the points afresh)
    oi = bm.verts.layers.int.new("oi")
    for v in bm.verts: v[oi] = v.index
    moved = mv > 0.5 * dl
    dead = [f for f in bm.faces if all(moved[v.index] and st[v.index, 2] > cutz and st[v.index, 1] < AR.get("cut_ymax", 4.1) for v in f.verts)]
    if AR.get("cut_below_y"):   # what of the old hand moved with the forearm but hangs below it (the old wrist over the knee)
      cby = AR["cut_below_y"]; dead += [f for f in bm.faces if all(moved[v.index] and st[v.index, 1] < cby for v in f.verts)]
      # (in front of the wrist a face only partly below it stayed as a thin flap of the forearm over the palm)
      dead += [f for f in bm.faces if all(moved[v.index] and st[v.index, 2] > tw[2] for v in f.verts) and any(st[v.index, 1] < cby for v in f.verts)]
    # faces between a moved point and one left (the forearm's welded seam on the thigh) drawn out past `stretch` times
    # their length and over 2 cm are taken out rather than left as slivers
    stretched = 0
    for f in bm.faces:
      ids = [v.index for v in f.verts]
      if len(set(np.round(mv[ids], 4))) > 1:
        e0 = max(np.linalg.norm(st0[ids[i]] - st0[ids[i - 1]]) for i in range(len(ids))); e1 = max(np.linalg.norm(st[ids[i]] - st[ids[i - 1]]) for i in range(len(ids)))
        # only under the forearm (its seam on the thigh); round the shoulder and the chest a stretched face is kept, a
        # hole there showed as black slits along the inner arm
        if e1 > 0.02 and e1 > AR.get("stretch", 3.0) * max(e0, 1e-4) and (st[ids, 1].mean() < AR.get("stretch_below_y", 9.0) or st[ids, 2].mean() > tw[2] - AR.get("stretch_near_wrist", -9.0)): dead.append(f); stretched += 1
    dead = list(set(dead)); n_dead = len(dead)
    bmesh.ops.delete(bm, geom=dead, context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS"); dead = []
    if AR.get("cap"):
      # the forearm's cut end closed (a fill over the open edges of the moved forearm past the wrist), so nothing of its
      # inside shows through a gap in the hand's top
      bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table()
      vi = {v.index: v for v in bm.verts}
      edge_c = [e for e in bm.edges if e.is_boundary and all(moved[v[oi]] and st[v[oi], 2] > tw[2] for v in e.verts)]
      before = len(bm.faces); bmesh.ops.holes_fill(bm, edges=edge_c, sides=0); capped = len(bm.faces) - before
      bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    if AR.get("cap_under"):
      # (the forearm's underside, cut where it came down below `cut_below_y`, closed too: seen from the figure's left the
      # inside of the arm showed through it, above the knee's head, as a black hole; the 3D review's seal)
      bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); cy = AR.get("cut_below_y", -9)
      edge_u = [e for e in bm.edges if e.is_boundary and all(moved[v[oi]] and st[v[oi], 1] < cy + AR.get("cap_under_band", 0.06) for v in e.verts)]
      # (the imported mesh keeps its points split along the texture's seams, so a seam is an open edge on both sides:
      # only an edge with no twin lying on it is a true opening)
      ekey = lambda e: tuple(sorted(tuple(round(c, 5) for c in v.co) for v in e.verts))
      from collections import Counter
      seen_k = Counter(ekey(e) for e in bm.edges if e.is_boundary)
      edge_u = [e for e in edge_u if seen_k[ekey(e)] == 1]
      # the cut's open edge is not a closed loop (it runs on into the forearm's end, where the hand goes in), so each run
      # of it is closed by a fan to its middle, each triangle wound against the face its edge already has
      par = {}
      def root(a):
        while par.get(a, a) != a: a = par[a]
        return a
      for e in edge_u:
        a, b = root(e.verts[0].index), root(e.verts[1].index)
        if a != b: par[a] = b
      runs = {}
      for e in edge_u: runs.setdefault(root(e.verts[0].index), []).append(e)
      capped_u = 0
      for es in runs.values():
        if len(es) < 3: continue
        vs = {v for e in es for v in e.verts}; cc = sum((v.co for v in vs), Vector()) / len(vs)
        xr = AR.get("cap_under_x")   # (only the runs whose middle lies across here: the opening seen from the left)
        if xr and not (xr[0] < cc.x < xr[1]): continue
        if -cc.y > tw[2]: continue   # (behind the wrist only: in front of it a fan lay over the back of the hand)
        vv_ = np.array([[v.co.x, v.co.z, -v.co.y] for v in vs])
        log.setdefault("arm_cap", {}).setdefault("runs", []).append({"edges": len(es), "middle": [round(cc.x, 3), round(cc.z, 3), round(-cc.y, 3)], "min": vv_.min(0).round(3).tolist(), "max": vv_.max(0).round(3).tolist()})
        # (each triangle faces away from the forearm's axis, elbow to wrist as carried: the run's edges come from faces
        # wound either way, the forearm's outside and the robe's inside, so the neighbours' winding cannot say it)
        # (two-sided, as two fans 1 mm apart at their middles, each turned to its own side: different views see the
        # same fan from either side, and a line of sight from either meets the fan turned toward it first)
        A_ = Ev + Edisp; B_ = np.array(tw, float); ab = (B_ - A_) / np.linalg.norm(B_ - A_)
        ccs = np.array([cc.x, cc.z, -cc.y]); rad = (ccs - A_) - ((ccs - A_) @ ab) * ab; rad /= max(np.linalg.norm(rad), 1e-9)
        dl_ = AR.get("cap_under_gap", 0.001) / 2; rb = Vector((rad[0], -rad[2], rad[1]))
        cO = bm.verts.new(cc + rb * dl_); cI = bm.verts.new(cc - rb * dl_)
        for e in es:
          a, b = e.verts[0], e.verts[1]
          ps = np.array([[q.co.x, q.co.z, -q.co.y] for q in (a, b)] + [ccs]); nn = np.cross(ps[1] - ps[0], ps[2] - ps[0])
          out_ab = nn @ rad > 0
          try: bm.faces.new([a, b, cO] if out_ab else [b, a, cO]); bm.faces.new([b, a, cI] if out_ab else [a, b, cI]); capped_u += 2
          except ValueError: pass
      log.setdefault("arm_cap", {})["under_edges"] = len(edge_u); log["arm_cap"]["under_runs"] = sum(len(es) >= 3 for es in runs.values()); log["arm_cap"]["under_faces"] = int(capped_u)
    gone_n = n_dead; bmesh.ops.delete(bm, geom=dead, context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    if AR.get("lining"):
      # (a backing behind the opening, the 3D review's other way and the T05 lead's ruling: the carried forearm is lined
      # with its own surface `lining.depth` metres inside, wound the other way, so that a line of sight through any gap
      # left in its underside meets a face turned toward it, never the back of one; the lining is not seen otherwise)
      LN = AR["lining"]; bm.normal_update(); bm.verts.ensure_lookup_table(); lo_, hi_ = np.array(LN["min"]), np.array(LN["max"])
      inl = lambda v: v[oi] < len(moved) and moved[v[oi]] and np.all(st[v[oi]] > lo_) and np.all(st[v[oi]] < hi_)
      lf = [f for f in bm.faces if all(inl(v) for v in f.verts)]; nv = {}
      for f in lf:
        for v in f.verts:
          if v.index not in nv: nv[v.index] = bm.verts.new(v.co - v.normal * LN.get("depth", 0.005))
      nl = 0
      for f in lf:
        try: bm.faces.new([nv[v.index] for v in reversed(f.verts)]); nl += 1
        except ValueError: pass
      lp = np.array([[q.co.x, q.co.z, -q.co.y] for q in nv.values()]); np.save(os.path.join(out, "arm-lining.npy"), lp)
      log.setdefault("arm_cap", {})["lining_faces"] = nl
    bm.verts.layers.int.remove(oi)
    bm.to_mesh(me); bm.free(); me.update()
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); st = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
  log["arm"] = {"pivot": Pv.tolist(), "elbow": Ev.tolist(), "angle_deg": round(math.degrees(ph), 2), "elbow_moves_m": Edisp.round(3).tolist(), "forearm_shift_m": trans.tolist(),
                "upper_points": int(upper.sum()), "forearm_points": int(len(fi)), "largest_move_m": round(float(mv.max()), 3),
                "band": {"points": int(band.sum()), "largest_move_m": round(float(mv[band].max()) if band.any() else 0.0, 3), "shoulder_band_y": AR["shoulder"], "inner_band_m": AR["inner_band"], "inner_x": AR["inner_x"]},
                "range": {"min": st0[mv > 0].min(0).round(3).tolist(), "max": st0[mv > 0].max(0).round(3).tolist()}, "old_hand_faces_cut": gone_n - stretched, "stretched_faces_cut": stretched, "cap_faces": int(capped) if AR.get("cap") else 0}
  np.save(os.path.join(out, "arm-moved.npy"), np.c_[st0[mv > 0], mv[mv > 0]])
# the new hand, joined
if PO and PO.get("trim"):
  # the donor's own cut lies aslant once the hand is turned to its pose and stood out of the forearm (round 2: the
  # wrist's edge 70 mm outside at the median); the stub's top `trim` metres (along the hand from the wrist) are taken
  # off, so its open end is a level ring inside the forearm's end
  s_h = (hand_co - tw) @ tax; keepv = s_h >= PO["trim"]
  hand_faces = hand_faces[np.all(keepv[hand_faces], axis=1)]; used = np.unique(hand_faces)
  remap = -np.ones(len(hand_co), int); remap[used] = np.arange(len(used)); hand_co = hand_co[used]; hand_faces = remap[hand_faces]
  log.setdefault("pose", {})["trim_m"] = PO["trim"]
  np.savez(os.path.join(out, "hand-final.npz"), points=hand_co, faces=hand_faces)
if PO and PO.get("wrap"):
  # the wrist: the hand's top `wrap.length` metres are drawn onto the forearm as it now lies, each point that stands
  # outside it laid back to `wrap.sink` metres under its surface (along the nearest face's normal), fully at the top
  # and less going down, so the hand's open end lies inside the forearm and the two read as one wrist
  from mathutils.bvhtree import BVHTree as _BV
  WP = PO["wrap"]; near_w = np.linalg.norm(st - tw, axis=1) < WP.get("reach", 0.6)
  fv_ = np.empty(len(ob.data.polygons) * 3, dtype=np.int64); ob.data.polygons.foreach_get("vertices", fv_); F_ = fv_.reshape(-1, 3)
  Fw = F_[np.all(near_w[F_], axis=1)]
  tree_w = _BV.FromPolygons([Vector(p) for p in st], [tuple(int(i) for i in f) for f in Fw])
  s_h = (hand_co - tw) @ tax; ww_ = 1 - np.clip(s_h / WP["length"], 0, 1); ww_ = ww_ * ww_ * (3 - 2 * ww_); moved_w = 0
  for i in np.nonzero(ww_ > 0)[0]:
    loc, nrm_w, _, _ = tree_w.find_nearest(Vector(hand_co[i]))
    if loc is None: continue
    loc = np.array(loc); nrm_w = np.array(nrm_w); sd = (hand_co[i] - loc) @ nrm_w
    if sd > -WP["sink"]: hand_co[i] = hand_co[i] - nrm_w * (sd + WP["sink"]) * ww_[i]; moved_w += 1
  log.setdefault("pose", {})["wrap"] = {"length_m": WP["length"], "sink_m": WP["sink"], "points_moved": moved_w}
  np.savez(os.path.join(out, "hand-final.npz"), points=hand_co, faces=hand_faces)
nb = len(st); allco = np.r_[st, hand_co]
me = ob.data; bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
for p in hand_co: bm.verts.new(Vector(to_blender(p[None])[0]))
bm.verts.ensure_lookup_table()
for f in hand_faces:
  try: bm.faces.new([bm.verts[nb + int(j)] for j in f])
  except ValueError: pass
for i, v in enumerate(bm.verts[:nb]): v.co = Vector(to_blender(st[i][None])[0])
if PO and PO.get("cap_top"):
  # the hand's own open top (the stub's cut) closed where it lies within `cap_top` metres of the wrist, so no gap in it
  # shows the inside where the forearm does not cover it
  bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); s_all = (hand_co - tw) @ tax
  edge_h = [e for e in bm.edges if e.is_boundary and all(v.index >= nb and s_all[v.index - nb] < PO["cap_top"] for v in e.verts)]
  f0 = len(bm.faces); bmesh.ops.holes_fill(bm, edges=edge_h, sides=0); log.setdefault("pose", {})["cap_top_faces"] = len(bm.faces) - f0
  bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
bm.to_mesh(me); bm.free(); me.update()
log["joined"] = {"hand_points": len(hand_co), "hand_faces": len(hand_faces), "how": "joined over the wrist, the hand's wrist sunk into the forearm (no boolean: the figure is many open shells)"}
CL = cfg.get("cleanup")
if CL and CL.get("blender", True):   # (round 2: off; it took scraps of the hand's own surface; varada-tidy.py does it on the file)
  # last: pieces of fewer than `cleanup.island` faces lying within `cleanup.pad` metres of the knee box (seen from the
  # front) or of the hand are taken out (scraps the cuts left; the 3D review: no isolated piece under 50 faces)
  bm = bmesh.new(); bm.from_mesh(me)
  # coincident points welded first (the file splits its points along texture seams, so a "piece" of the split mesh may
  # be a scrap of a larger surface); the points do not move
  bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=CL.get("weld", 1e-5)); bm.faces.ensure_lookup_table()
  pad = CL.get("pad", 0.3); hb_lo = hand_co.min(0) - pad; hb_hi = hand_co.max(0) + pad
  def near_(c): return (np.all((c[:2] > blo[:2] - pad) & (c[:2] < bhi[:2] + pad)) and c[2] > CL.get("zmin", 0.5)) or (CL.get("hand", False) and np.all((c > hb_lo) & (c < hb_hi)))
  cand_f = set(f.index for f in bm.faces if near_(np.array([f.calc_center_median().x, f.calc_center_median().z, -f.calc_center_median().y])))
  seen = set(); small = []
  for fi in cand_f:
    if fi in seen: continue
    comp, stack = [], [bm.faces[fi]]; seen.add(fi); big = False
    while stack:
      g = stack.pop(); comp.append(g)
      if len(comp) >= CL.get("island", 50): big = True; break
      for e in g.edges:
        for h in e.link_faces:
          if h.index not in seen: seen.add(h.index); stack.append(h)
    if not big: small += comp
  bmesh.ops.delete(bm, geom=list(set(small)), context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
  bm.to_mesh(me); bm.free(); me.update(); log["cleanup"] = {"island": CL.get("island", 50), "pad_m": pad, "faces_taken_out": len(set(small))}
  # then once more as the measure sees it: points merged only where they coincide exactly (to 1e-7 m), pieces joined
  # through shared edges; a piece of fewer than `island` faces whose middle lies in the knee box (with the measure's
  # margin, before the knee's front) goes
  from scipy.sparse import coo_matrix as _coo
  from scipy.sparse.csgraph import connected_components as _cc
  co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3); S_ = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
  tri = [list(p_.vertices) for p_ in me.polygons]; nf_ = len(tri)
  _, vid = np.unique(np.round(S_ / 1e-7).astype(np.int64), axis=0, return_inverse=True); vid = vid.ravel()
  rows, cols = [], []; emap = {}
  for fi_, t_ in enumerate(tri):
    m_ = [vid[i] for i in t_]
    for a_, b_ in zip(m_, m_[1:] + m_[:1]):
      k_ = (a_, b_) if a_ < b_ else (b_, a_)
      if k_ in emap: rows.append(emap[k_]); cols.append(fi_)
      else: emap[k_] = fi_
  nc_, lab_ = _cc(_coo((np.ones(len(rows)), (rows, cols)), shape=(nf_, nf_)), directed=False)
  cnt_ = np.bincount(lab_, minlength=nc_)
  fcen = np.array([S_[t_].mean(0) for t_ in tri]); e2 = CL.get("margin", 0.12)
  inb_ = np.all((fcen > blo - e2) & (fcen < bhi + e2), axis=1) & (fcen[:, 2] > CL.get("zmin", 0.5))
  kill = np.nonzero((cnt_[lab_] < CL.get("island", 50)) & inb_)[0]
  if len(kill):
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[int(i)] for i in kill], context="FACES"); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(me); bm.free(); me.update()
  log["cleanup"]["exact_faces_taken_out"] = int(len(kill))
# back to the file's own frame and units, so the rest of the pipeline (thinning, baking) takes it as it took r1
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
S3 = np.c_[co[:, 0], co[:, 2], -co[:, 1]]; B3 = S3 / k; B3 = np.c_[B3[:, 0], -B3[:, 2], B3[:, 1]] + off
me.vertices.foreach_set("co", B3.ravel()); me.update()
for o in bpy.context.scene.objects: o.select_set(o == ob)
dst = os.path.join(out, "sakyamuni-varada.glb"); bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True, export_normals=True)
log["out"] = {"file": dst, "sha256": sha(dst)}
json.dump(log, open(os.path.join(out, "varada.json"), "w"), indent=1); print(json.dumps({k2: log[k2] for k2 in ("knee", "joined", "out")}))
