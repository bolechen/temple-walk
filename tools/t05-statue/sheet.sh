#!/usr/bin/env bash
# Clay four-side sheet of one generated statue (issue #370's check that Tripo guessed the sides right): front, the
# figure's right, back, its left, plus the right and left hands from the front; Blender workbench, then one labelled JPEG.
#   tools/t05-statue/sheet.sh <in.glb> <out.jpg> [label]
set -e
IN="$1"; OUT="$2"; LABEL="${3:-$(basename "$IN")}"; TMP="$(mktemp -d)"
python3 tools/t05-statue/views.py "$IN" "$TMP" --turn=-90 --only=front,right,back,left,rhand-front,lhand-front --px=900 >/dev/null 2>&1
python3 - "$TMP" "$OUT" "$LABEL" <<'PY'
import sys
from PIL import Image, ImageDraw, ImageFont
d, out, label = sys.argv[1:4]
F = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 22)
n = [('front','正面'),('right','右侧'),('back','背面'),('left','左侧'),('rhand-front','右手'),('lhand-front','左手')]
S = 360; o = Image.new('RGB', (S*6, S+36), (24,22,20)); g = ImageDraw.Draw(o); g.text((8,6), label, font=F, fill=(255,210,120))
for i,(f,t) in enumerate(n):
  o.paste(Image.open(f'{d}/{f}.png').convert('RGB').resize((S,S)), (i*S, 36)); g.text((i*S+8, 40), t, font=F, fill=(230,220,200))
o.save(out, quality=82)
PY
rm -rf "$TMP"
