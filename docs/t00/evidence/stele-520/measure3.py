# Art-gate numbers for the stele's face in the 2 m first-person picture (#520, third pass): the band 0.6-2.0 m up the face, its lower fifth against its upper fifth
# in L*, and the spread of 48x48 blocks (the median of each block after the slow trend is taken out). Usage: python3 measure3.py front2m.png [vfov=65] [dist=1.815] [eye=1.3]
import sys, math
from PIL import Image
import numpy as np
def lstar(rgb):
    c = rgb / 255.0; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    y = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)
f = sys.argv[1]; vf = float(sys.argv[2]) if len(sys.argv) > 2 else 65.0; d = float(sys.argv[3]) if len(sys.argv) > 3 else 1.815; eye = float(sys.argv[4]) if len(sys.argv) > 4 else 1.3
im = np.asarray(Image.open(f).convert("RGB")).astype(float); H, W = im.shape[:2]; L = lstar(im)
t = math.tan(math.radians(vf / 2)); row = lambda y: H / 2 - (y - eye) / (d * t) * (H / 2)
r0, r1 = int(row(2.0)), int(row(0.6)); wpx = W / (2 * d * t * W / H)  # px per metre across at the face
cx = W / 2; x0, x1 = int(cx - 0.42 * wpx), int(cx + 0.42 * wpx)
band = L[r0:r1, x0:x1]; n = band.shape[0] // 5
up, low = band[:n].mean(), band[-n:].mean()
print(f"rows {r0}-{r1}, cols {x0}-{x1}: upper fifth L* {up:.1f}, lower fifth L* {low:.1f}, lower darker by {up - low:.1f}")
# 48x48 blocks: median of each, after the trend (a plane fitted to the block medians) is removed
bs = 48; ny, nx = band.shape[0] // bs, band.shape[1] // bs
med = np.array([[np.median(band[j * bs:(j + 1) * bs, i * bs:(i + 1) * bs]) for i in range(nx)] for j in range(ny)])
jj, ii = np.mgrid[0:ny, 0:nx]; A = np.c_[jj.ravel(), ii.ravel(), np.ones(ny * nx)]; coef = np.linalg.lstsq(A, med.ravel(), rcond=None)[0]
res = med.ravel() - A @ coef
print(f"{ny}x{nx} blocks, std of block medians after the trend {res.std():.2f} L*")
# flat colour: the share of the face whose 48x48 neighbourhood varies by under 1.5 L* (std)
flat = np.mean([[band[j * bs:(j + 1) * bs, i * bs:(i + 1) * bs].std() < 1.5 for i in range(nx)] for j in range(ny)])
print(f"flat blocks (std < 1.5 L*): {flat * 100:.0f}%")
