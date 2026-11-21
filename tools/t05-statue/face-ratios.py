# The mouth's proportions on a statue and on its concept drawing, by one method (issue #463, the 3D review's second
# round). The review withdrew the lip-to-line measure of face-measure.py (a padded chin moves the line with it) and
# set four ratios whose limits come from the concept's own face:
#
#   mouthW   the mouth's width over the face's width at the mouth          (within ±15% of the concept)
#   lipH     the lips' height, upper lip's foremost point to the lower's, over the mouth's width   (≤ concept × 1.15)
#   lipFwd   how far the upper lip stands forward of the base of the nose, over the mouth's width  (≤ the concept's)
#   sulcus   the hollow under the lower lip, its depth below the line from the lower lip to the chin's foremost
#            point, over the mouth's width                                  (≤ concept × 1.2)
#
# "Forward" is the figure's own: a mesh bowed by repair.py's tilt is turned back by it first ("tilt" in points.json);
# the drawing is read as drawn. A head drawn bowed by a few degrees moves lipFwd by about 0.01 of the mouth's width.
#
#   python3 tools/t05-statue/face-ratios.py mesh <statue.glb> <points.json>
#   python3 tools/t05-statue/face-ratios.py concept <side.png> <front.json>
#
# points.json (the mesh, the figure's stage frame in metres): { "height", "mouth": [x, y] (the slit's middle, about),
#   "browY": y of the brow ridge at the middle (about) }. front.json (the concept): { "side": { "box": [x0, y0, x1, y1]
#   (the face in the side picture, which faces left), "mouthY": row of the slit, "browY": row of the brow ridge,
#   "threshold": luminance of the figure over the dark ground }, "front": { "corners": [[x, y], [x, y]], "cheeks":
#   [[x, y], [x, y]] (pixels in the front picture, read by eye), "picture": file } } — the front's pixels are the
#   side's (one turnaround drawn at one scale), so the mouth's width read in the front scales the side's profile.
import sys, json, numpy as np

def profile_ratios(ys, zs, my, by, w, win=0.08):
  """ys up, zs forward (any unit, w in the same), the slit near my, the brow ridge near by."""
  ys = np.asarray(ys, float); zs = np.asarray(zs, float)
  def arg(fn, lo, hi): sel = np.nonzero((ys >= lo) & (ys <= hi) & ~np.isnan(zs))[0]; return int(sel[fn(zs[sel])])
  span = by - my
  islit = arg(np.nanargmin, my - win * span, my + win * span)   # win: how far from the guess the slit is looked for, in spans
  itip = arg(np.nanargmax, ys[islit] + 0.1 * span, my + 0.7 * span)
  iglab = arg(np.nanargmax, by - 0.15 * span, by + 0.15 * span)
  # up from the slit: the upper lip where the profile stops coming forward, the base of the nose where it starts again
  # (judged square to the brow–nose line found from the first guess below, so a bowed head is read as made)
  up, fw = np.array([1.0, 0.0]), np.array([0.0, 1.0])            # the figure's own vertical (a bowed mesh is turned back first)
  P = np.c_[ys, zs]; f = P @ fw; v = P @ up                      # forwardness and height in the face's own frame
  # the base of the nose: where the profile's slope jumps most between the slit and the nose's tip (the lip's front
  # meeting the nose's underside); the upper lip's foremost point: the one standing farthest out from the chord between
  # the slit and the base of the nose. Below: the hollow is the deepest point between the slit and the chin, the chin
  # the foremost below the hollow, the lower lip the one standing farthest out from the chord between the slit and the
  # hollow. (Turns of the profile alone fail where a lip runs straight into the nose.)
  k = 3; g = np.gradient(np.convolve(f, np.ones(k) / k, mode="same"), v)
  lo, hi = islit + 2, itip - 1
  isn = lo + int(np.nanargmax(np.diff(g[lo:hi + 1]))) + 1
  def bulge(a, b):   # the point between indices a and b farthest out (forward) from the chord a–b
    a, b = min(a, b), max(a, b); idx = np.arange(a, b + 1)
    t = (v[idx] - v[a]) / (v[b] - v[a] if v[b] != v[a] else 1); chord = f[a] + t * (f[b] - f[a])
    return int(idx[np.nanargmax(f[idx] - chord)])
  ils = bulge(islit, isn)
  ism = arg(np.nanargmin, ys[islit] - 0.25 * span, ys[islit] - 0.03 * span)
  ipg = arg(np.nanargmax, ys[ism] - 0.35 * span, ys[ism] - 0.02 * span)
  ili = bulge(ism, islit)
  # the base of the nose again, now in the face's frame, now that up/forward are fixed by glabella and the first guess
  li, pg, sm = P[ili], P[ipg], P[ism]
  d = pg - li; n = np.array([-d[1], d[0]]) / np.linalg.norm(d)
  if n @ fw < 0: n = -n
  return {"lipH": round(float((v[ils] - v[ili]) / w), 3), "lipFwd": round(float((f[ils] - f[isn]) / w), 3),
          "sulcus": round(float(max(0.0, -(sm - li) @ n) / w), 3),
          "points": {k: [round(float(P[i][0]), 3), round(float(P[i][1]), 3)] for k, i in
                     (("glabella", iglab), ("noseTip", itip), ("noseBase", isn), ("upperLip", ils), ("slit", islit),
                      ("lowerLip", ili), ("sulcus", ism), ("chin", ipg))}}

mode, src, spec = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
if mode == "concept":
  from PIL import Image
  im = np.asarray(Image.open(src).convert("RGB")).astype(float).mean(2); S = spec["side"]; x0, y0, x1, y1 = S["box"]
  rows = np.arange(y0, y1); zs = np.full(len(rows), np.nan)
  for k, r in enumerate(rows):
    row = im[r, x0:x1]; th = S.get("threshold", 90); xs = np.nonzero(row > th)[0]
    if len(xs) and xs[0] > 0:                                    # the edge to a fraction of a pixel, from the drawing's own anti-aliasing
      i = xs[0]; a, b = row[i - 1], row[i]; zs[k] = -(x0 + i - 1 + (th - a) / max(b - a, 1e-6))   # the figure faces left: forward is −x
  ys = -rows.astype(float)[::-1]; zs = zs[::-1]                 # up is −row, and the profile is read bottom to top
  zs = np.convolve(np.nan_to_num(zs, nan=np.nanmin(zs)), np.ones(3) / 3, mode="same")
  Fr = spec["front"]; (ax, ay), (bx, by_) = Fr["corners"]; (cx, _), (dx, _) = Fr["cheeks"]
  w = abs(bx - ax); out = profile_ratios(ys, zs, -S["mouthY"], -S["browY"], w)
  out["mouthW"] = round(w / abs(dx - cx), 3); out["w_px"] = w
  out["frontLips"] = round(abs(Fr["lipBottom"] - Fr["lipTop"]) / w, 3) if "lipTop" in Fr else None
else:
  import trimesh
  m = trimesh.load(src, force="mesh"); v = m.vertices; mn, mx = v.min(0), v.max(0); s = spec["height"] / (mx[1] - mn[1])
  m.vertices = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s
  ray = trimesh.ray.ray_triangle.RayMeshIntersector(m)
  def front(xy):
    xy = np.atleast_2d(np.asarray(xy, float)); o = np.c_[xy, np.full(len(xy), 20.0)]
    loc, idx, _ = ray.intersects_location(o, np.tile([0, 0, -1.0], (len(xy), 1)), multiple_hits=False)
    z = np.full(len(xy), np.nan)
    if len(idx): z[idx] = np.asarray(loc).reshape(-1, 3)[:, 2]
    return z
  mx_, my_ = spec["mouth"]; by = spec["browY"]
  ys = np.arange(my_ - 0.5, by + 0.15, 0.003); zs = front(np.c_[np.full_like(ys, mx_), ys])
  tl = np.radians(spec.get("tilt", 0))
  if tl:   # turned back about the mouth's height, resampled on the same rows
    zc = float(np.nanmedian(zs)); yr = my_ + (ys - my_) * np.cos(tl) + (zs - zc) * np.sin(tl); zr = zc - (ys - my_) * np.sin(tl) + (zs - zc) * np.cos(tl)
    ok = ~np.isnan(zr); o = np.argsort(yr[ok]); zs_t = np.interp(ys, yr[ok][o], zr[ok][o])
  else: zs_t = zs
  # the slit's own height: the deepest point near the guess
  # "slitWin": a reshaped mouth whose slit is known (repair.py's scale keeps its centre where it was) is searched close
  sw = spec.get("slitWin", 0.06); sel = np.abs(ys - my_) < sw; slit = float(ys[sel][np.nanargmin(zs[sel])])
  # the mouth's corners: out from the middle along the slit, where the slit's crease (the surface's dip below the line
  # across 4 cm above and below) has fallen to a third of its depth at the middle
  def crease(x):
    yy = np.arange(slit - 0.04, slit + 0.0401, 0.004); zz = front(np.c_[np.full_like(yy, x), yy])
    if np.isnan(zz).any(): return 0.0
    k = np.polyfit(yy, zz, 1); return float(np.max(np.polyval(k, yy) - zz))
  c0 = crease(mx_); corner = {}
  for sg, side in ((1, "L"), (-1, "R")):
    x = mx_
    while abs(x - mx_) < 0.6 and crease(x) > c0 / 3: x += sg * 0.005
    corner[side] = round(x, 3)
  w = abs(corner["L"] - corner["R"])
  # the face's width at the slit: out from the middle while the surface goes on without a step (the ears, behind, are cut
  # off from the cheek by one)
  def edge(sg, yy=None):
    yy = slit if yy is None else yy
    x, zp = mx_, front([[mx_, yy]])[0]
    while True:
      z = front([[x + sg * 0.01, yy]])[0]
      # a step of 15 cm in 1 cm, or a surface 0.35 m behind the front: off the cheek, onto an ear behind it
      if np.isnan(z) or abs(z - zp) > 0.15 or z < spec.get("earZ", -0.35): return x
      x += sg * 0.01; zp = z
  faceW = edge(1) - edge(-1)
  # the jaw's width over the cheekbones' (the 3D review's fourth round: the lower face read wide and round): the face's
  # width a quarter of the slit-to-brow span below the slit, over its width 0.3 of the span above it (the cheekbones, at the
  # height of the nose's wings; higher, a bowed head brings the ears into the line)
  sp = by - slit; yj, yc = slit - 0.25 * sp, slit + 0.3 * sp
  jawW, cheekW = edge(1, yj) - edge(-1, yj), edge(1, yc) - edge(-1, yc)
  out = profile_ratios(ys, zs_t, slit, by, w, win=sw / max(by - slit, 1e-6) if "slitWin" in spec else 0.08)
  # the carved eye's slit under each eye anchor: where the upper lid overhangs, the surface seen from the front steps
  # back; across the eye (±0.12 m) the step's height, fitted with a line, gives the slit's height at the eye's middle
  # and how much it rises per metre outward (the painted lid line is laid on it, the review's second round)
  eyes = {}
  for k, (ex, ey) in (spec.get("eyes") or {}).items():
    xs_, hs = [], []
    for dx in np.arange(-0.12, 0.1201, 0.02):
      yy = np.arange(ey - 0.12, ey + 0.0801, 0.004); zz = front(np.c_[np.full_like(yy, ex + dx), yy])
      dz = np.diff(zz); 
      if np.all(np.isnan(dz)): continue
      i = int(np.nanargmax(dz))
      if dz[i] > 0.03: xs_.append(ex + dx); hs.append(yy[i] + 0.002)
    if len(xs_) >= 4:
      kk = np.polyfit(np.array(xs_) - ex, hs, 1); out_sign = 1 if ex > 0 else -1
      eyes[k] = {"y": round(float(np.polyval(kk, 0)), 3), "rise": round(float(kk[0] * out_sign), 3), "points": len(xs_)}
  out["eyes"] = eyes
  out.update({"jawCheek": round(jawW / cheekW, 3), "jawW_m": round(jawW, 3), "cheekW_m": round(cheekW, 3)})
  out.update({"mouthW": round(w / faceW, 3), "w_m": round(w, 3), "faceW_m": round(faceW, 3), "corners": corner, "slit": round(slit, 3)})
print(json.dumps(out))
