#!/usr/bin/env python3
"""Compare a recut of the typefaces with the cut before it: only characters may be added.

    python3 -I tools/fonts-diff.py <dir holding the earlier *.woff2> [<dir holding the new ones, default app/shared/fonts>]

For every .woff2 in the first directory, and for every character it held:
  - the outline (the drawing operations of its glyph with any components expanded, hashed), the advance width and the left side bearing are the same;
  - the table-wide metrics are the same (units per em, hhea and OS/2 ascent, descent and line gap, x-height and cap height);
  - the names are the same (family, version, unique id, PostScript name, copyright, licence), so a Reserved Font Name
    that was renamed stays renamed and no licence text changes.
It lists the characters added to each file and the change in size, and exits 1 on a character removed or changed. Pairs
that kern are not compared one by one: the cutter keeps the font's own GPOS for the glyphs it keeps, which is what this
checks by the glyph's drawing and its metrics only.
Needs fonttools and brotli; run it with -I so that nothing in the current directory is imported."""
import sys, os, glob, hashlib
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen

NAMES = (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17)

def glyph_hash(font, name):
    # components are expanded first: a cut renumbers the glyphs a composite refers to (ring → glyph00902), the drawing is the same
    glyphs = font.getGlyphSet(); pen = DecomposingRecordingPen(glyphs); glyphs[name].draw(pen)
    return hashlib.sha256(repr(pen.value).encode()).hexdigest()

def metrics(font):
    o = font["OS/2"]; h = font["hhea"]
    return {"upm": font["head"].unitsPerEm, "hhea": (h.ascent, h.descent, h.lineGap), "typo": (o.sTypoAscender, o.sTypoDescender, o.sTypoLineGap),
            "win": (o.usWinAscent, o.usWinDescent), "x": getattr(o, "sxHeight", None), "cap": getattr(o, "sCapHeight", None)}

def names(font):
    return {nid: font["name"].getDebugName(nid) for nid in NAMES}

def main(before, after):
    bad = 0; total_before = total_after = 0
    for path in sorted(glob.glob(os.path.join(before, "*.woff2"))):
        file = os.path.basename(path); new_path = os.path.join(after, file)
        old, new = TTFont(path), TTFont(new_path)
        oc, nc = old.getBestCmap(), new.getBestCmap(); og, ng = old["hmtx"], new["hmtx"]
        removed = [c for c in oc if c not in nc]
        changed = []
        for c, gn in oc.items():
            if c not in nc: continue
            n2 = nc[c]
            if glyph_hash(old, gn) != glyph_hash(new, n2) or og[gn] != ng[n2]: changed.append(c)
        added = sorted(c for c in nc if c not in oc)
        m_same = metrics(old) == metrics(new); n_same = names(old) == names(new)
        sb, sa = os.path.getsize(path), os.path.getsize(new_path); total_before += sb; total_after += sa
        ok = not removed and not changed and m_same and n_same
        bad += not ok
        print(f"{file:15s} {len(oc):5d} chars -> {len(nc):5d}  +{len(added):3d}  {sb / 1024:7.1f} -> {sa / 1024:7.1f} KB ({(sa - sb) / 1024:+6.1f})  "
              f"{'ok' if ok else 'FAIL'}  removed {len(removed)}, outline/advance changed {len(changed)}, metrics {'same' if m_same else 'DIFFER'}, names {'same' if n_same else 'DIFFER'}")
        if added: print("   added:", "".join(chr(c) for c in added))
        if not ok: print("   removed:", "".join(chr(c) for c in removed)[:80], "| changed:", "".join(chr(c) for c in changed)[:80])
    print(f"total {total_before / 1024:.1f} -> {total_after / 1024:.1f} KB ({(total_after - total_before) / 1024:+.1f} KB, {(total_after - total_before) / max(total_before, 1) * 100:+.1f}%)")
    return 1 if bad else 0

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    sys.exit(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "shared", "fonts")))
