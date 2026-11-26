#!/usr/bin/env python3
"""Cut the six typefaces the temple writes with down to the characters it actually uses.

    python3 tools/fonts.py <dir holding the original TTFs>     (needs fonttools and brotli)

Reads every character in app/ (the page and its scripts) and writes app/shared/fonts/:
    brush.woff2   Ma Shan Zheng: name boards, titles, the line under a photograph
    serif.woff2   Noto Serif SC, regular: everything that is read
    seal.woff2    Noto Serif SC, black: what is cut into a seal
    kai.woff2     LXGW WenKai: what the page says to the visitor, the labels on its controls
    bang.woff2    Yuji Boku, a heavy brush regular hand: what is written large on the name boards; cut to the
                  characters of the boards only (the strings handed to the board painter, in their old forms).
                  `python3 tools/fonts.py --bang <YujiBoku-Regular.ttf>` cuts this one alone, after a board gains a character
                  (it was LXGW WenKai TC bold from #207 to #192's reversal: the owner's 2026-11-19 correction)
    xing.woff2    Zhi Mang Xing, a running hand: what is written by hand on paper (the verse under a photograph,
                  the slip drawn in the library, the title on a leaf in a hall)
    chars.txt     the characters they hold; `npm run check` fails if the app uses one that is missing
For the Japanese and English pages (src/i18n.js), `python3 tools/fonts.py --lang ja|en <dir>` cuts their own faces to
the characters of their tables (app/locales/*.js, app/levels/t00/locales/*.js) and the page's language buttons:
    ko: serif-ko (Gowun Batang: everything that is read), brush-ko (Song Myung), hand-ko (Nanum Brush Script); chars-ko.txt,
        from GowunBatang-Regular.ttf, SongMyung-Regular.ttf, NanumBrushScript-Regular.ttf and their *-OFL.txt
    ja: kai-ja (Klee One, from which the kai was drawn), serif-ja and seal-ja (Noto Serif JP regular and black),
        brush-ja (Yuji Boku), xing-ja (Yuji Syuku); chars-ja.txt
    en: serif-en (EB Garamond), hand-en (EB Garamond italic); chars-en.txt
    from <dir>: KleeOne-Regular.ttf, NotoSerifJP.ttf (the variable font), YujiBoku-Regular.ttf, YujiSyuku-Regular.ttf,
    EBGaramond.ttf, EBGaramond-Italic.ttf (the variable fonts), each from github.com/google/fonts, with their OFL.txt
    files named KleeOne-OFL.txt, NotoSerifJP-OFL.txt, YujiSyuku-OFL.txt, EBGaramond-OFL.txt.
What is not in a language's table falls back to the Chinese faces, so the Chinese cut is not touched by it.
All of them are under the SIL Open Font License 1.1 (app/shared/fonts/OFL.txt): the brush, serif, seal, running hand and board hand from
github.com/google/fonts, the kai from github.com/lxgw/LxgwWenKai. The kai and the Korean running hand (Nanum Brush Script) are cut under the
project's own names inside the file (RENAMED), because their originals reserve their names.
The running hand has no traditional forms; the name boards, which need them, are written in the kai.
Run it again whenever words are added.
"""
import os, sys, glob, shutil, json
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
from fontTools.varLib import instancer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ALWAYS = "".join(chr(c) for c in range(0x20, 0x7F)) + "〇一二三四五六七八九十百千年月日时分春夏秋冬晨昼暮夜·，。、；：？！「」《》—…○●"

def used(skip=()):
    chars = set(ALWAYS)
    # A level's own files (levels/t00/works.js, ...) are read too; the translations (app/locales, levels/*/locales) are not
    # under these patterns, because the other languages have faces of their own.
    for path in glob.glob(f"{ROOT}/app/*.html") + glob.glob(f"{ROOT}/app/*.js") + glob.glob(f"{ROOT}/app/src/*.js") + glob.glob(f"{ROOT}/app/levels/*/*.js"):
        if os.path.basename(path) in skip: continue
        chars.update(c for c in open(path, encoding="utf-8").read() if ord(c) > 0x2000 and not 0xE000 <= ord(c) <= 0xF8FF)
    return "".join(sorted(chars))

TABLES = {l: f"app/locales/{l}.js" for l in ("ja", "en", "ko")}
# The works' cards in each language (levels/t00/locales/*.js) are written in the same faces.
WORK_TABLES = {l: sorted(glob.glob(f"{ROOT}/app/levels/*/locales/{l}.js")) for l in ("ja", "en", "ko")}   # every level's own (T00's works, T05's name)
# The language buttons are each written in their own language, so each language's cut holds its own name.
OWN_NAME = {"ja": "日本語", "en": "English", "ko": "한국어"}

def credits_keys():
    """The Chinese lines of the page of thanks (app/src/credits.js: every t("…") it writes), which are read in the kai and
    the serif and in no other face."""
    import re
    src = open(f"{ROOT}/app/src/credits.js", encoding="utf-8").read()
    return {json.loads('"' + m + '"') for m in re.findall(r'(?<![\w.$])t\(\s*"((?:[^"\\]|\\.)*)"', src)}

def table_chars(lang, works=True):
    """Every character a language's table writes (its keys are the Chinese, which the Chinese faces hold). The works'
    cards and the page of thanks are set only in the kai and the serif, so the brush, the running hand and the seal
    (works=False) leave them out; the page's title, which is drawn in the brush, is not among the credits' own lines."""
    import re
    skip = set() if works else credits_keys()
    src = open(f"{ROOT}/{TABLES[lang]}", encoding="utf-8").read() + ("".join(open(q, encoding="utf-8").read() for q in WORK_TABLES[lang]) if works else "")
    values = "".join(json.loads(f'"{v}"') for k, v in re.findall(r'^\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$', src, re.M) if json.loads(f'"{k}"') not in skip)
    return "".join(sorted(set(ALWAYS + "‘’“”–—…·「」『』" + values + OWN_NAME[lang])))

def main_lang(lang, src):
    out = f"{ROOT}/app/shared/fonts"; text = table_chars(lang) + level_chars("text", lang) + level_chars("all", lang); few = table_chars(lang, works=False) + level_chars("all", lang)
    text = "".join(sorted(set(text))); few = "".join(sorted(set(few)))
    if lang == "ja":
        cut(TTFont(f"{src}/KleeOne-Regular.ttf"), text, f"{out}/kai-ja.woff2")
        cut(TTFont(f"{src}/YujiBoku-Regular.ttf"), few, f"{out}/brush-ja.woff2")
        cut(TTFont(f"{src}/YujiSyuku-Regular.ttf"), few, f"{out}/xing-ja.woff2")
        for name, w, chars in (("serif-ja", 400, text), ("seal-ja", 900, few)):
            cut(instancer.instantiateVariableFont(TTFont(f"{src}/NotoSerifJP.ttf"), {"wght": w}), chars, f"{out}/{name}.woff2")
        licences = (("Klee One", "KleeOne"), ("Noto Serif JP", "NotoSerifJP"), ("Yuji Syuku", "YujiSyuku"))
    elif lang == "ko":
        cut(TTFont(f"{src}/GowunBatang-Regular.ttf"), text, f"{out}/serif-ko.woff2")
        cut(TTFont(f"{src}/SongMyung-Regular.ttf"), few, f"{out}/brush-ko.woff2")
        cut(TTFont(f"{src}/NanumBrushScript-Regular.ttf"), few, f"{out}/hand-ko.woff2")
        licences = (("Gowun Batang", "GowunBatang"), ("Song Myung", "SongMyung"), ("Nanum Brush Script", "NanumBrushScript"))
    else:
        cut(instancer.instantiateVariableFont(TTFont(f"{src}/EBGaramond.ttf"), {"wght": 400}), text, f"{out}/serif-en.woff2")
        cut(instancer.instantiateVariableFont(TTFont(f"{src}/EBGaramond-Italic.ttf"), {"wght": 400}), text, f"{out}/hand-en.woff2")
        licences = (("EB Garamond", "EBGaramond"),)
    have = open(f"{out}/OFL.txt", encoding="utf-8").read()
    with open(f"{out}/OFL.txt", "a", encoding="utf-8") as f:
        for name, file in licences:
            if f"---- {name} ----" not in have: f.write(f"\n\n---- {name} ----\n\n" + open(f"{src}/{file}-OFL.txt", encoding="utf-8").read())
    open(f"{out}/chars-{lang}.txt", "w", encoding="utf-8").write(text)
    print(len(text), "characters")

def level_chars(tier, key):
    """What a level lists in its own app/levels/<id>/font-chars.json for characters it has not written down yet (T05's temple name,
    its terms): tier "all" (drawn large: every face of the language), "text" (read: the kai and the serif only) or "bang" (the name
    boards; key ignored). Empty when no level has the file."""
    out = ""
    for path in sorted(glob.glob(f"{ROOT}/app/levels/*/font-chars.json")):
        part = json.load(open(path, encoding="utf-8")).get(tier, "")
        out += part if isinstance(part, str) else part.get(key, "")
    return out

def boards():
    """The characters that are written on name boards: every string given to the board painter, old forms included,
    and the lettering cast on the censer."""
    import re
    src = "".join(open(p, encoding="utf-8").read() for p in glob.glob(f"{ROOT}/app/src/*.js"))
    text = "".join(re.findall(r'makePlaque\([^)]*\)', src) + re.findall(r'plaque: "[^"]+"', src) + re.findall(r'plaque: \{[^}]*\}', src))
    text += "".join(re.findall(r'export const CAST = Object\.freeze\(\{[^}]*\}', src))   # what is cast on the censer (censer.js), in the same hand
    old = dict(re.findall(r'(\S): "(\S)"', re.search(r'const OLD = \{([^}]*)\}', src).group(1)))
    text += "".join(old.values()) + "佛鑑正法雲徑禪寺"
    text += level_chars("bang", None)   # a level's boards not yet drawn in code (font-chars.json)
    return "".join(sorted({c for c in text if ord(c) > 0x2E80}))

# The two originals that declare a Reserved Font Name (LXGW WenKai: '霞鹜', '霞鶩', '落霞孤鹜', '落霞孤鶩', 'LXGW'; Nanum Brush Script:
# Nanum, Naver Nanum, NanumBrush, ...). A subset is a Modified Version and may not carry it, so these two are cut under the
# project's own names. The page already calls every face "Yunjing …" in CSS; only the name inside the file changes. The
# copyright, licence and designer records are left exactly as the original has them. tests/unit/fonts.test.mjs checks it.
RENAMED = {
    "kai.woff2": ("Yunjing Kai", "YunjingKai-Regular"),
    "hand-ko.woff2": ("Yunjing Hand KO", "YunjingHandKO-Regular"),
}

def rename(font, family, postscript):
    """Give a font the project's own name: family (1), full name (4), unique id (3, keeping the version), PostScript name (6);
    the trademark line (7), which names the original's mark, is dropped. The typographic names (16, 17, 21, 22, 25) are dropped too."""
    table = font["name"]; unique = table.getDebugName(3) or ""; version = unique.split(":", 1)[1] if ":" in unique else (table.getDebugName(5) or "1.0")
    version = version.split(";")[0].strip()
    for nid in (7, 16, 17, 21, 22, 25): table.removeNames(nameID=nid)
    for nid, text in ((1, family), (3, f"{family}:{version}"), (4, family), (6, postscript)):
        for rec in [r for r in table.names if r.nameID == nid]: rec.string = text
    return font

def rename_existing():
    """Rename the files already cut, in place, for a checkout that has no originals at hand (python3 tools/fonts.py --rename)."""
    out = f"{ROOT}/app/shared/fonts"
    for name, (family, ps) in RENAMED.items():
        font = TTFont(f"{out}/{name}"); font.flavor = None; font = rename(font, family, ps); font.flavor = "woff2"; font.save(f"{out}/{name}")
        print(f"{name}: now {family}")

def cut(font, text, out):
    o = Options(); o.flavor = "woff2"; o.layout_features = ["*"]; o.name_IDs = ["*"]; o.notdef_outline = True
    s = Subsetter(o); s.populate(text=text); s.subset(font)
    if os.path.basename(out) in RENAMED: rename(font, *RENAMED[os.path.basename(out)])
    font.flavor = "woff2"; font.save(out)
    print(f"{os.path.basename(out):12s} {os.path.getsize(out) // 1024:4d} KB")

def main():
    src, out = sys.argv[1], f"{ROOT}/app/shared/fonts"; os.makedirs(out, exist_ok=True)
    text = "".join(sorted(set(used() + level_chars("text", "zh") + level_chars("all", "zh"))))
    few = "".join(sorted(set(used(skip=("works.js", "credits.js")) + level_chars("all", "zh"))))   # the encyclopedia notes and the page of thanks are set in the kai and the serif only
    cut(TTFont(f"{src}/mashanzheng_MaShanZheng-Regular.ttf"), few, f"{out}/brush.woff2")
    cut(TTFont(f"{src}/lxgwwenkai_LXGWWenKai-Regular.ttf"), text, f"{out}/kai.woff2")
    cut(TTFont(f"{src}/zhimangxing_ZhiMangXing-Regular.ttf"), few, f"{out}/xing.woff2")
    cut(TTFont(f"{src}/yujiboku_YujiBoku-Regular.ttf"), boards(), f"{out}/bang.woff2"); print("boards:", boards())
    for name, w in (("serif", 400), ("seal", 900)):
        cut(instancer.instantiateVariableFont(TTFont(f"{src}/notoserifsc_NotoSerifSC[wght].ttf"), {"wght": w}), text if name == "serif" else few, f"{out}/{name}.woff2")
    open(f"{out}/chars.txt", "w", encoding="utf-8").write(text)
    shutil.copy(f"{src}/notoserifsc_OFL.txt", f"{out}/OFL.txt")
    with open(f"{out}/OFL.txt", "a") as f: f.write("\n\n---- Ma Shan Zheng ----\n\n" + open(f"{src}/mashanzheng_OFL.txt").read())
    with open(f"{out}/OFL.txt", "a") as f: f.write("\n\n---- LXGW WenKai ----\n\n" + open(f"{src}/lxgwwenkai_OFL.txt").read())
    with open(f"{out}/OFL.txt", "a") as f: f.write("\n\n---- Zhi Mang Xing ----\n\n" + open(f"{src}/zhimangxing_OFL.txt").read())
    with open(f"{out}/OFL.txt", "a") as f: f.write("\n\n---- Yuji Boku ----\n\n" + open(f"{src}/yujiboku_OFL.txt").read())
    print(len(text), "characters")

if __name__ == "__main__":
    if sys.argv[1] == "--lang": main_lang(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "--rename": rename_existing()
    elif sys.argv[1] == "--bang": cut(TTFont(sys.argv[2]), boards(), f"{ROOT}/app/shared/fonts/bang.woff2"); print("boards:", boards())
    else: main()
