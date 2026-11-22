# L* readings across the title's strokes (#520, the title's review): the same 3.75 m picture drawn with the writing and without it (`__steleInk(false)`); inside the frame the
# difference is the title alone. Reports the deepest of each stroke's middle against the same place without it, and the lit lower lip (the difference where it is positive).
# Usage: python3 title3.py with.png without.png out_prefix
import sys, numpy as np
from PIL import Image
def lstar(rgb):
    c = rgb / 255.0; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    y = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)
a, b, out = sys.argv[1:4]
ia = Image.open(a).convert("RGB"); La = lstar(np.asarray(ia).astype(float)); Lb = lstar(np.asarray(Image.open(b).convert("RGB")).astype(float)); D = (La - Lb)[40:170, 570:720]
Lw = Lb[40:170, 570:720]
cut = D < -2.0
print(f"the title changes {cut.sum()} pixels by more than 2 L* (of {D.size}); the stone round it has L* {np.median(Lw):.1f}")
ys, xs = np.nonzero(cut)
# strokes: the pixels that are local minima of the difference along a column over 3 pixels (a horizontal stroke's middle) and along a row (a vertical one's)
rows = []
for y, x in zip(ys, xs):
    if 2 <= y < D.shape[0] - 2 and 2 <= x < D.shape[1] - 2 and D[y, x] <= D[y - 1:y + 2, x - 1:x + 2].min() + 1e-9:
        rows.append((D[y, x], La[40 + y, 570 + x], Lb[40 + y, 570 + x]))
r = np.array(rows); print(f"{len(r)} stroke middles: the deepest of them {np.median(r[:, 0]):+.1f} L* against the same place without the title (10th-90th: {np.percentile(r[:,0],10):+.1f} to {np.percentile(r[:,0],90):+.1f}); with the title L* {np.median(r[:,1]):.1f}, plain stone {np.median(r[:,2]):.1f}")
lip = D[D > 0.8]; print(f"the lit lip: {len(lip)} pixels brighter than the stone by more than 0.8 L*: median {np.median(lip):+.1f}, 90th percentile {np.percentile(lip, 90):+.1f}")
# three horizontal strokes of the title (the quartiles of those found), taken like the body's (a run of eight pixels along a row where the difference is under -3 L*), with the lips two pixels above and below
picked = []
for y in range(3, D.shape[0] - 3):
    for x in range(0, D.shape[1] - 9):
        run = D[y, x:x + 8]
        if run.max() < -3.0 and all(abs(y - py) > 6 or abs(x - px) > 20 for _, py, px in picked): picked.append((run.mean(), y, x))
picked.sort(); picked = [picked[int(q * (len(picked) - 1))] for q in (0.25, 0.5, 0.75)]   # (a deep one, a middle one and a shallow one of the strokes found)
for k, (m, y, x) in enumerate(picked):
    col = D[y - 2:y + 3, x:x + 8].mean(1); yc = y - 2 + int(np.argmin(col)); xs = slice(x, x + 8)
    print(f"stroke {k + 1}: middle {D[yc, xs].mean():+.1f} L*, upper lip {D[yc - 3, xs].mean():+.1f}, lower lip {D[yc + 3, xs].mean():+.1f} (with the title: middle L* {La[40 + yc, 570 + x:570 + x + 8].mean():.1f}, plain stone {Lb[40 + yc, 570 + x:570 + x + 8].mean():.1f})")
    ia.crop((570 + x - 20, 40 + yc - 16, 570 + x + 30, 40 + yc + 16)).resize((300, 192), Image.NEAREST).save(f"{out}_stroke{k + 1}.png")
