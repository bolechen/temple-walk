# The numbers #463's acceptance asks of the paint, read from one run of tools/t05-hall.cjs (specs/t05-paint-463.json):
#
#   python3 tools/t05-hall/paint-measure.py tools/out/t05/paint463/run [--json out.json]
#
# Colours are the mean sRGB on screen (0–255) of a zone's pixels (stage.js zoneIds: the pixels whose four neighbours show the
# same zone), or, for the cheeks, of a 17 × 17 px patch of the PNG at the point the shot's `probe` projected (a point a
# little outside each eye and half way down to the mouth, the figure's own frame). Hue is in degrees, saturation is HSV's
# (max − min) / max of the mean colour, brightness is Rec. 709 luma of it. "Head" is the face's skin inside the screen
# rectangle from the hairline to the chin and from ear to ear (zoneIds `头`), not the whole zone of face and hands.
# The lips are read against the lines the art director set in #480 (round 7, kept in round 8): the lip's luma 0.58–0.64 of the
# face's, its hue 12–16°, its saturation 0.10–0.15 above the cheek's. The first set of faces is under the hall's own light, the
# second (`face10d-*`) under a hemisphere light alone, which is how the art director read them.
import json, sys, os, colorsys, math
import numpy as np
from PIL import Image

run = sys.argv[1]
rep = json.load(open(os.path.join(run, "report.json")))
shots = {s["name"]: s for s in rep["shots"]}
NAMES = ["kasyapa", "krakucchanda", "sikhin", "vipasyin", "visvabhu", "kanakamuni", "sakyamuni"]
FACE = "面与手（肤色）"
def hs(rgb):
  h, s, v = colorsys.rgb_to_hsv(*[c / 255 for c in rgb]); return round(h * 360, 1), round(s, 3)
def lab(rgb):
  def lin(c): c /= 255; return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
  r, g, b = [lin(c) for c in rgb]
  X, Y, Z = .4124564 * r + .3575761 * g + .1804375 * b, .2126729 * r + .7151522 * g + .072175 * b, .0193339 * r + .119192 * g + .9503041 * b
  f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
  fx, fy, fz = f(X / .95047), f(Y), f(Z / 1.08883); return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)
def luma(rgb): return round(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2], 1)
def patch(name, key, r=8):
  s = shots[name]; png = np.asarray(Image.open(os.path.join(run, name + ".png")).convert("RGB")).astype(float)
  x, y = s["probe"][key]; x, y = int(round(x)), int(round(y))
  return png[max(y - r, 0):y + r + 1, max(x - r, 0):x + r + 1].reshape(-1, 3).mean(axis=0).tolist()
def head(z): return (z.get("头") or z.get(FACE))
out = {"cam03": {}, "cam06": {}, "face10": {}, "face10d": {}}
for view, key in (("cam03", "cam03-winter"), ("cam06", "cam06-winter")):
  if key not in shots or "zones" not in shots[key]: continue
  for i, n in enumerate(NAMES):
    z = shots[key]["zones"][i]; o = {}; hd = head(z)
    for k in ("胸衣", "内衣"):
      if k in z: o[k] = {"rgb": z[k]["rgb"], "hue_sat": hs(z[k]["rgb"]), "px": z[k]["px"]}
    if hd:
      o["head_luma"] = hd["luma"] if "luma" in hd else luma(hd["rgb"]); o["head_px"] = hd["px"]
      for k in ("衣缘描金", "座", "座上", "背光", "头光与光环"):
        if k in z: o[k] = {"luma": z[k]["luma"], "ofHead": round(z[k]["luma"] / o["head_luma"], 2), "px": z[k]["px"]}
    out[view][n] = o
for tag, pre in (("face10", "face10-"), ("face10d", "face10d-")):
  for i, n in enumerate(NAMES):
    sh = shots.get(pre + n)
    if not sh: continue
    z = sh["zones"][i]; o = {}; hd = head(z)
    ch = [patch(pre + n, k) for k in ("cheekL", "cheekR")]; cm = np.mean(ch, axis=0).tolist()
    o["cheek"] = {"rgb": [round(v, 1) for v in cm], "hue_sat": hs(cm), "luma": luma(cm)}
    if hd: o["head_luma"] = hd["luma"] if "luma" in hd else luma(hd["rgb"])
    if "唇" in z:
      o["lip"] = {"rgb": z["唇"]["rgb"], "hue_sat": hs(z["唇"]["rgb"]), "luma": luma(z["唇"]["rgb"]), "px": z["唇"]["px"]}
      o["lip_minus_cheek_sat"] = round(o["lip"]["hue_sat"][1] - o["cheek"]["hue_sat"][1], 3)
      o["lip_over_head_luma"] = round(o["lip"]["luma"] / o["head_luma"], 2) if hd else None
      o["lip_over_cheek_luma"] = round(o["lip"]["luma"] / o["cheek"]["luma"], 2)
      ref = (hd or {}).get("rgb") or o["cheek"]["rgb"]   # the art director's second round (#701): the lip 6–8 L* darker than the skin and 3–5 more chromatic
      (Ll, al, bl), (Lh, ah, bh) = lab(o["lip"]["rgb"]), lab(ref)
      o["lip_dL"] = round(Lh - Ll, 1); o["lip_dC"] = round(math.hypot(al, bl) - math.hypot(ah, bh), 1)
    for k in ("衣缘描金", "背光", "座", "头光与光环"):
      if k in z and hd: o[k] = {"luma": z[k]["luma"], "ofHead": round(z[k]["luma"] / o["head_luma"], 2), "px": z[k]["px"]}
    out[tag][n] = o
out["cam03_mouth"] = {}
for n in NAMES:
  sh = shots.get("cam03-lip-" + n)
  if not sh or "probe" not in sh: continue
  png = np.asarray(Image.open(os.path.join(run, sh["name"] + ".png")).convert("RGB")).astype(float)
  Y = 0.2126 * png[..., 0] + 0.7152 * png[..., 1] + 0.0722 * png[..., 2]
  from scipy.ndimage import uniform_filter
  Ys = uniform_filter(Y, 3); x, y = [int(round(v)) for v in sh["probe"]["lip"]]
  if not (40 <= x < Ys.shape[1] - 40 and 50 <= y < Ys.shape[0] - 20): out["cam03_mouth"][n] = {"off_screen": True}; continue   # an end figure's mouth can lie outside the frame
  # the face's box on the 1920 px cam03 (a face is about 42 px wide there): 14 px either side of the lip, 28 px above it (the eyes) and 8 below (the chin's start)
  x0, x1, y0, y1 = x - 14, x + 15, y - 28, y + 9; box = Ys[y0:y1, x0:x1]
  by, bx = np.unravel_index(np.argmin(box), box.shape)
  out["cam03_mouth"][n] = {"lip_min": round(float(Ys[y - 4:y + 5, x - 8:x + 9].min()), 1), "box_min": round(float(box.min()), 1), "box_min_at": [int(bx - 14), int(by - 28)], "lip_is_darkest": bool(abs(bx - 14) <= 8 and -32 <= by - 28 <= 4 and abs(box.min() - Ys[y - 4:y + 5, x - 8:x + 9].min()) < 1.5)}
def row(*c): print("| " + " | ".join(str(x) for x in c) + " |")
def g(d, *k, default="-"):
  for x in k:
    if not isinstance(d, dict) or x not in d: return default
    d = d[x]
  return d
for view in ("cam03", "cam06"):
  if not out[view]: continue
  print(f"\n**{view} (winter, no altar lamp): inner garment on screen; zones against the head**"); row("尊", "内衣/胸衣 hue°", "sat", "px", "金/头", "座上/头", "座下/头", "背光身/头", "头光盘/头", "头 px"); row(*["---"] * 10)
  for n, o in out[view].items():
    gm = o.get("内衣") or o.get("胸衣")
    row(n, gm["hue_sat"][0] if gm else "-", gm["hue_sat"][1] if gm else "-", gm["px"] if gm else "-", g(o, "衣缘描金", "ofHead"), g(o, "座上", "ofHead"), g(o, "座", "ofHead"), g(o, "背光", "ofHead"), g(o, "头光与光环", "ofHead"), o.get("head_px", "-"))
for tag, title in (("face10", "faceFrom10, the hall's light"), ("face10d", "faceFrom10, hemisphere light only")):
  if not out[tag]: continue
  print(f"\n**{title}: lips against the cheek and the head (the line: luma 0.58–0.64, hue 12–16°, saturation over the cheek 0.10–0.15)**")
  row("尊", "唇 sat", "颊 sat", "差", "唇 hue°", "唇亮/头亮", "唇亮/颊亮", "唇比头暗 L*", "唇比头浓 C", "金/头", "背光/头"); row(*["---"] * 11)
  for n, o in out[tag].items():
    row(n, g(o, "lip", "hue_sat", default=["-", "-"])[1] if "lip" in o else "-", o["cheek"]["hue_sat"][1], o.get("lip_minus_cheek_sat", "-"), g(o, "lip", "hue_sat", default=["-", "-"])[0] if "lip" in o else "-", o.get("lip_over_head_luma", "-"), o.get("lip_over_cheek_luma", "-"), o.get("lip_dL", "-"), o.get("lip_dC", "-"), g(o, "衣缘描金", "ofHead"), g(o, "背光", "ofHead"))
if out["cam03_mouth"]:
  print("\n**cam03 (1920 px): the darkest point in a 29 × 37 px box round each mouth (3 × 3 mean luma); is it the mouth?**"); row("尊", "唇处最暗", "盒内最暗", "盒内最暗处 (相对唇心 px)", "最暗是嘴吗"); row(*["---"] * 5)
  for n, o in out["cam03_mouth"].items(): row(n, *(["出画"] * 4 if o.get("off_screen") else [o["lip_min"], o["box_min"], o["box_min_at"], "是" if o["lip_is_darkest"] else "否"]))
if "--json" in sys.argv: json.dump(out, open(sys.argv[sys.argv.index("--json") + 1], "w"), ensure_ascii=False, indent=1)
