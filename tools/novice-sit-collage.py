#!/usr/bin/env python3
"""The seated novice beside the design sheet at one scale (#664).

  node tools/novice-views.cjs --code --poses=sit --sides=平正,平右 --size=440,640 --out=tools/out/novice-sit/pair.png
  node tools/novice-sit-iou.mjs
  python3 tools/novice-sit-collage.py tools/out/novice-sit/pair.png tools/out/novice-sit tools/out/novice-sit/collage.jpg [caption]

Top row: the sheet's cross-legged figure from the front and from his side (refs/monk-poses-v6-2026-11-23-sitting.webp).
Middle row: the figure built in code, drawn on the bare stage from the same two sides, brought to the sheet's scale
(the stage draws 420 px to the metre; the sheet's scale is the one tools/novice-sit-iou.mjs found, in its report.json).
Bottom row: the two outlines laid over each other (white both, red only ours, green only the sheet's) with the overlap.
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

pair, iou_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
caption = sys.argv[4] if len(sys.argv) > 4 else ""
STAGE = 640 / (2 * 3.3 * 0.2308682)          # the stage's camera: 26° over 640 px from 3.3 m
report = json.load(open(f"{iou_dir}/report.json"))
sheet = Image.open("refs/monk-poses-v6-2026-11-23-sitting.webp").convert("RGB")
panels = {"front": sheet.crop((230, 0, 630, 440)), "side": sheet.crop((900, 0, 1300, 440))}
views = Image.open(pair).convert("RGB")
CW = (views.width - 60) // 2   # two cells beside the row's label, under the title bar
cells = {"front": views.crop((60, 48, 60 + CW, 688)), "side": views.crop((60 + CW, 48, 60 + 2 * CW, 688))}
W, H, PAD = 400, 440, 8
font = None
for f in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", "/System/Library/Fonts/PingFang.ttc"]:
    try: font = ImageFont.truetype(f, 18); break
    except OSError: pass
font = font or ImageFont.load_default()
sheet_out = Image.new("RGB", (2 * W + 3 * PAD, 3 * H + 4 * PAD + 34), (20, 20, 20))
d = ImageDraw.Draw(sheet_out)
for i, name in enumerate(["front", "side"]):
    x = PAD + i * (W + PAD)
    sheet_out.paste(panels[name], (x, PAD))
    k = report[name]["pxPerMetre"] / STAGE
    c = cells[name]; c = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
    # the stage looks at 0.35 m over the seat, in the middle of its picture; the sheet's seat is near row 380 of its panel
    cx, cy = c.width // 2, c.height // 2 + round(0.35 * report[name]["pxPerMetre"])
    box = (cx - W // 2, cy - 372, cx + W // 2, cy - 372 + H)
    sheet_out.paste(c.crop(box), (x, 2 * PAD + H))
    o = Image.open(f"{iou_dir}/{name}.png").convert("RGB")
    cell = Image.new("RGB", (W, H), (24, 24, 24)); cell.paste(o, ((W - o.width) // 2, (H - o.height) // 2))
    sheet_out.paste(cell, (x, 3 * PAD + 2 * H))
    d.text((x + 8, 3 * PAD + 2 * H + 6), f"IoU {report[name]['iou']:.3f}", fill=(255, 255, 255), font=font)
d.text((PAD + 8, PAD + 6), "设定图", fill=(255, 255, 255), font=font)
d.text((PAD + 8, 2 * PAD + H + 6), "代码身体（同一比例）", fill=(255, 255, 255), font=font)
d.text((PAD, 3 * H + 4 * PAD + 4), caption, fill=(220, 220, 220), font=font)
sheet_out.save(out, quality=88)
print("wrote", out, sheet_out.size)
