# The one-page table for a figure of the six (issue #701): the r3c's upright face, the shipping pose, full against zoned, the seams as baked, and the hand, knee and lotus close-ups, in whole-views.py's workbench and seam-render.py's Cycles.
#
#   python3 tools/t05-statue/fig-sheet.py <name> <ver> <out.jpg> [<before.glb instead of -r3c.glb> [<look height of the hand view, stage m>]]
#
# Needs <name>-r3c.glb, <name>-<ver>.glb, -<ver>z.glb and -<ver>zb.glb in tools/out/t05/tripo-six (ship-fig.py makes them). Four columns, five rows; about fifteen minutes (the six Cycles views are most of it).
import sys, os, json, subprocess
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here)); O = f"{root}/tools/out/t05/tripo-six"; T = "/tmp/sheet-" + sys.argv[1]; os.makedirs(T, exist_ok=True)
name, ver, out = sys.argv[1:4]; ref = sys.argv[4] if len(sys.argv) > 4 else None; hand_look = sys.argv[5] if len(sys.argv) > 5 else "5.8"; face = json.load(open(f"{here}/{name}/face.json")); K = f"{here}/{name}/face.json"; m = face["features"]["mouth"][1]
def wv(src, tag, az, dist, h, look, lens): return ["python3", f"{here}/whole-views.py", src, f"{T}/{tag}", K, f"--az={az}", f"--dist={dist}", f"--h={h}", f"--look={look}", f"--lens={lens}"]
def sr(src, tag, look, az, lens, lx=0): return ["python3", f"{here}/seam-render.py", src, f"{T}/{tag}.png", str(look), K, f"--az={az}", f"--lx={lx}", f"--lens={lens}", "--samples=32"]
L = round(m + 0.61, 2); r3c = ref or f"{O}/{name}-r3c.glb"; full = f"{O}/{name}-{ver}.glb"; z = f"{O}/{name}-{ver}z.glb"; zb = f"{O}/{name}-{ver}zb.glb"
jobs = [wv(r3c, "r3c-lv", 0, 10, L, L, 220), wv(r3c, "r3c-up", 0, 10, 1.6, L, 220), wv(full, "f-up", 0, 10, 1.6, L, 220), wv(full, "f-sd", 55, 7, 1.6, L - 0.3, 140)]
for tag, src in (("f", full), ("z", z)):
  jobs += [wv(src, f"{tag}-a", 0, 10, 1.6, L, 220), wv(src, f"{tag}-b", 0, 10, 1.6, L + 0.15, 600), wv(src, f"{tag}-c", 55, 7, 1.6, L - 0.3, 140), wv(src, f"{tag}-d", 0, 10, 1.6, 5.2, 100)]
for tag, src in (("c", full), ("r", r3c)):
  jobs += [wv(src, f"{tag}-h1", -25, 4.5, 2.4, hand_look, 70), wv(src, f"{tag}-h2", 40, 5, 2.2, 4.0, 70), wv(src, f"{tag}-h3", 40, 5, 2.2, 3.0, 70)]
def run(j): subprocess.run(j, check=True, capture_output=True, cwd=root)
with ThreadPoolExecutor(4) as ex: list(ex.map(run, jobs))
cy = [sr(zb, "s-hair", round(m + 0.88, 2), 0, 300), sr(zb, "s-ear", round(m + 0.42, 2), 60, 300, 0.3), sr(zb, "s-neck", round(m - 0.38, 2), 30, 250)]
with ThreadPoolExecutor(3) as ex: list(ex.map(run, cy))
def im(tag, az=None):
  p = f"{T}/{tag}.png" if az is None else f"{T}/{tag}-az{az}.png"; return Image.open(p).convert("RGB").resize((350, 350))
grid = [[im("r3c-lv", 0), im("r3c-up", 0), im("f-up", 0), im("f-sd", 55)],
        [im("f-a", 0), im("f-b", 0), im("f-c", 55), im("f-d", 0)],
        [im("z-a", 0), im("z-b", 0), im("z-c", 55), im("z-d", 0)],
        [im("c-h1", -25), im("c-h2", 40), im("c-h3", 40), im("s-hair")],
        [im("s-ear"), im("s-neck"), im("r-h1", -25), im("r-h3", 40)]]
W = Image.new("RGB", (1400, 1750))
for i, row in enumerate(grid):
  for j, g in enumerate(row): W.paste(g, (j * 350, i * 350))
W.save(out, quality=80); print(out, os.path.getsize(out))
