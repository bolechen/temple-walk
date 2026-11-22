# The art director's §4 lines and #493's, read from a trial's pictures (tune.cjs) through the page's own cameras (frames.json).
import sys, json, numpy as np
from PIL import Image
D, cfg = sys.argv[1], sys.argv[2]; FR = json.load(open(f"{D}/frames.json"))
def lin(a): a = a / 255.; return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
def Yimg(v, small=False):
    im = Image.open(f"{D}/{cfg}-{v}.png").convert("RGB")
    if small: im = im.resize((160, 90), Image.BILINEAR)
    l = lin(np.asarray(im).astype(float)); return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]
def Ls(y): y = np.asarray(y); return np.where(y > 216 / 24389, 116 * np.cbrt(y) - 16, y * 24389 / 27)
def proj(v, p):
    f = FR[v]; yaw, pitch = f["look"]; e = np.array(f["eye"]); d = np.array(p, float) - e
    cy, sy, cp, sp = np.cos(yaw), np.sin(yaw), np.cos(pitch), np.sin(pitch)
    x1 = cy * d[0] - sy * d[2]; z1 = sy * d[0] + cy * d[2]           # undo the turn about y
    y2 = cp * d[1] + sp * z1; z2 = -sp * d[1] + cp * z1             # undo the tilt about x
    t = np.tan(np.radians(f["fov"]) / 2); W, H = 1280, 720
    return (x1 / -z2) / t / (W / H) * W / 2 + W / 2, H / 2 - (y2 / -z2) / t * H / 2
def rectY(v, pts):
    Y = Yimg(v); xy = np.array([proj(v, p) for p in pts]); x0, y0 = np.clip(xy.min(0), 0, [1279, 719]).astype(int); x1, y1 = np.clip(xy.max(0), 0, [1279, 719]).astype(int)
    return float(Y[y0:y1 + 1, x0:x1 + 1].mean())
def patchL(v, p, r=5):
    x, y = (int(round(c)) for c in proj(v, p)); Y = Yimg(v)
    if not (0 <= x < 1280 and 0 <= y < 720): return None
    return round(float(Ls(Y[max(0, y - r):y + r + 1, max(0, x - r):x + r + 1].mean())), 1)
def box(x0, x1, y0, y1, z0, z1): return [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
e = Ls(Yimg("e", True))[:72].ravel()
beam = [patchL("e", (s, 11.78, -9)) for s in (-3, 3)]; beam3 = [patchL("e", (s, 11.78, -12)) for s in (-3, 3)]
board, board3 = patchL("e", (0, 18.37, -9)), patchL("e", (0, 20.06, -12))
back = (float(Yimg("fig")[300:433, 433:467].mean()) + float(Yimg("fig")[300:433, 807:840].mean())) / 2
walls = {"front_faceon": rectY("front", box(-2, 2, 8.35, 8.85, -1.05, -1.05)), "ne_front": float(Yimg("ne")[220:280, 820:1020].mean()),
         "ne_east": rectY("ne", box(23.38, 23.38, 4, 7, -6, -3))}
door, pave = rectY("near", box(-1.5, 1.5, 4, 7, -0.05, -0.05)), rectY("near", box(-3, 3, 3.0, 3.0, 0.6, 1.6))
r = lambda v, n=3: round(v, n)
print(json.dumps({"cfg": cfg, "E_L50": r(float(np.percentile(e, 50)), 1), "E_spread": r(float(np.percentile(e, 95) - np.percentile(e, 5)), 1),
  "beam": beam, "beam_3m": beam3, "board": board, "board_3m": board3,
  "chest": r(rectY("chest", box(-0.6, 0.6, 9.6, 11.0, -15.9, -15.9))), "F_L95": r(float(np.percentile(Ls(Yimg("f", True)), 95)), 1),
  "back_low_L": r(float(Ls(back)), 1), "walls_L": {k: r(float(Ls(v)), 1) for k, v in walls.items()}, "max_wall_over_back": r(max(walls.values()) / back, 2),
  "near_door_over_paving": r(door / pave)}, ensure_ascii=False))
