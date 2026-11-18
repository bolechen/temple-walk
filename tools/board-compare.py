#!/usr/bin/env python3
"""Candidate faces for the name boards, drawn on the same five boards and measured as tools/board-ink.py measures (#192).

    python3 tools/board-compare.py <fontdir> <out.jpg> [--raw] [--json <report.json>]   (--raw: no evening)

<fontdir> holds the candidates (names in CANDIDATES below; none of them is committed, the script says where each comes from).
Each face is drawn the way plaque.js draws the board face: every character evened to the median breadth of all the
boards' characters in that face (board-ink.py's Glyph.even and breadth, the same LIMIT), then set on the board's ground.
The picture is a sheet for the owner to choose from; nothing here changes what the page draws.

Boards shown: gold ground, black characters (正法眼藏, 萬年正續); the gilt characters set straight into the grey brick of the
screen wall (雙徑歸堂); black ground, gold characters (喫茶去, 雲徑禪寺).
"""
import importlib.util, io, json, os, sys, statistics
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("ink", f"{HERE}/board-ink.py"); ink = importlib.util.module_from_spec(spec); spec.loader.exec_module(ink)

try:   # the same 3-4 chamfer as board-ink.py, compiled: the loops there take seconds a character, and this measures every character many times over
    from numba import njit
    @njit(cache=True)
    def _pass(d):
        h, w = d.shape
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                v = min(d[y, x], d[y - 1, x] + 3, d[y - 1, x - 1] + 4, d[y - 1, x + 1] + 4, d[y, x - 1] + 3); d[y, x] = v
        for y in range(h - 2, 0, -1):
            for x in range(w - 2, 0, -1):
                v = min(d[y, x], d[y + 1, x] + 3, d[y + 1, x - 1] + 4, d[y + 1, x + 1] + 4, d[y, x + 1] + 3); d[y, x] = v
    def _chamfer(ink_, edge=0):
        d = np.pad(np.where(ink_, 10 ** 6, 0).astype(np.int64), 1, constant_values=edge); _pass(d); return d[1:-1, 1:-1] / 3.0
    ink.chamfer = _chamfer
except ImportError:
    pass

# (label, file, licence, where it comes from, evening limit in type sizes, breadth to even to: None = the face's own median)
SOURCES = "google/fonts (ofl/…) on GitHub"
CANDIDATES = [
    ("A  Yuji Boku（Syuku、Mai 的汉字与它逐点相同）", "ofl_yujiboku_YujiBoku-Regular.ttf", "OFL 1.1，无保留名", SOURCES, ink.LIMIT, None),
    ("B1 Kaisei Tokumin Bold", "ofl_kaiseitokumin_KaiseiTokumin-Bold.ttf", "OFL 1.1，无保留名", SOURCES, ink.LIMIT, None),
    ("B2 Potta One", "PottaOne-Regular.ttf", "OFL 1.1，无保留名", SOURCES, ink.LIMIT, None),
    ("B3 全字庫正楷體", "TW-Kai-98_1.ttf", "政府资料开放授权 v1.0 / OFL 1.1 双许可", "data.cns11643.gov.tw (Debian fonts-cns11643-kai)", 0.06, 0.058),
    ("C  霞鹜文楷 TC 粗体（#207 起线上，拟撤）", "lxgw-bang.woff2", "OFL 1.1，原名为保留名（已改名 Yunjing Bang）", "npm @fontsource/lxgw-wenkai-tc (the bang.woff2 of #207)", ink.LIMIT, None),
]
BOARDS = [("正法眼藏", "gold"), ("萬年正續", "gold"), ("雙徑歸堂", "brick"), ("喫茶去", "ink"), ("雲徑禪寺", "ink")]
GROUND = {"gold": ((163, 133, 63), (134, 105, 47), (21, 16, 11)), "ink": ((25, 22, 19), (34, 29, 25), (179, 150, 79)),
          "brick": ((122, 120, 113), (104, 102, 96), (200, 170, 92))}
CELL_OUT = 112

def evened(font_path, limit, target_override):
    """Every character the boards write, with the stroke that brings its breadth to the median (or to `target_override`)."""
    font = ink.face(font_path); chars = sorted({c for t, h in ink.boards() if not h for c in t})
    glyphs = {c: ink.Glyph(c, font) for c in chars}; raw = {c: ink.breadth(g.ink) for c, g in glyphs.items()}
    target = target_override * ink.CELL if target_override else statistics.median(raw.values()); out = {}
    for c, g in glyphs.items():
        lo, hi = -limit, limit
        if ink.breadth(g.even(hi)) <= target: out[c] = hi; continue
        if ink.breadth(g.even(lo)) >= target: out[c] = lo; continue
        for _ in range(10):
            mid = (lo + hi) / 2
            if ink.breadth(g.even(mid)) < target: lo = mid
            else: hi = mid
        out[c] = (lo + hi) / 2
    return glyphs, raw, out, target

def spreads(glyphs, w):
    rows = []
    for text, hand in ink.boards():
        if hand: continue
        b = [ink.breadth(glyphs[c].even(w.get(c, 0))) for c in text]; rows.append((text, max(b) / min(b) - 1))
    return rows

def raw_spreads(glyphs):
    return spreads(glyphs, {})

def main():
    src, out = sys.argv[1], sys.argv[2]; report = {}
    twb = open_font(f"{src}/TW-Kai-98_1.ttf"); label_font = ImageFont.truetype(io.BytesIO(twb), 26); small = ImageFont.truetype(io.BytesIO(twb), 20)   # a face that has every character the labels use
    even_note = "" if "--raw" in sys.argv else "，按字补墨"
    gap, label_w = 22, 0
    nchars = sum(len(t) for t, _ in BOARDS); W = nchars * CELL_OUT + (len(BOARDS) + 1) * gap + len(BOARDS) * 36
    rowh = CELL_OUT + 36 + 36 + 62; H = rowh * len(CANDIDATES) + 20
    sheet = Image.new("RGB", (W, H), (236, 228, 210)); d = ImageDraw.Draw(sheet)
    for r, (label, fname, lic, whence, limit, tgt) in enumerate(CANDIDATES):
        path = f"{src}/{fname}"
        if "--raw" in sys.argv: limit, tgt = 0, None   # the faces as they are, with no evening: the standard is now likeness to the Song hand, not evenness
        glyphs, raw, w, target = evened(path, limit, tgt)
        board_sp = dict(spreads(glyphs, w)); raw_sp = dict(raw_spreads(glyphs))
        mine = [board_sp[t] for t, _ in BOARDS]; fails = sum(1 for v in board_sp.values() if v > ink.SPREAD)
        report[label] = {"file": fname or "lxgw-bang.woff2", "licence": lic, "from": whence, "breadth_per_mille": round(target / ink.CELL * 1000, 1),
                         "five_boards_spread_pct": {t: round(board_sp[t] * 100, 1) for t, _ in BOARDS}, "five_boards_raw_spread_pct": {t: round(raw_sp[t] * 100, 1) for t, _ in BOARDS},
                         "all_boards_failing": fails, "all_boards": len(board_sp), "evening_at_limit": sorted(c for c, v in w.items() if abs(v) >= limit - 1e-4)}
        y0 = 10 + r * rowh; x = gap
        d.text((gap, y0), f"{label}{even_note}    {lic}    笔画宽 {target / ink.CELL * 1000:.0f}‰", font=label_font, fill=(40, 30, 20))
        for text, kind in BOARDS:
            bw = len(text) * CELL_OUT + 36; top, foot, col = GROUND[kind]
            tile = Image.new("RGB", (bw, CELL_OUT + 36), top); td = ImageDraw.Draw(tile)
            for yy in range(tile.height): td.line([(0, yy), (bw, yy)], fill=tuple(int(top[k] + (foot[k] - top[k]) * yy / tile.height) for k in range(3)))
            for i, ch in enumerate(text):
                m = Image.fromarray((glyphs[ch].even(w.get(ch, 0)) * 255).astype(np.uint8)).resize((CELL_OUT, CELL_OUT), Image.LANCZOS)
                cx = 18 + i * CELL_OUT
                if kind != "gold":   # the cut relief a gilt character has: a dark edge below and to the right, a bright one above
                    for dx, dy, c in ((2, 3, (0, 0, 0)), (-1, -1, (226, 204, 138))):
                        tile.paste(Image.new("RGB", m.size, c), (cx + dx, 18 + dy), m)
                tile.paste(Image.new("RGB", m.size, col), (cx, 18), m)
            sheet.paste(tile, (x, y0 + 36)); x += bw + gap
            d.text((x - gap - bw, y0 + 36 + CELL_OUT + 38), f"{text} 差 {board_sp[text] * 100:.1f}%", font=small, fill=(60, 45, 30))
        d.text((gap, y0 + 36 + CELL_OUT + 36 + 34), f"来源 {whence}；全寺 {len(board_sp)} 块匾中未过 10% 的 {fails} 块", font=small, fill=(90, 70, 50))
    sheet.save(out, "JPEG", quality=82, optimize=True); print(out, os.path.getsize(out) // 1024, "KB")
    if "--json" in sys.argv: json.dump(report, open(sys.argv[sys.argv.index("--json") + 1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for k, v in report.items(): print(k, v["five_boards_spread_pct"], "fail", v["all_boards_failing"], "/", v["all_boards"], "at limit", "".join(v["evening_at_limit"]))

def open_font(p):
    f = TTFont(p); f.flavor = None; b = io.BytesIO(); f.save(b); return b.getvalue()

if __name__ == "__main__":
    main()
