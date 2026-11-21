# The face measured on the repaired full-detail mesh (issue #463, the 3D review's measures), not on a reduced level:
#
#   python3 tools/t05-statue/face-measure.py <statue.glb> <points.json> [--profile=<out.png>]
#
# points.json, in the figure's stage frame (metres, x to the viewer's right, y up from the seat, z toward the viewer;
# the frame the paint anchors are written in) with `height`, the figure's height in metres on its seat:
#   { "height": 8.6, "mouth": [x, y], "cornerL": [x, y], "cornerR": [x, y], "noseBase": y, "chinFront": y,
#     "browKnit": [x, y], "w": mouth width m, "faceW": face width m }
# The surface is read by casting from the front (+z) through each (x, y). Prints:
#   lip      the upper lip's foremost point against the line from the base of the nose to the foremost point of the
#            chin, in the plane x = 0, signed (+ is out past the line), as a share of the mouth's width w
#   knit     the deepest hollow between the brows: in a window 0.25 w wide, the face's depth less its own blur over
#            0.15 w, as a share of the face's width
#   corners  the height of the two corners over the middle of the lower lip, as a share of w (≥ 0: not turned down)
# and, with --profile, draws the x = 0 profile with the line.
import sys, json, numpy as np, trimesh
from scipy import ndimage as ndi
glb, pts = sys.argv[1], json.load(open(sys.argv[2]))
prof = next((a.split("=", 1)[1] for a in sys.argv[3:] if a.startswith("--profile=")), None)
m = trimesh.load(glb, force="mesh")
v = m.vertices.copy(); mn, mx = v.min(0), v.max(0)
s = pts["height"] / (mx[1] - mn[1])                       # glTF: y up, z toward the viewer, as the stage frame
v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s; m.vertices = v
ray = trimesh.ray.ray_triangle.RayMeshIntersector(m)
def front(xy):
  xy = np.atleast_2d(np.asarray(xy, float)); o = np.c_[xy, np.full(len(xy), 20.0)]; d = np.tile([0, 0, -1.0], (len(xy), 1))
  loc, idx, _ = ray.intersects_location(o, d, multiple_hits=False); z = np.full(len(xy), np.nan); z[idx] = loc[:, 2]; return z
w, fw = pts["w"], pts["faceW"]
# the profile at x = 0, and on it, found from the mouth's height: the slit (the deepest point within 6 cm of it), the
# nose's tip (the foremost within 35 cm above), the base of the nose (the deepest between the slit and the tip), the
# upper lip (the foremost between the slit and the base of the nose) and the chin (the foremost 8–35 cm below)
my = pts["mouth"][1]
ys = np.arange(my - 0.45, my + 0.45, 0.003); zs = front(np.c_[np.zeros_like(ys), ys])
# a head bowed by repair.py's tilt is measured in its own frame: the profile turned back by `tilt` degrees about the slit's
# height first (the line measure itself does not care, but finding the lip by where the profile turns does)
tl = np.radians(pts.get("tilt", 0))
if tl:
  yc0, zc0 = my, float(np.nanmedian(zs)); dy, dz = ys - yc0, zs - zc0
  yr, zr = yc0 + dy * np.cos(tl) + dz * np.sin(tl), zc0 - dy * np.sin(tl) + dz * np.cos(tl)
  ok = ~np.isnan(zr); order = np.argsort(yr[ok]); zs = np.interp(ys, yr[ok][order], zr[ok][order])
def arg(fn, lo, hi): sel = (ys >= lo) & (ys <= hi); i = np.nonzero(sel)[0]; return int(i[fn(zs[i])])
islit = arg(np.nanargmin, my - 0.06, my + 0.06); itip = arg(np.nanargmax, ys[islit] + 0.05, my + 0.35)
# up from the slit: the upper lip is where the profile stops coming forward, the base of the nose where it starts again
# (a millimetre's give either way, so the mesh's facets do not count as turns)
ilip = islit
while ilip + 1 < itip and zs[ilip + 1] > zs[ilip] - 0.001: ilip += 1
ibase = ilip
while ibase + 1 < itip and zs[ibase + 1] < zs[ibase] + 0.001: ibase += 1
if ibase == ilip: ibase = min(ilip + 1, itip)
ichin = arg(np.nanargmax, my - 0.35, ys[islit] - 0.08)
A, Bp, L = np.array([ys[ibase], zs[ibase]]), np.array([ys[ichin], zs[ichin]]), np.array([ys[ilip], zs[ilip]])
t = Bp - A; nrm = np.array([-t[1], t[0]]) / np.linalg.norm(t)
if nrm[1] < 0: nrm = -nrm                                  # + toward the viewer
lip = float(np.dot(L - A, nrm)) / w
# the knit between the brows
bx, by = pts["browKnit"]; step = 0.005; half = 0.125 * w + 0.15 * w
gx = np.arange(bx - half, bx + half + 1e-9, step); gy = np.arange(by - half, by + half + 1e-9, step)
X, Y = np.meshgrid(gx, gy); Z = front(np.c_[X.ravel(), Y.ravel()]).reshape(X.shape)
Zf = np.where(np.isnan(Z), np.nanmean(Z), Z); low = Zf - ndi.gaussian_filter(Zf, 0.15 * w / step)
inner = (np.abs(X - bx) <= 0.125 * w) & (np.abs(Y - by) <= 0.125 * w)
knit = float(-low[inner].min()) / fw
# the corners (the slit's height at each, against the slit's middle)
def surf_y(x, y0):   # the corner's own height: the deepest crease across a vertical run at x, the slope of the cheek taken out
  yy = np.arange(y0 - 0.04, y0 + 0.04, 0.002); zz = front(np.c_[np.full_like(yy, x), yy]); ok = ~np.isnan(zz)
  k = np.polyfit(yy[ok], zz[ok], 1); return yy[ok][np.argmin(zz[ok] - np.polyval(k, yy[ok]))]
mid_low = float(ys[islit])   # the slit's middle
# (the corners are measured in the picture's frame: a bow of 10° moves a corner 25 cm off the middle by under 1 mm)
cL, cR = surf_y(*pts["cornerL"]), surf_y(*pts["cornerR"])
out = {"lip": round(lip, 3), "knit": round(knit, 4), "cornerL": round((cL - mid_low) / w, 3), "cornerR": round((cR - mid_low) / w, 3),
       "slit": round(float(ys[islit]), 3), "chin": [round(float(Bp[0]), 3), round(float(Bp[1]), 3)], "upperLip": [round(float(L[0]), 3), round(float(L[1]), 3)], "noseBase": [round(float(A[0]), 3), round(float(A[1]), 3)]}
print(json.dumps(out))
if prof:
  from PIL import Image, ImageDraw
  W = 600; Hh = 800; im = Image.new("RGB", (W, Hh), (24, 22, 20)); g = ImageDraw.Draw(im)
  y0, z0 = ys.min(), np.nanmin(zs); sc = min((Hh - 80) / (ys.max() - y0), (W - 80) / (np.nanmax(zs) - z0))
  P = lambda y, z: ((z - z0) * sc + 40, Hh - 40 - (y - y0) * sc)
  g.line([P(y, z) for y, z in zip(ys, zs) if not np.isnan(z)], fill=(230, 220, 200), width=2)
  g.line([P(*A), P(*Bp)], fill=(255, 120, 80), width=2); r = 5
  for q, c in ((A, (255, 120, 80)), (Bp, (255, 120, 80)), (L, (120, 200, 255))): x_, y_ = P(*q); g.ellipse([x_ - r, y_ - r, x_ + r, y_ + r], outline=c, width=2)
  g.text((10, 10), f"{glb.split('/')[-1]}  lip {out['lip']} w  knit {out['knit']}  corners {out['cornerL']}/{out['cornerR']}", fill=(255, 210, 120))
  im.save(prof)
