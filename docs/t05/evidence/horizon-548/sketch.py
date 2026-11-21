# Sketches for issue #548: what stands above the wall tops of T05. Painted over real shots of the white box, with every
# thing placed in the level's own metres and projected through the shot's own camera, so sizes on screen are true.
import math, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

S = sys.argv[1]            # the folder holding the three base shots (a-east.png, terrace-wsw.png, arrive-west.png)
SS = 3                      # supersampling
W, H, FOV = 1280, 720, 52
F = (H / 2) / math.tan(math.radians(FOV / 2))
SKY = np.array([209, 214, 212], float)
HAZE = 700.0                # metres over which thin winter haze takes two thirds of a thing's own colour
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"

VIEWS = {
    "a-east": dict(pos=(0, 1.6, 44), yaw=1.571, pitch=0.05, label="院子里（A 站）朝东，眼高 1.6 米"),
    "terrace-wsw": dict(pos=(-10, 4.6, 10), yaw=-2.07, pitch=0.03, label="月台上朝西南，眼高 4.6 米"),
    "arrive-west": dict(pos=(0, 1.6, 215), yaw=-1.571, pitch=0.05, label="到达点朝西，眼高 1.6 米"),
}


def camera(v):
    cx, cy, cz = v["pos"]; yaw, pitch = v["yaw"], v["pitch"]
    fw = (math.sin(yaw), -math.cos(yaw)); rt = (math.cos(yaw), math.sin(yaw))
    cp, sp = math.cos(pitch), math.sin(pitch)

    def proj(x, y, z):
        dx, dy, dz = x - cx, y - cy, z - cz
        xr = dx * rt[0] + dz * rt[1]; zf = dx * fw[0] + dz * fw[1]
        zc = zf * cp + dy * sp; yc = -zf * sp + dy * cp
        if zc < 1: return None
        return ((W / 2 + F * xr / zc) * SS, (H / 2 - F * yc / zc) * SS, zc)
    return proj


def haze(col, d, k=1.0):
    a = 1 - math.exp(-d / HAZE * k)
    return tuple(int(round(c * (1 - a) + s * a)) for c, s in zip(col, SKY))


def bare_tree(dr, proj, x, z, h, rnd, col=(62, 56, 52)):
    p0 = proj(x, 0, z); p1 = proj(x, h, z)
    if not p0 or not p1: return
    d = p0[2]; px = (p0[1] - p1[1]) / h     # pixels to a metre here
    c = haze(col, d)

    def branch(x0, y0, ang, ln, w, depth):
        x1 = x0 + math.sin(ang) * ln * px; y1 = y0 - math.cos(ang) * ln * px
        dr.line([x0, y0, x1, y1], fill=c, width=max(1, int(round(w * px))))
        if depth == 0 or ln * px < 1.5: return
        for _ in range(rnd.choice([2, 2, 3])):
            branch(x1, y1, ang + rnd.uniform(-0.75, 0.75), ln * rnd.uniform(0.58, 0.8), w * 0.6, depth - 1)
    branch(p0[0], p0[1], rnd.uniform(-0.06, 0.06), h * 0.34, max(0.26, h * 0.03), 7)


def pine(dr, proj, x, z, h, rnd, col=(48, 60, 52)):
    p0 = proj(x, 0, z); p1 = proj(x, h, z)
    if not p0 or not p1: return
    d = p0[2]; px = (p0[1] - p1[1]) / h
    c = haze(col, d); t = haze((58, 50, 46), d)
    lean = rnd.uniform(-0.05, 0.05)
    dr.line([p0[0], p0[1], p0[0] + lean * h * px, p1[1] + 0.2 * h * px], fill=t, width=max(1, int(0.45 * px)))
    for i in range(rnd.choice([3, 4, 4])):        # the flat layers of an old Chinese pine, lumpy, with sky between them
        yy = p1[1] + (0.03 + i * 0.1) * h * px; span = rnd.uniform(0.2, 0.36) * h * px; ox = rnd.uniform(-0.16, 0.16) * h * px + lean * h * px
        for j in range(rnd.choice([3, 4, 5])):
            ww = rnd.uniform(0.3, 0.55) * span; hh = rnd.uniform(0.028, 0.05) * h * px
            bx = p0[0] + ox + rnd.uniform(-1, 1) * (span - ww); by = yy + rnd.uniform(-0.02, 0.02) * h * px
            dr.ellipse([bx - ww, by - hh, bx + ww, by + hh], fill=c)


def cypress(dr, proj, x, z, h, rnd, col=(44, 56, 50)):
    p0 = proj(x, 0, z); p1 = proj(x, h, z)
    if not p0 or not p1: return
    d = p0[2]; px = (p0[1] - p1[1]) / h; c = haze(col, d)
    w = rnd.uniform(0.13, 0.19) * h * px
    pts = [(p0[0] - w * 0.5, p0[1] - 0.18 * h * px), (p0[0] - w, p0[1] - 0.45 * h * px), (p0[0] - w * 0.55, p0[1] - 0.8 * h * px), (p0[0] + rnd.uniform(-0.2, 0.2) * w, p1[1]),
           (p0[0] + w * 0.6, p0[1] - 0.78 * h * px), (p0[0] + w, p0[1] - 0.42 * h * px), (p0[0] + w * 0.5, p0[1] - 0.18 * h * px)]
    dr.polygon(pts, fill=c)
    dr.line([p0[0], p0[1], p0[0], p0[1] - 0.2 * h * px], fill=haze((58, 50, 46), d), width=max(1, int(0.4 * px)))


def house(dr, proj, x, z, along, ln, eave, ridge, rnd, depth=6.0):
    # A single-storey house of grey brick under grey tiles, seen as its roof's long side or its gable; `along` is "z" or "x" for the ridge.
    tile = (92, 98, 100); wall = (118, 120, 117); dark = (60, 64, 66)
    if along == "z":
        a = [proj(x, eave, z - ln / 2 - 0.4), proj(x, ridge, z - ln / 2 + 0.2), proj(x, ridge, z + ln / 2 - 0.2), proj(x, eave, z + ln / 2 + 0.4)]
        b = [proj(x, 0, z - ln / 2), proj(x, eave, z - ln / 2), proj(x, eave, z + ln / 2), proj(x, 0, z + ln / 2)]
    else:
        a = [proj(x - depth / 2 - 0.5, eave, z), proj(x, ridge, z), proj(x + depth / 2 + 0.5, eave, z)]
        b = [proj(x - depth / 2, 0, z), proj(x - depth / 2, eave, z), proj(x + depth / 2, eave, z), proj(x + depth / 2, 0, z)]
    if any(p is None for p in a + b): return
    d = a[0][2]
    dr.polygon([(p[0], p[1]) for p in b], fill=haze(wall, d))
    dr.polygon([(p[0], p[1]) for p in a], fill=haze(tile, d))
    w = max(1, int(round(0.22 * F * SS / d)))
    if along == "z":
        dr.line([a[1][0], a[1][1], a[2][0], a[2][1]], fill=haze(dark, d), width=w)
        dr.line([a[0][0], a[0][1], a[3][0], a[3][1]], fill=haze(dark, d), width=w)
    else:
        dr.line([a[0][0], a[0][1], a[1][0], a[1][1], a[2][0], a[2][1]], fill=haze(dark, d), width=w)


def pagoda(dr, proj, x=-838, z=460, h=41.0):
    # The Liao brick pagoda at the old town's south-west corner: eight sides, thirteen close eaves (41 m before its repair).
    base = proj(x, 0, z); top = proj(x, h, z)
    if not base or not top: return
    d = base[2]; px = (base[1] - top[1]) / h; c = haze((92, 88, 82), d, 0.75)
    cx = base[0]
    pts_l, pts_r = [], []
    def lvl(y, hw): pts_l.append((cx - hw * px, base[1] - y * px)); pts_r.append((cx + hw * px, base[1] - y * px))
    lvl(0, 8.0); lvl(3.0, 8.0); lvl(3.0, 7.0); lvl(12.5, 6.6)
    y = 12.5
    for i in range(13):
        hw = 7.6 - i * 0.36
        lvl(y, hw); lvl(y + 0.5, hw); lvl(y + 0.5, hw - 1.1)
        y += 1.75
    lvl(y, 1.2); lvl(y + 1.2, 1.2); lvl(y + 1.2, 0.35); lvl(h, 0.1)
    dr.polygon(pts_l + pts_r[::-1], fill=c)


def hills(dr, proj_dir, seed, lo=0.25, hi=0.95, col=(120, 128, 132)):
    # A far band of low hills, given straight in angles: unverified from this town, drawn only to show how little of it a court sees.
    rnd = random.Random(seed); ph = [rnd.uniform(0, 6.28) for _ in range(5)]
    pts = []
    for sx in range(0, W * SS + 1, 6):
        az = (sx / SS - W / 2) / F
        e = lo + (hi - lo) * (0.5 + 0.28 * math.sin(az * 5 + ph[0]) + 0.14 * math.sin(az * 13 + ph[1]) + 0.08 * math.sin(az * 31 + ph[2]))
        pts.append((sx, proj_dir(e)))
    pts += [(W * SS, proj_dir(-0.3)), (0, proj_dir(-0.3))]
    dr.polygon(pts, fill=tuple(int(c * 0.14 + s * 0.86) for c, s in zip(col, SKY)))


def skymask(im):
    a = np.asarray(im.convert("RGB"), float); lum = a @ np.array([0.2126, 0.7152, 0.0722]); chroma = a.max(axis=2) - a.min(axis=2)
    thr = 172 + 24 * np.clip((np.arange(a.shape[0]) - 200) / 160, 0, 1)
    sky = (lum > thr[:, None]) & (chroma < 14)
    m = np.zeros(sky.shape, bool)
    for x in range(sky.shape[1]):
        col = sky[:, x]; run = 0; stop = len(col)
        for y in range(len(col)):
            run = run + 1 if not col[y] else 0
            if run >= 3: stop = y - 2; break
        m[:stop, x] = True
    return Image.fromarray((m * 255).astype(np.uint8)).resize((W * SS, H * SS), Image.BILINEAR)


def scene(name, plan):
    v = VIEWS[name]; proj = camera(v)
    base = Image.open(f"{S}/{name}.png").convert("RGB")
    if plan == "now": return base
    layer = Image.new("RGB", (W * SS, H * SS), tuple(int(c) for c in SKY)); alpha = Image.new("L", (W * SS, H * SS), 0)
    dr = ImageDraw.Draw(layer); da = ImageDraw.Draw(alpha)

    class Both:        # draw the same shape into the colour layer and into its coverage
        def polygon(self, pts, fill): dr.polygon(pts, fill=fill); da.polygon(pts, fill=255)
        def line(self, pts, fill, width=1): dr.line(pts, fill=fill, width=width); da.line(pts, fill=255, width=width)
        def ellipse(self, box, fill): dr.ellipse(box, fill=fill); da.ellipse(box, fill=255)
    d = Both()
    rnd = random.Random(548)
    things = []        # (distance, draw)
    cx, _, cz = v["pos"]
    def on_line(x, z, deg):        # within `deg` of the line from the terrace to the pagoda
        a1 = math.atan2(-838 + 10, 460 - 10); a2 = math.atan2(x + 10, z - 10)
        return x < 0 and abs(math.degrees(a1 - a2)) < deg
    def add(x, z, fn, tree=False):
        if tree and plan == "town" and on_line(x, z, 3.2): return
        things.append((math.hypot(x - cx, z - cz), fn))

    def horizon_y(e):  # screen row of an elevation in degrees, straight ahead
        return (H / 2 - F * math.tan(math.radians(e) - v["pitch"])) * SS

    if plan == "hills":
        hills(d, horizon_y, 7)
    if plan in ("trees", "town"):
        # Old pines and cypresses inside the precinct, between the court's walls and the precinct's edge, and along the way in.
        for side in (-1, 1):
            z = -36.0
            while z < 232:
                x = side * rnd.uniform(45.5, 51); hh = rnd.uniform(8.5, 13); k = rnd.random()
                if k < 0.5: add(x, z, lambda x=x, z=z, hh=hh, r=random.Random(rnd.random()): pine(d, proj, x, z, hh, r), True)
                elif k < 0.78: add(x, z, lambda x=x, z=z, hh=hh, r=random.Random(rnd.random()): cypress(d, proj, x, z, hh * 0.85, r), True)
                z += rnd.uniform(7, 15)
        # Bare trees of a northern town in early winter: a belt in the yards just beyond the precinct, then thinner out to the town.
        for side in (-1, 1):
            z = -110.0
            while z < 520:
                x = side * rnd.uniform(54, 78); hh = rnd.uniform(9, 17)
                add(x, z, lambda x=x, z=z, hh=hh, r=random.Random(rnd.random()): bare_tree(d, proj, x, z, hh, r), True)
                z += rnd.uniform(5, 13)
        for _ in range(260 if plan == "trees" else 170):
            side = rnd.choice((-1, 1)); x = side * rnd.uniform(80, 520); z = rnd.uniform(-160, 560); hh = rnd.uniform(8, 16)
            add(x, z, lambda x=x, z=z, hh=hh, r=random.Random(rnd.random()): bare_tree(d, proj, x, z, hh, r), True)
    if plan == "town":
        for side in (-1, 1):
            for row, x0 in enumerate([49, 58, 70, 84, 100, 120, 145, 175, 210, 250, 300, 360, 430, 520]):
                z = -110
                while z < 520:
                    ln = rnd.uniform(8, 15); gap = rnd.uniform(1.5, 9)
                    if rnd.random() < 0.82:
                        x = side * (x0 + rnd.uniform(-3, 3)); eave = rnd.uniform(2.8, 3.4); ridge = eave + rnd.uniform(2.2, 3.2)
                        along = "z" if rnd.random() < 0.7 else "x"
                        if on_line(x, z + ln / 2, 4.5) and abs(x) < 160: ridge = min(ridge, 5.0); eave = min(eave, 2.9)
                        add(x, z + ln / 2, lambda x=x, zc=z + ln / 2, along=along, ln=ln, eave=eave, ridge=ridge: house(d, proj, x, zc, along, ln, eave, ridge, rnd))
                    z += ln + gap
        things.append((940, lambda: pagoda(d, proj)))
    for _, fn in sorted(things, key=lambda t: -t[0]): fn()
    mask = Image.composite(alpha, Image.new("L", alpha.size, 0), skymask(base))
    layer = layer.resize((W, H), Image.LANCZOS); mask = mask.resize((W, H), Image.LANCZOS)
    out = base.copy(); out.paste(layer, (0, 0), mask)
    return out


PLANS = [("now", "现在：墙头以上只有天"), ("trees", "甲 只放树：寺里的古松柏，墙外落了叶的树"), ("town", "乙 县城低屋＋树＋西南隅的辽塔（推荐）"), ("hills", "丙 远山影（未核实，仅示意）")]
cw, ch = 800, 450
sheet = Image.new("RGB", (cw * 2, (ch + 34) * 2 * len(VIEWS) + 8), (24, 24, 24))
ds = ImageDraw.Draw(sheet); f1 = ImageFont.truetype(FONT, 20)
for r, name in enumerate(VIEWS):
    for i, (plan, title) in enumerate(PLANS):
        im = scene(name, plan); im.save(f"{S}/out-{name}-{plan}.png")
        x = (i % 2) * cw; y = (r * 2 + i // 2) * (ch + 34)
        sheet.paste(im.resize((cw, ch), Image.LANCZOS), (x, y + 34))
        ds.text((x + 8, y + 6), f"{VIEWS[name]['label']}　｜　{title}", fill=(235, 230, 215), font=f1)
sheet.save(f"{S}/options-548.jpg", quality=86)
print(sheet.size)
