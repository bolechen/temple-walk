# The numbers #463's acceptance asks of the paint, read from one run of tools/t05-hall.cjs (specs/t05-paint-463.json):
#
#   python3 tools/t05-hall/paint-measure.py tools/out/t05/paint463/run [--json out.json]
#
# Colours are the mean sRGB on screen (0–255) of a zone's pixels (stage.js zoneIds: the pixels whose four neighbours show the
# same zone), or, for the cheeks, of a 17 × 17 px patch of the PNG at the point the shot's `probe` projected (a point a
# little outside each eye and half way down to the mouth, the figure's own frame). Hue is in degrees, saturation is HSV's
# (max − min) / max of the mean colour, brightness is Rec. 709 luma of it.
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
out = {"cam03": {}, "face10": {}}
c3 = shots["cam03-winter"]["zones"]
for i, n in enumerate(NAMES):
  z = c3[i]; o = {}
  for k in ("胸衣", "内衣"):
    if k in z: o[k] = {"rgb": z[k]["rgb"], "hue_sat": hs(z[k]["rgb"]), "px": z[k]["px"]}
  for k in ("衣缘描金", "座", "座上", "背光", "头光与光环"):
    if k in z: o[k] = {"luma": z[k]["luma"], "ofFace": z[k]["ofFace"], "px": z[k]["px"]}
  if FACE in z: o["face_luma"] = z[FACE]["luma"]
  out["cam03"][n] = o
for i, n in enumerate(NAMES):
  sh = shots.get("face10-" + n)
  if not sh: continue
  z = sh["zones"][i]; o = {}
  if "唇" in z: o["lip"] = {"rgb": z["唇"]["rgb"], "hue_sat": hs(z["唇"]["rgb"]), "px": z["唇"]["px"]}
  ch = [patch("face10-" + n, k) for k in ("cheekL", "cheekR")]; cm = np.mean(ch, axis=0).tolist()
  o["cheek"] = {"rgb": [round(v, 1) for v in cm], "hue_sat": hs(cm), "luma": luma(cm)}
  if "lip" in o: o["lip_minus_cheek_sat"] = round(o["lip"]["hue_sat"][1] - o["cheek"]["hue_sat"][1], 3)
  for k in ("衣缘描金", "背光", "座", "头光与光环"):
    if k in z: o[k] = {"luma": z[k]["luma"], "ofFace": z[k]["ofFace"], "px": z[k]["px"]}
  if FACE in z: o["face_luma"] = z[FACE]["luma"]
  out["face10"][n] = o
def row(*c): print("| " + " | ".join(str(x) for x in c) + " |")
print("\n**cam03 (winter, no altar lamp): inner garment on screen, and zones against the face**"); row("尊", "内衣/胸衣 hue°", "sat", "px", "金/脸", "座上/脸", "座下/脸", "背光身/脸", "头光盘/脸"); row(*["---"] * 9)
for n, o in out["cam03"].items():
  g = o.get("内衣") or o.get("胸衣"); row(n, g["hue_sat"][0] if g else "-", g["hue_sat"][1] if g else "-", g["px"] if g else "-", o.get("衣缘描金", {}).get("ofFace", "-"), o.get("座上", {}).get("ofFace", "-"), o.get("座", {}).get("ofFace", "-"), o.get("背光", {}).get("ofFace", "-"), o.get("头光与光环", {}).get("ofFace", "-"))
print("\n**faceFrom10: lips against cheeks (HSV saturation), gold and halo against the face**"); row("尊", "唇 sat", "颊 sat", "差", "唇 hue°", "颊 hue°", "金/脸", "背光/脸"); row(*["---"] * 9)
for n, o in out["face10"].items():
  row(n, o.get("lip", {}).get("hue_sat", ["-", "-"])[1], o["cheek"]["hue_sat"][1], o.get("lip_minus_cheek_sat", "-"), o.get("lip", {}).get("hue_sat", ["-", "-"])[0], o["cheek"]["hue_sat"][0], o.get("衣缘描金", {}).get("ofFace", "-"), o.get("背光", {}).get("ofFace", "-"))
if "--json" in sys.argv: json.dump(out, open(sys.argv[sys.argv.index("--json") + 1], "w"), ensure_ascii=False, indent=1)
