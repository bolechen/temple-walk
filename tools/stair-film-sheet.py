#!/usr/bin/env python3
"""Sets tools/stair-film.cjs's pictures side by side, before over after, following camera and side view, and makes the
films (2x2, 7.5 pictures a second) and one collage of six frames a clip.
  python3 tools/stair-film-sheet.py [dir] [--secs=5]"""
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
font = ImageFont.truetype(next(p for p in ("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", "/usr/share/fonts/opentype/unifont/unifont_jp.otf") if os.path.exists(p)), 13)   # any face with Chinese in it
d = next((a for a in sys.argv[1:] if not a.startswith("--")), "tools/out/stair-film")
secs = float(next((a[7:] for a in sys.argv if a.startswith("--secs=")), 5))
names = {"hill": "山路长阶", "hall": "大殿前", "summit": "凌霄阁前"}; dirs = {"up": "上", "down": "下"}
n = int(secs * 7.5); W, H = 400, 260; tw, th = 200, 130
rows = []
for pid in ("hill", "hall", "summit"):
    for dr in ("up", "down"):
        runs = [(v, k) for v in ("follow", "side") for k in ("before", "after")]
        pic = lambda k, v, i: Image.open(f"{d}/{k}-{pid}-{dr}/{v}-{i:03d}.png").convert("RGB")
        have = len([f for f in os.listdir(f"{d}/before-{pid}-{dr}") if f.startswith("follow")])
        m = min(n, have)
        # the film: before | after on top (following camera), the same two from the side below
        fdir = f"{d}/film-{pid}-{dr}"; os.makedirs(fdir, exist_ok=True)
        for i in range(m):
            g = Image.new("RGB", (2 * W, 2 * H))
            for c, k in enumerate(("before", "after")):
                for r, v in enumerate(("follow", "side")):
                    g.paste(pic(k, v, i), (c * W, r * H))
            dd = ImageDraw.Draw(g); dd.text((6, 4), "改前", fill="white", font=font); dd.text((W + 6, 4), "改后", fill="white", font=font); dd.text((6, H + 4), "侧", fill="white", font=font)
            g.save(f"{fdir}/{i:03d}.png")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "7.5", "-i", f"{fdir}/%03d.png", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", f"{d}/{pid}-{dr}.webm"], check=True)
        # the collage rows: six frames, evenly, before / after following; before / after side
        pick = [round(j * (m - 1) / 5) for j in range(6)]
        for r, (v, k) in enumerate((("follow", "before"), ("follow", "after"), ("side", "before"), ("side", "after"))):
            rows.append((f"{names[pid]}·{dirs[dr]}·{'跟拍' if v=='follow' else '侧'}·{'改前' if k=='before' else '改后'}", [pic(k, v, i).resize((tw, th)) for i in pick]))
sheet = Image.new("RGB", (150 + 6 * tw, len(rows) * th), (17, 17, 17)); dd = ImageDraw.Draw(sheet)
for r, (lab, imgs) in enumerate(rows):
    dd.text((4, r * th + th // 2), lab, fill=(220, 220, 220), font=font)
    for c, im in enumerate(imgs): sheet.paste(im, (150 + c * tw, r * th))
sheet.save(f"{d}/stair-film-collage.jpg", quality=68, optimize=True); print("collage", os.path.getsize(f"{d}/stair-film-collage.jpg"))
