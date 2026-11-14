#!/usr/bin/env python3
"""Cut the five typefaces the temple writes with down to the characters it actually uses.

    python3 tools/fonts.py <dir holding the original TTFs>     (needs fonttools and brotli)

Reads every character in app/ (the page and its scripts) and writes app/f/:
    brush.woff2   Ma Shan Zheng: name boards, titles, the line under a photograph
    serif.woff2   Noto Serif SC, regular: everything that is read
    seal.woff2    Noto Serif SC, black: what is cut into a seal
    kai.woff2     LXGW WenKai: what the page says to the visitor, the labels on its controls
    xing.woff2    Zhi Mang Xing, a running hand: what is written by hand on paper (the verse under a photograph,
                  the slip drawn in the library, the title on a leaf in a hall)
    chars.txt     the characters they hold; `npm run check` fails if the app uses one that is missing
All five are under the SIL Open Font License 1.1 (app/f/OFL.txt): the brush, serif, seal and running hand from
github.com/google/fonts, the kai from github.com/lxgw/LxgwWenKai (cut down for the web only, as its licence asks).
The running hand has no traditional forms; the name boards, which need them, are written in the kai.
Run it again whenever words are added.
"""
import os, sys, glob, shutil
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
from fontTools.varLib import instancer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ALWAYS = "".join(chr(c) for c in range(0x20, 0x7F)) + "〇一二三四五六七八九十百千年月日时分春夏秋冬晨昼暮夜·，。、；：？！「」《》—…○●"

def used():
    chars = set(ALWAYS)
    for path in glob.glob(f"{ROOT}/app/*.html") + glob.glob(f"{ROOT}/app/*.js") + glob.glob(f"{ROOT}/app/src/*.js"):
        chars.update(c for c in open(path, encoding="utf-8").read() if ord(c) > 0x2000 and not 0xE000 <= ord(c) <= 0xF8FF)
    return "".join(sorted(chars))

def cut(font, text, out):
    o = Options(); o.flavor = "woff2"; o.layout_features = ["*"]; o.name_IDs = ["*"]; o.notdef_outline = True
    s = Subsetter(o); s.populate(text=text); s.subset(font); font.flavor = "woff2"; font.save(out)
    print(f"{os.path.basename(out):12s} {os.path.getsize(out) // 1024:4d} KB")

def main():
    src, out = sys.argv[1], f"{ROOT}/app/f"; os.makedirs(out, exist_ok=True); text = used()
    cut(TTFont(f"{src}/mashanzheng_MaShanZheng-Regular.ttf"), text, f"{out}/brush.woff2")
    cut(TTFont(f"{src}/lxgwwenkai_LXGWWenKai-Regular.ttf"), text, f"{out}/kai.woff2")
    cut(TTFont(f"{src}/zhimangxing_ZhiMangXing-Regular.ttf"), text, f"{out}/xing.woff2")
    for name, w in (("serif", 400), ("seal", 900)):
        cut(instancer.instantiateVariableFont(TTFont(f"{src}/notoserifsc_NotoSerifSC[wght].ttf"), {"wght": w}), text, f"{out}/{name}.woff2")
    open(f"{out}/chars.txt", "w", encoding="utf-8").write(text)
    shutil.copy(f"{src}/notoserifsc_OFL.txt", f"{out}/OFL.txt")
    with open(f"{out}/OFL.txt", "a") as f: f.write("\n\n---- Ma Shan Zheng ----\n\n" + open(f"{src}/mashanzheng_OFL.txt").read())
    with open(f"{out}/OFL.txt", "a") as f: f.write("\n\n---- LXGW WenKai ----\n\n" + open(f"{src}/lxgwwenkai_OFL.txt").read())
    with open(f"{out}/OFL.txt", "a") as f: f.write("\n\n---- Zhi Mang Xing ----\n\n" + open(f"{src}/zhimangxing_OFL.txt").read())
    print(len(text), "characters")

if __name__ == "__main__":
    main()
