# L* of the boards over the light and 3 m from it, the top 80% median L*, and the lower half's share over 110 (8-bit luma).
import sys, json
from PIL import Image
def Lstar(rgb):
    def lin(c):
        c /= 255; return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in rgb); Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return 116 * Y ** (1 / 3) - 16 if Y > 0.008856 else 903.3 * Y
png, pts = sys.argv[1], json.load(open(sys.argv[2]))["px"]
im = Image.open(png).convert("RGB"); W, H = im.size; px = im.load()
def patch(x, y, r=6):
    v = [Lstar(px[i, j]) for i in range(max(0, x - r), min(W, x + r + 1)) for j in range(max(0, y - r), min(H, y + r + 1))]
    return sum(v) / len(v)
o = pts["over"]; offs = [p for p in pts["off"] if 0 <= p[0] < W and 0 <= p[1] < H]
over = patch(o[0], o[1]); off = sum(patch(p[0], p[1]) for p in offs) / len(offs)
small = im.resize((160, 90)); sp = small.load()
top80 = sorted(Lstar(sp[i, j]) for i in range(160) for j in range(72)); L50 = top80[len(top80) // 2]
g = im.convert("L"); gp = g.load(); n = t = 0
for j in range(H // 2, H, 4):
    for i in range(0, W, 4): t += 1; n += gp[i, j] > 110
print(json.dumps({"over": round(over, 1), "off3m": round(off, 1), "diff": round(over - off, 1), "top80_L50": round(L50, 1), "lower_gt110": round(100 * n / t, 1), "at": [o, offs]}))
