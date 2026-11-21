# The head's outline seen from the side, two builds laid over each other (issue #463, the 3D review's fifth round: "add an
# r7/r8 overlay of the 3 m side view's outline").
#
#   python3 tools/t05-statue/profile-overlay.py <a.glb> <b.glb> [<c.glb> ...] <out.png> [--labels=r7,r8A,r8B] [--height=8.6]
#
# Each figure is stood 8.6 m tall (its own frame: y up from the seat, z toward the viewer). For every height over the
# head and neck the outline is the foremost point of the surface within a slab across the face (|x| < 0.55 m) and, as a
# second line, at the cheek (|x| between 0.2 and 0.45 m), so the lips' depth against the cheeks reads at a glance.
import sys, numpy as np, trimesh
from PIL import Image, ImageDraw
args = [x for x in sys.argv[1:] if not x.startswith("--")]; files, out = args[:-1], args[-1]
opt = dict(x[2:].split("=", 1) for x in sys.argv[1:] if x.startswith("--"))
labels = opt.get("labels", ",".join("abcdef"[:len(files)])).split(","); H = float(opt.get("height", 8.6))
def outline(p):
  m = trimesh.load(p, force="mesh"); v = m.vertices; mn, mx = v.min(0), v.max(0); s = H / (mx[1] - mn[1])
  v = (v - [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]) * s
  m.vertices = v; ray = trimesh.ray.ray_triangle.RayMeshIntersector(m); ys = np.arange(6.3, 7.9, 0.004)
  def front(xs):   # the foremost hit of lines cast straight back at each height, for each x, the most forward of them
    o = np.array([[x, y, 5.0] for y in ys for x in xs]); loc, idx, _ = ray.intersects_location(o, np.tile([0, 0, -1.0], (len(o), 1)), multiple_hits=False)
    z = np.full(len(o), np.nan); z[idx] = loc[:, 2]; return np.nanmax(z.reshape(len(ys), len(xs)), axis=1)
  mid = front(np.linspace(-0.05, 0.05, 5)); cheek = front(np.r_[np.linspace(-0.45, -0.2, 6), np.linspace(0.2, 0.45, 6)])
  return ys, np.array(mid), np.array(cheek)
# drawn at 1 px a millimetre: depth from −0.2 to 0.7 m across, height 6.3 to 7.9 m down
W, Hh = 900, 1600; img = Image.new("RGB", (W, Hh + 60), "white"); d = ImageDraw.Draw(img)
X = lambda z: (z + 0.2) * 1000; Y = lambda y: (7.9 - y) * 1000
for z in np.arange(-0.2, 0.71, 0.1): d.line([(X(z), 0), (X(z), Hh)], fill="#E6E6E6")
for y in np.arange(6.3, 7.91, 0.1): d.line([(0, Y(y)), (W, Y(y))], fill="#E6E6E6")
for k, (p, lab, col) in enumerate(zip(files, labels, ("#888888", "#B03A2E", "#2E6DB0", "#3A8A3A"))):
  ys, mid, cheek = outline(p)
  for line, wd in ((mid, 3), (cheek, 1)):
    pts = [(X(z), Y(y)) for y, z in zip(ys, line) if not np.isnan(z)]
    d.line(pts, fill=col, width=wd)
  d.text((10, Hh + 8 + 22 * k), f"{lab}: thick = middle (|x| < 6 cm), thin = cheek (|x| 0.2-0.45 m); grid 10 cm", fill=col)
img.save(out); print(out)
