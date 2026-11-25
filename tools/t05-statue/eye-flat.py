# Flatten the baked normals round the eyes (issue #701, T05 lead 2026-11-25: the fine fringe along the lids and at the eye corners is the original's own,
# present in the full-detail mesh, and the 2048 normal map carries it to the reduced level, where it reads as radiating lines; the geometry and the lid
# line stay as they are, only the normal map is made flat round the eyes).
#
#   python3 tools/t05-statue/eye-flat.py <baked.glb> <anchors.json> <out.glb> [--ax=0.22] [--ay=0.11] [--soft=0.15] [--png=<out.png>] [--eyey=<eye height in the bowed mesh, metres>]
#
# baked.glb is face-build.py's <name>-<tag>b.60000.glb: a body and a head, each with its own tangent-space normal map. The anchors are the figure's
# paint anchors (eyeL, eyeR in the stage frame: metres, x across, y up from the seat). A point of the head's front within an ellipse (semi axes ax across, ay
# up, metres; 2 cm beyond the eye's own width and height) round either eye takes the flat normal (0.5, 0.5, 1); the weight eases from 1 at the ellipse
# to 0 at 1 + soft times its size, as smoothstep, interpolated over the triangles in the map's own UV space. Writes the glb with only the head's
# The eyes' height: the anchors' eyeL/eyeR carry the bow's lowering of the eye as the stage frame has it, which on the mesh puts them 0.2 m under the lids
# (found by drawing it); give --eyey, the bowed slit's height plus the lids' height over the slit measured by face-ratios.py, and the ellipse sits on the lids.
# normal image replaced (mesh, tangents, colours and the body's map untouched) and prints the share of texels changed.
import sys, os, json, subprocess, tempfile, io
import numpy as np, trimesh
from PIL import Image
args = [a for a in sys.argv[1:] if not a.startswith("--")]; opt = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
src, anchf, out = args; ax = float(opt.get("ax", 0.22)); ay = float(opt.get("ay", 0.11)); soft = float(opt.get("soft", 0.15))
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here))
A = json.load(open(anchf))["anchors"]
sc = trimesh.load(src, force="scene"); g = sc.geometry["head"]; v = np.asarray(g.vertices, float); uv = np.asarray(g.visual.uv, float); F = np.asarray(g.faces)
body = sc.geometry["body"]; H = max(v[:, 1].max(), body.vertices[:, 1].max()) - min(v[:, 1].min(), body.vertices[:, 1].min())
face = json.load(open(os.path.join(os.path.dirname(anchf), "..", "..", "t05-statue", os.path.basename(src).split("-")[0], "face.json"))) if False else None
height = float(opt.get("height", 0)) or None
# stage metres per file unit: the figure's stage height over the file's: given as --height, or read from face.json beside the figure's tools
if height is None:
  name = os.path.basename(src).split("-")[0]; fj = json.load(open(os.path.join(here, name, "face.json"))); height = fj["height"]
s = height / H
front = v[:, 2] > (v[:, 2].min() + v[:, 2].max()) / 2   # the front half of the head, so that the back of the head at the same height and width is left alone
w = np.zeros(len(v))
for k in ("eyeL", "eyeR"):
  ex, ey = A[k][0], (float(opt["eyey"]) if "eyey" in opt else A[k][1]); r = np.hypot((v[:, 0] * s - ex) / ax, (v[:, 1] * s - ey) / ay); t = np.clip(1 - (r - 1) / soft, 0, 1); w = np.maximum(w, np.where(front, t * t * (3 - 2 * t), 0))
im = g.visual.material.normalTexture if hasattr(g.visual.material, "normalTexture") else None
im = np.asarray(im.convert("RGB"), np.float32); Hh, Ww = im.shape[:2]
mask = np.zeros((Hh, Ww), np.float32)
for f in np.nonzero(w[F].max(1) > 0)[0]:
  p = uv[F[f]] * [Ww, Hh]; p[:, 1] = Hh - p[:, 1]   # glTF's v runs down the picture; trimesh returns it flipped for PIL-style images, so the picture's row is Hh - v*Hh
  lo = np.floor(p.min(0)).astype(int) - 1; hi = np.ceil(p.max(0)).astype(int) + 1; lo = np.maximum(lo, 0); hi = np.minimum(hi, [Ww, Hh])
  xs, ys = np.meshgrid(np.arange(lo[0], hi[0]) + 0.5, np.arange(lo[1], hi[1]) + 0.5); P = np.c_[xs.ravel(), ys.ravel()]
  a, b, c = p; d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
  if abs(d) < 1e-12: continue
  l1 = ((b[1] - c[1]) * (P[:, 0] - c[0]) + (c[0] - b[0]) * (P[:, 1] - c[1])) / d; l2 = ((c[1] - a[1]) * (P[:, 0] - c[0]) + (a[0] - c[0]) * (P[:, 1] - c[1])) / d; l3 = 1 - l1 - l2
  ins = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
  if not ins.any(): continue
  val = l1 * w[F[f, 0]] + l2 * w[F[f, 1]] + l3 * w[F[f, 2]]
  px = P[ins].astype(int); mask[px[:, 1], px[:, 0]] = np.maximum(mask[px[:, 1], px[:, 0]], np.clip(val[ins], 0, 1))
flat = np.array([127.5, 127.5, 255.0], np.float32)
new = im * (1 - mask[..., None]) + flat * mask[..., None]
png = io.BytesIO(); Image.fromarray(np.clip(new + 0.5, 0, 255).astype(np.uint8)).save(png, format="PNG", optimize=False)
tmp = tempfile.mkdtemp(); pp = opt.get("png") or os.path.join(tmp, "head-normal.png"); open(pp, "wb").write(png.getvalue())
subprocess.run(["node", os.path.join(here, "swap-normal.mjs"), src, pp, out, "statue-head"], check=True, cwd=root)
print(json.dumps({"texels_changed": int((mask > 0.001).sum()), "share": round(float((mask > 0.001).mean()), 4), "faces_in_zone": int((w[F].max(1) > 0).sum()), "out": out}))
