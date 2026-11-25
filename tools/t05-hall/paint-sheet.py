# One collage for #463's paint round, from a run of tools/t05-hall.cjs (specs/t05-paint-463.json), under 1 MB:
#
#   python3 tools/t05-hall/paint-sheet.py tools/out/t05/paint463/run tools/out/t05/paint463/collage.jpg
#
# Top: the seven fronts, each the concept picture over the painted figure (refs/t05-concept-*, the six of 2026-11-21 and
# Śākyamuni's of 2026-11-20); then cam03 and cam04 (winter, no altar lamp); then the seven faceFrom10 (the face's middle, cropped).
import sys, os
from PIL import Image
run, out = sys.argv[1], sys.argv[2]
N = ["kasyapa", "krakucchanda", "sikhin", "vipasyin", "visvabhu", "kanakamuni", "sakyamuni"]
R = ["refs/t05-concept-2026-11-21/%02d-%s-front.webp" % (i + 1, n) for i, n in enumerate(N[:6])] + ["refs/t05-concept-2026-11-20/04-shakyamuni-front.webp"]
C, BG = 260, (32, 30, 28)
sh = Image.new("RGB", (C * 7, C * 2 + 512 + C), BG)
for i, (n, r) in enumerate(zip(N, R)):
  a = Image.open(r).convert("RGBA"); bg = Image.new("RGBA", a.size, BG + (255,)); bg.alpha_composite(a)
  sh.paste(bg.convert("RGB").resize((C, C), Image.LANCZOS), (i * C, 0))
  b = Image.open(os.path.join(run, "front-%s.png" % n)).convert("RGB"); w, h = b.size; s = min(w, h)
  sh.paste(b.crop(((w - s) // 2, 0, (w - s) // 2 + s, s)).resize((C, C), Image.LANCZOS), (i * C, C))
  f = Image.open(os.path.join(run, "face10-%s.png" % n)).convert("RGB"); w, h = f.size
  sh.paste(f.crop((w // 2 - 450, 0, w // 2 + 450, h)).resize((C, int(C * h / 900))).crop((0, 0, C, C)), (i * C, C * 2 + 512))
half = C * 7 // 2
for k, n in enumerate(("cam03-winter", "cam04-winter")):
  sh.paste(Image.open(os.path.join(run, n + ".png")).convert("RGB").resize((half, 512 * 1)), (k * half, C * 2)) if False else sh.paste(Image.open(os.path.join(run, n + ".png")).convert("RGB").resize((half, int(half * 9 / 16))), (k * half, C * 2))
sh.save(out, quality=84, optimize=True); print(out, os.path.getsize(out) // 1024, "KB", sh.size)
