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
import json, sys, os, colorsys
import numpy as np
from PIL import Image

run = sys.argv[1]
rep = json.load(open(os.path.join(run, "report.json")))
shots = {s["name"]: s for s in rep["shots"]}
NAMES = ["kasyapa", "krakucchanda", "sikhin", "vipasyin", "visvabhu", "kanakamuni", "sakyamuni"]
FACE = "面与手（肤色）"
def hs(rgb):
  h, s, v = colorsys.rgb_to_hsv(*[c / 255 for c in rgb]); return round(h * 360, 1), round(s, 3)
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
    for k in ("衣缘描金", "背光", "座", "头光与光环"):
      if k in z and hd: o[k] = {"luma": z[k]["luma"], "ofHead": round(z[k]["luma"] / o["head_luma"], 2), "px": z[k]["px"]}
    out[tag][n] = o
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
  row("尊", "唇 sat", "颊 sat", "差", "唇 hue°", "唇亮/头亮", "唇亮/颊亮", "金/头", "背光/头"); row(*["---"] * 9)
  for n, o in out[tag].items():
    row(n, g(o, "lip", "hue_sat", default=["-", "-"])[1] if "lip" in o else "-", o["cheek"]["hue_sat"][1], o.get("lip_minus_cheek_sat", "-"), g(o, "lip", "hue_sat", default=["-", "-"])[0] if "lip" in o else "-", o.get("lip_over_head_luma", "-"), o.get("lip_over_cheek_luma", "-"), g(o, "衣缘描金", "ofHead"), g(o, "背光", "ofHead"))
if "--json" in sys.argv: json.dump(out, open(sys.argv[sys.argv.index("--json") + 1], "w"), ensure_ascii=False, indent=1)
