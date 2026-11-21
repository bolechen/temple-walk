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
px = lambda x, y: (int(round((x - x0) / mpp)), int(round((y1 - y) / mpp)))
out = np.zeros((H, W, 4), np.uint8)
report = {"file": os.path.basename(spec["out"]), "rect": spec["rect"], "z": spec.get("z", -99), "channels": []}
for ch, z in enumerate(spec["channels"]):
  bx0, by0 = px(z["box"][0], z["box"][3]); bx1, by1 = px(z["box"][2], z["box"][1])
  allow = np.zeros((H, W), bool); allow[max(by0, 0):min(by1, H), max(bx0, 0):min(bx1, W)] = True; allow &= ~bg
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
  m = ndi.gaussian_filter(reg.astype(np.float32), sigma=z.get("blur", 0.012) / mpp)
  out[..., ch] = np.clip(m * 255, 0, 255).astype(np.uint8)
  report["channels"].append({"zone": z["zone"], "pixels": int(reg.sum()), "area_m2": round(float(reg.sum()) * mpp * mpp, 3)})
out[..., 3] = np.maximum(out[..., 3], 0) if len(spec["channels"]) > 3 else 255   # alpha is a channel only when four are used
os.makedirs(os.path.dirname(spec["out"]), exist_ok=True)
Image.fromarray(out, "RGBA").save(spec["out"])
# a picture to look at: the normals with the mask laid over in red
if spec.get("preview"):
  pv = (img * 255).astype(np.uint8).copy(); a = out[..., 0:1].astype(np.float32) / 255
  pv = (pv * (1 - 0.55 * a) + np.array([255, 40, 40]) * 0.55 * a).astype(np.uint8); Image.fromarray(pv).save(spec["preview"])
print(json.dumps(report, ensure_ascii=False))
