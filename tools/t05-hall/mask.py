# A zone's mask worked out from the figure's own surface (issue #370, round 6), instead of a box whose sides are straight.
#
#   python3 tools/t05-hall/mask.py <spec.json>
#
# The spec names, for one figure, a picture of its normals drawn orthographically from the front without the grid
# (tools/t05-hall.cjs, a shot { "ortho": { "i", "side": "front", "cx", "cy", "half", "square": true, "grid": false } }), the
# rectangle of the figure's frame that picture covers, and for each channel of the mask a zone: seed points (x, y in
# metres, the figure's frame) and a box it may not leave. From the seeds the region grows over the picture's pixels while
# the normal changes by less than `tol` from one pixel to the next, so it stops where the surface breaks: the collar's
# ridge, a lapel's fold lying over the garment, a sash. The region is then closed over `close` metres (a tie line across
# the garment, a crease too fine to be its edge), its holes filled, and its edge blurred over `blur` metres, so the
# colour goes over in 2–4 cm along the fold itself. Writes paint/masks/<name>.png (RGBA, a channel a zone) and prints
# what the anchors file needs: { "file", "rect", "z" }.
import json, sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

spec = json.load(open(sys.argv[1]))
img = np.asarray(Image.open(spec["normals"]).convert("RGB")).astype(np.float32) / 255.0
H, W = img.shape[:2]
x0, y0, x1, y1 = spec["rect"]
mpp = (x1 - x0) / W   # metres a pixel (the picture is square in metres)
bg = np.all(np.abs(img - img[0, 0]) < 0.02, axis=2)   # the backdrop: the corner's colour
n = img * 2 - 1
back = spec.get("side") == "back"   # a picture from behind has +x on its left (the shader reads it so, pMap in paint.js)
px = lambda x, y: (int(round(((x1 - x) if back else (x - x0)) / mpp)), int(round((y1 - y) / mpp)))
out = np.zeros((H, W, 4), np.uint8)
regs = []
report = {"file": os.path.basename(spec["out"]), "rect": spec["rect"], "z": spec.get("z", -99), "depth": bool(spec.get("depth")), "channels": []}
for ci, z in enumerate(spec["channels"]):
  ch = z.get("ch", ci)   # which channel of the picture: R and G are the bare skin and the gilt edge, B a garment (paint/recipe.json)
  bx0, by0 = px(z["box"][2] if back else z["box"][0], z["box"][3]); bx1, by1 = px(z["box"][0] if back else z["box"][2], z["box"][1])
  allow = np.zeros((H, W), bool); allow[max(by0, 0):min(by1, H), max(bx0, 0):min(bx1, W)] = True; allow &= ~bg
  if "ring_of" in z:
    # a band of `width` metres just outside another channel's region, inside this channel's box (the gilt along a
    # robe's edge, lying on the robe beside the bare skin)
    ro = z["ring_of"] if isinstance(z["ring_of"], list) else [z["ring_of"]]   # one channel, or the union of several
    base = np.any([regs[i] for i in ro], axis=0); w = max(1, int(round(z["width"] / mpp)))
    reg = ndi.binary_dilation(base, structure=ndi.generate_binary_structure(2, 1), iterations=w) & ~base & allow
    if z.get("open") == "below":
      # the gilt only along the collar and the lapels, its sides and top, not along its lower edge (issue #463): in each
      # column of the picture, none below the lowest pixel of the region it rings
      rows = np.arange(H)[:, None]; low = np.where(base.any(axis=0), (base * rows).max(axis=0), -1)[None, :]
      reg &= ~((low >= 0) & (rows > low))
    regs.append(reg)
    m = ndi.gaussian_filter(reg.astype(np.float32), sigma=z.get("blur", 0.008) / mpp)
    out[..., ch] = np.clip(m * 255, 0, 255).astype(np.uint8)
    report["channels"].append({"zone": z["zone"], "pixels": int(reg.sum()), "area_m2": round(float(reg.sum()) * mpp * mpp, 3)}); continue
  tol = z.get("tol", 0.06)
  # a pixel joins its neighbour where the normals differ by less than tol (both ways along each axis)
  dx = np.linalg.norm(n[:, 1:] - n[:, :-1], axis=2) < tol; dy = np.linalg.norm(n[1:] - n[:-1], axis=2) < tol
  reg = np.zeros((H, W), bool); stack = []
  for sx, sy in z["seeds"]:
    c, r = px(sx, sy); reg[r, c] = True; stack.append((r, c))
  while stack:
    r, c = stack.pop()
    for rr, cc, ok in ((r, c + 1, c + 1 < W and dx[r, c]), (r, c - 1, c > 0 and dx[r, c - 1]), (r + 1, c, r + 1 < H and dy[r, c]), (r - 1, c, r > 0 and dy[r - 1, c])):
      if ok and allow[rr, cc] and not reg[rr, cc]: reg[rr, cc] = True; stack.append((rr, cc))
  if z.get("stops"):
    # where the zone meets a neighbour with no clean break between them on the way (the neck above a garment's top edge),
    # the two grow against each other over the strength of the normals' change and meet on its strongest line: seeds for
    # the zone, `stops` for what lies beyond it, and everything outside the box counts as beyond (ndimage.watershed_ift)
    g = np.zeros((H, W), np.float32)
    g[:, 1:] += np.linalg.norm(n[:, 1:] - n[:, :-1], axis=2); g[1:] += np.linalg.norm(n[1:] - n[:-1], axis=2)
    g = ndi.gaussian_filter(g, 1.0); gi = np.clip(g / max(g.max(), 1e-6) * 65535, 0, 65535).astype(np.uint16)
    mk = np.zeros((H, W), np.int16); mk[~allow] = 2
    for sx, sy in z["stops"]: c, r = px(sx, sy); mk[max(r - 2, 0):r + 3, max(c - 2, 0):c + 3] = 2
    for sx, sy in z["seeds"]: c, r = px(sx, sy); mk[max(r - 2, 0):r + 3, max(c - 2, 0):c + 3] = 1
    reg = ndi.watershed_ift(gi, mk) == 1
  k = max(1, int(round(z.get("close", 0.03) / mpp)))
  st = ndi.generate_binary_structure(2, 1)
  reg = ndi.binary_closing(reg, structure=st, iterations=k) & allow
  reg = ndi.binary_fill_holes(reg)
  if z.get("snap"):
    # the edge laid on the mesh's own crease: the region (however it was found) is held to within `in` metres inside and `out`
    # metres outside its edge, and the two sides grow against each other over the strength of the normals' change and meet on
    # its strongest line within that band: a collar's fold, not a box's side (ndimage.watershed_ift, as `stops` above)
    si, so = z["snap"].get("in", 0.04), z["snap"].get("out", 0.07)
    g2 = np.zeros((H, W), np.float32)
    g2[:, 1:] += np.linalg.norm(n[:, 1:] - n[:, :-1], axis=2); g2[1:] += np.linalg.norm(n[1:] - n[:-1], axis=2)
    g2 = ndi.gaussian_filter(g2, 1.0); gi2 = np.clip(g2 / max(g2.max(), 1e-6) * 65535, 0, 65535).astype(np.uint16)
    mk = np.zeros((H, W), np.int16)
    mk[~ndi.binary_dilation(reg, structure=st, iterations=max(1, int(round(so / mpp))))] = 2
    mk[bg] = 2
    inner = ndi.binary_erosion(reg, structure=st, iterations=max(1, int(round(si / mpp))))
    mk[inner] = 1
    reg = ndi.watershed_ift(gi2, mk) == 1
    reg = ndi.binary_fill_holes(ndi.binary_opening(reg, structure=st, iterations=max(2, int(round(z["snap"].get("open", 0.012) / mpp)))))   # `open`: a line thinner than that, where the growth ran along a crease, goes
  if z.get("rowfill"):
    # a block with straight sides (an inner garment's panel) is filled across each row between its leftmost and rightmost
    # pixel, inside the box: the small folds that the growth stopped at, along its top edge and sides, take the colour too
    rows = np.nonzero(reg.any(axis=1))[0]
    for r in rows:
      cs = np.nonzero(reg[r])[0]; reg[r, cs.min():cs.max() + 1] = True
    reg &= allow
  regs.append(reg)
  # surfaces seen edge-on lie on the picture's silhouette; let the region run on into the empty backdrop a little, so the
  # blur does not fade them (a bare arm's side, seen from neither front nor back)
  spill = reg | (ndi.binary_dilation(reg, structure=st, iterations=max(1, int(round(3 * z.get("blur", 0.012) / mpp)))) & bg)
  m = ndi.gaussian_filter(spill.astype(np.float32), sigma=z.get("blur", 0.012) / mpp)
  val = np.clip(m * z.get("gain", 1.0) * 255, 0, 255).astype(np.uint8)   # gain: a region whose rim is a pale fringe (a finger's grazing edge the growth stops short of) is pushed to full over its blur
  for ex in z.get("exclude", []):
    # a patch the picture could not tell from the zone (a nail of cloth just behind a hand's edge): boxes cleared from this channel
    ex0, ey0 = px(ex[0], ex[3]); ex1, ey1 = px(ex[2], ex[1]); val[max(ey0, 0):max(ey1, 0), max(ex0, 0):max(ex1, 0)] = 0
  out[..., ch] = np.maximum(out[..., ch], val) if z.get("union") else val   # union: this region joins what an earlier entry put in the same channel (the bare chest and the raised hand are both skin)
  report["channels"].append({"zone": z["zone"], "pixels": int(reg.sum()), "area_m2": round(float(reg.sum()) * mpp * mpp, 3)})
if spec.get("depth"):
  # alpha: the depth of the surface the picture saw (tools/t05-hall.cjs ortho with "depth": true), grown a little into the
  # backdrop so the silhouette's edge keeps a depth; the shader lays the mask only on that surface (pMap in paint.js)
  d = np.asarray(Image.open(spec["depth"]).convert("L")).astype(np.float32)
  dbg = np.abs(d - d[0, 0]) < 1.5; idx = ndi.distance_transform_edt(dbg, return_distances=False, return_indices=True)
  out[..., 3] = d[idx[0], idx[1]].astype(np.uint8)
else:
  out[..., 3] = 255
assert len({z.get("ch", i) for i, z in enumerate(spec["channels"])}) <= 3, "the fourth channel is the depth (or 255)"
os.makedirs(os.path.dirname(spec["out"]), exist_ok=True)
Image.fromarray(out, "RGBA").save(spec["out"])
# a picture to look at: the normals with the mask laid over in red
if spec.get("preview"):
  pv = (img * 255).astype(np.float32)
  for c, col in ((0, (255, 40, 40)), (1, (255, 220, 0)), (2, (255, 40, 40))):
    a = out[..., c:c + 1].astype(np.float32) / 255; pv = pv * (1 - 0.55 * a) + np.array(col) * 0.55 * a
  Image.fromarray(pv.astype(np.uint8)).save(spec["preview"])
print(json.dumps(report, ensure_ascii=False))
