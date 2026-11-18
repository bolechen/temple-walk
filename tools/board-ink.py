#!/usr/bin/env python3
"""(A measuring tool only: since 2026-11-19 plaque.js writes the boards in Yuji Boku again and applies no evening; the owner had
seen black blocks over the characters, not uneven weight, and #207's change of face was not needed. FACE below is now Yuji Boku.)

Whether the characters of each name board are of one weight (#192).

    python3 tools/board-ink.py              the table, board by board; exits 1 if any board's characters disagree
    python3 tools/board-ink.py --json       the same as JSON (for the evidence of a pull request)
    python3 tools/board-ink.py --raw        the board face as it is, without the evening below
    python3 tools/board-ink.py --write      work out each character's evening and write app/src/board-weights.js
    python3 tools/board-ink.py --raw <font> another face measured in its place (to compare faces before choosing one)

A board written by one hand at one sitting is of one weight, and a reader sees that weight in two ways, depending on how
the board was made:

- A board set in a typeface (the board face, Yunjing Bang): the eye reads the breadth of the strokes. The face's
  designer made a crowded character with finer strokes and an open one with broader, more or less; where the two
  differ by much the board looks uneven (Yuji Boku's 茶 beside its 去, before #192). So the measure is the strokes'
  breadth down their middles: twice the distance from each point of a stroke's centre line (the ridge of a chamfer
  distance) to its nearest edge, the mean of the middle half of those over the character (between its first and third
  quartiles), so that its few broad joins and fine tips do not decide it.
- A board cut from a calligrapher's sheet (a hand, tools/boards.py): the brush makes its strokes as broad as each
  character needs, broad in an open one, fine in a crowded one, so that every character fills its frame as densely
  as the others. Its breadths differ widely (Wuzhun Shifan's 迦 is half again as broad as his 釋) and it still reads as
  one hand; what is even is its ink as a share of each character's own frame, the smallest box round what the brush laid
  down (Wuzhun's 釋迦寶殿: 43 to 47 per cent). So that is its measure.

A typeface held to the second measure fails it however even its strokes (its 大 and 江 are open and fill their frames
thinly), and broadening them until it passes makes them visibly heavier than their neighbours; so each kind of board is
held to its own. A board passes when its heaviest character is no more than SPREAD heavier than its lightest: 10 per
cent, set from the measurements (#192 proposed 15 and asked for it to be measured first). Wuzhun's board is 7.7 per
cent; Yuji Boku's 喫茶去, which the owner saw was uneven, 13 per cent (茶 the lightest), and 12 of its 19 boards fail.

The board face is evened a little, character by character (board-weights.js, written by --write): each is drawn with
its outline broadened or narrowed by a stroke so many hundredths of the type size wide, so that its strokes come to the
median breadth of all the boards' characters, within LIMIT. The board painter (app/src/plaque.js) draws it so; this tool
draws it the same way, the broadening as everything within half the stroke's width of the ink (a canvas stroke with
round joins), the narrowing as everything nearer the edge than that taken away.

The characters are the boards' as the board painter writes them (the old forms of OLD in plaque.js), found in the code
the same way tools/fonts.py finds what to cut.
"""
import glob, io, json, os, re, statistics, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SPREAD = 0.10        # how much heavier the heaviest character of a board may be than its lightest
LIMIT = 0.025        # the most a character is broadened or narrowed, in type sizes
CELL = 1024          # the square each character is measured in, in pixels
SIZE = int(CELL * 0.86)   # the type size in that square, as the board painter sets it
FACE = f"{ROOT}/app/shared/fonts/bang.woff2"
WEIGHTS = f"{ROOT}/app/src/board-weights.js"

def boards():
    """Every board's text in its old forms, and the picture of the hand it is cut from, if it is: [(text, hand or None)]."""
    every = "".join(open(p, encoding="utf-8").read() for p in glob.glob(f"{ROOT}/app/src/*.js") + [f"{ROOT}/app/yard.js"])
    old = dict(re.findall(r'(\S): "(\S)"', re.search(r'const OLD = \{([^}]*)\}', every).group(1)))
    hands = dict(re.findall(r'(\w+): "(levels/[^"]+\.webp)"', re.search(r'const HANDS = \{([^}]*)\}', every).group(1)))
    found = []
    for m in re.finditer(r'plaque: \{ text: (?:sx > 0 \? "(\S+)" : )?"(\S+)"([^}]*)\}', every):
        hand = re.search(r'hand: "(\w+)"', m.group(3))
        found += [(t, hand and hands.get(hand.group(1))) for t in filter(None, (m.group(1), m.group(2)))]
    for pattern in (r'plaque: "(\S+)"()', r'makePlaque\("(\S+)"([^)]*)\)', r'makeWallPanel\("(\S+)"([^)]*)\)'):
        for m in re.finditer(pattern, every):
            hand = re.search(r'hand: "(\w+)"', m.group(2))
            found.append((m.group(1), hand and hands.get(hand.group(1))))
    seen, out = set(), []
    for t, h in found:
        if t not in seen: seen.add(t); out.append(("".join(old.get(c, c) for c in t), h))
    return out

def face(path):
    f = TTFont(path); f.flavor = None; b = io.BytesIO(); f.save(b); b.seek(0)
    return ImageFont.truetype(b, SIZE)

def chamfer(ink, edge=0):
    """Distance from every inked point to the nearest bare one, in pixels (the 3-4 chamfer, two passes). `edge`: what lies
    beyond the square, bare (0) or, for the distance out from the ink, as far as anything."""
    h, w = ink.shape; d = np.pad(np.where(ink, 10 ** 6, 0).astype(np.int64), 1, constant_values=edge)
    for y in range(1, h + 1):
        row, up = d[y], d[y - 1]; row[1:-1] = np.minimum(row[1:-1], np.minimum(np.minimum(up[1:-1] + 3, up[:-2] + 4), up[2:] + 4))
        for x in range(1, w + 1):
            if row[x] > row[x - 1] + 3: row[x] = row[x - 1] + 3
    for y in range(h, 0, -1):
        row, dn = d[y], d[y + 1]; row[1:-1] = np.minimum(row[1:-1], np.minimum(np.minimum(dn[1:-1] + 3, dn[:-2] + 4), dn[2:] + 4))
        for x in range(w, 0, -1):
            if row[x] > row[x + 1] + 3: row[x] = row[x + 1] + 3
    return d[1:-1, 1:-1] / 3.0

def breadth(ink):
    """The strokes' breadth down their middles, in pixels: the mean of the middle half."""
    d = chamfer(ink); p = np.pad(d, 1)
    ridge = ink & (d >= 2) & np.all([d >= p[1 + dy: p.shape[0] - 1 + dy, 1 + dx: p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)], axis=0)
    if not ridge.any(): return 0.0
    v = d[ridge]; lo, hi = np.percentile(v, (25, 75)); mid = v[(v >= lo) & (v <= hi)]
    return 2 * float(mid.mean())

def density(ink):
    """The ink as a share of the character's own frame."""
    ys, xs = np.where(ink)
    return float(ink[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1].mean()) if len(ys) else 0.0

class Glyph:
    """One character as the board face draws it, which can be broadened or narrowed by any stroke."""
    def __init__(self, ch, font):
        im = Image.new("L", (CELL, CELL), 0); ImageDraw.Draw(im).text((CELL / 2, CELL / 2), ch, font=font, fill=255, anchor="mm")
        self.ink = np.asarray(im) > 127; self.inside = self.outside = None
    def even(self, w):
        r = abs(w) * SIZE / 2
        if r < 0.5: return self.ink
        if w > 0:
            if self.outside is None: self.outside = chamfer(~self.ink, 10 ** 6)
            return self.outside <= r
        if self.inside is None: self.inside = chamfer(self.ink)
        return self.inside > r

def cut(path, i):
    """The i-th character of a hand's picture: one square to a character, one under another, white where the brush went."""
    im = Image.open(f"{ROOT}/app/{path}").convert("RGBA"); w = im.width
    return np.asarray(im.crop((0, w * i, w, w * (i + 1))).getchannel("A").resize((CELL, CELL), Image.LANCZOS)) > 127

def evening():
    """Each character's evening as board-weights.js has it: {char: type sizes}."""
    if not os.path.exists(WEIGHTS): return {}
    return {k: float(v) for k, v in re.findall(r'"(\S)": (-?[0-9.]+)', open(WEIGHTS, encoding="utf-8").read())}

def measure(font_path=FACE, even=True):
    font = face(font_path); ev = evening() if even else {}; glyphs = {}; rows = []
    for text, hand in boards():
        chars = []
        for i, ch in enumerate(text):
            if hand: ink = cut(hand, i); w = None
            else:
                if ch not in glyphs: glyphs[ch] = Glyph(ch, font)
                w = ev.get(ch, 0); ink = glyphs[ch].even(w)
            chars.append({"char": ch, "breadth": round(breadth(ink) / CELL, 5), "density": round(density(ink), 4), "even": w})
        key = "density" if hand else "breadth"; ws = [c[key] for c in chars]
        spread = max(ws) / min(ws) - 1 if min(ws) > 0 else float("inf")
        rows.append({"board": text, "hand": hand, "measure": key, "chars": chars, "spread": round(spread, 4), "ok": spread <= SPREAD})
    return rows

def write(font_path=FACE):
    """Every character the face writes on a board, evened to the median breadth of them all."""
    font = face(font_path); chars = sorted({c for text, hand in boards() if not hand for c in text})
    glyphs = {c: Glyph(c, font) for c in chars}; raw = {c: breadth(g.ink) for c, g in glyphs.items()}; target = statistics.median(raw.values())
    out = {}
    for c, g in glyphs.items():   # the stroke that brings it to the median, found by halving (a stroke moves each edge by half its width)
        lo, hi = -LIMIT, LIMIT
        if breadth(g.even(hi)) <= target: out[c] = hi; continue
        if breadth(g.even(lo)) >= target: out[c] = lo; continue
        for _ in range(10):
            mid = (lo + hi) / 2
            if breadth(g.even(mid)) < target: lo = mid
            else: hi = mid
        out[c] = round((lo + hi) / 2, 4)
    body = ",\n".join(f'  "{c}": {out[c]}' for c in chars)
    open(WEIGHTS, "w", encoding="utf-8").write(
        "// How much broader or narrower each character on a name board is drawn than the board face draws it, in type sizes:\n"
        "// the width of a stroke drawn round its outline, or, less than nothing, taken off its edge. It brings the breadth of\n"
        f"// every character's strokes to the median of all of them, {target / CELL * 1000:.1f} thousandths of the cell, so that no character of a\n"
        "// board is written lighter or heavier than its neighbours. Written by tools/board-ink.py --write (#192).\n"
        "export const WEIGHT = {\n" + body + "\n};\n")
    print(f"wrote {os.path.relpath(WEIGHTS, ROOT)}: {len(chars)} characters;", "at the limit:", " ".join(f"{c} {v}" for c, v in out.items() if abs(v) >= LIMIT) or "none")

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--write" in sys.argv: write(*args); return
    rows = measure(*args, even="--raw" not in sys.argv)
    if "--json" in sys.argv: print(json.dumps(rows, ensure_ascii=False, indent=1))
    else:
        for r in rows:
            v = (lambda c: f"{c['density'] * 100:4.1f}%") if r["hand"] else (lambda c: f"{c['breadth'] * 1000:4.1f}")
            print(f"{'ok ' if r['ok'] else 'BAD'} {r['board']:6s} {'(' + os.path.basename(r['hand']) + ')' if r['hand'] else '':14s} spread {r['spread'] * 100:5.1f}%   "
                  + "  ".join(f"{c['char']} {v(c)}" for c in r["chars"]))
        print(f"a board set in the face: its strokes' breadth (thousandths of the cell); a board cut from a hand: its ink as a share of each "
              f"character's frame; a board passes when its heaviest character is at most {SPREAD * 100:.0f}% heavier than its lightest")
    sys.exit(0 if all(r["ok"] for r in rows) else 1)

if __name__ == "__main__":
    main()
