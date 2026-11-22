# L* readings across the stele's strokes in the 2 m first-person picture (#520, the first review's "must change"). The same picture is drawn twice, with the writing
# and without it (`__steleInk(false)`), and the difference is the writing alone: a stroke's centre against the plain stone beside it, and its upper and lower lip
# (three pixels above and below the centre, just outside the groove wall). Strokes taken are the horizontal ones (the difference stays under -2 L* for eight pixels along the row), where up and down
# are across the groove. Usage: python3 stroke3.py with.png without.png out_prefix
import sys, numpy as np
from PIL import Image
def lstar(rgb):
    c = rgb / 255.0; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    y = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)
a, b, out = sys.argv[1:4]
ia = Image.open(a).convert("RGB"); La = lstar(np.asarray(ia).astype(float)); Lb = lstar(np.asarray(Image.open(b).convert("RGB")).astype(float)); D = La - Lb
x0, x1, y0, y1 = 470, 810, 90, 620
print(f"the writing changes {np.mean(np.abs(D[y0:y1, x0:x1]) > 1.0) * 100:.1f}% of the face's pixels by more than 1 L*; the plain stone around it has median L* {np.median(Lb[y0:y1, x0:x1]):.1f}")
cand = []
for y in range(y0 + 4, y1 - 4):
    for x in range(x0, x1 - 10):
        run = D[y, x:x + 8]
        if run.max() < -2.0: cand.append((run.mean(), y, x))
cand.sort(); picked = []
for d, y, x in cand:
    if all(abs(y - py) > 12 or abs(x - px) > 40 for _, py, px in picked): picked.append((d, y, x))
    if len(picked) == 40: break
rows = []
for k, (d, y, x) in enumerate(picked):
    xs = slice(x, x + 8); col = D[y - 3:y + 4, xs].mean(1); yc = y - 3 + int(np.argmin(col))
    centre = D[yc, xs].mean(); up = D[yc - 3, xs].mean(); dn = D[yc + 3, xs].mean(); rows.append((centre, up, dn, La[yc, xs].mean(), Lb[yc, xs].mean()))
    if k < 3: print(f"stroke {k + 1} at ({x},{yc}): with writing {La[yc, xs].mean():.1f}, without {Lb[yc, xs].mean():.1f}: centre {centre:+.1f}, upper lip {up:+.1f}, lower lip {dn:+.1f}")
    if k < 3: ia.crop((x - 20, yc - 16, x + 30, yc + 16)).resize((300, 192), Image.NEAREST).save(f"{out}_{k + 1}.png")
r = np.array(rows); print(f"over {len(r)} horizontal strokes (median, 10th-90th): centre {np.median(r[:,0]):+.1f} ({np.percentile(r[:,0],10):+.1f} to {np.percentile(r[:,0],90):+.1f}), upper lip {np.median(r[:,1]):+.1f}, lower lip {np.median(r[:,2]):+.1f}; the deepest of a stroke is {np.median(r[:,3]-r[:,4]):+.1f} against the same place without it")
