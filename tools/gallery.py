#!/usr/bin/env python3
"""Hang the real works in the halls: pack the pictures and write what is known about each.

    python3 tools/gallery.py <dir holding the collected works>      (needs Pillow)

The works are things that survive from the temple this place is drawn from, or show what one of its halls is for:
letters and large characters by Jingshan's abbots, paintings of the Chan school, the tea bowls of its time. Each
comes from a museum that publishes it for free reuse: ColBase (Japan's National Institutes for Cultural Heritage;
the source line it asks for is kept with each work) or the Metropolitan Museum's Open Access (public domain).
The directory holds one folder per work with `source.jpg` and `meta.json` (title, maker, period, holder, the
encyclopedia note, the credit line, the page it came from) and an `index.json` of them all.

Writes app/levels/t00/gallery/<slug>.webp (the longest side 1280) and app/src/works.js (what the halls and the reading card use).
Which work hangs in which hall, and in what order along the walls, is the HANG table below.
"""
import json, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
HANG = {
    "main": ["wuzhun-shijia-baodian", "liangkai-chushan-shijia", "liangkai-liuzu-jiezhu"],
    "chan": ["yuanwu-yinkezhuang", "xutang-poxutang", "met-qilv-tu"],
    "tea": ["wuzhun-tang", "jianyao-hemu-tianmu", "jianyao-youdi-tianmu"],
    "library": ["zhangjizhi-huayanjing", "songban-yuanwu-xinyao"],
    "yaoshi": ["met-yaoshi-fohui"],
    "dahui": ["dahui-wuxiang-chidu", "wuzhun-bandu-chidu", "chijue-bayu"],
    "guanyin": ["baiyi-guanyin"],
    "lingxiao": ["met-zhangjizhi-leyouyuan"],
}
# Where a photograph shows more than the work (a gallery with benches, a brocade mount), the part to keep: left, top, right, bottom.
CROP = {"met-yaoshi-fohui": (0.015, 0.05, 0.985, 0.672)}

def main():
    src = sys.argv[1]; out = f"{ROOT}/app/levels/t00/gallery"; os.makedirs(out, exist_ok=True)
    works = {m["slug"]: m for m in json.load(open(f"{src}/index.json", encoding="utf-8"))}
    data = {}
    for hall, slugs in HANG.items():
        for slug in slugs:
            m = works[slug]; im = Image.open(f"{src}/{slug}/source.jpg").convert("RGB")
            if slug in CROP: l, t, r, b = CROP[slug]; im = im.crop((round(im.width * l), round(im.height * t), round(im.width * r), round(im.height * b)))
            k = 1280 / max(im.size)
            if k < 1: im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            im.save(f"{out}/{slug}.webp", quality=80, method=6)
            rank = m.get("designation") or ""; rank = "" if rank == "none" else rank
            data[slug] = {"title": m["title_zh"], "by": m["artist_zh"], "dates": m.get("artist_dates") or "", "period": m["period_zh"], "medium": m["medium_zh"],
                          "size": m.get("size_cm") or "", "holder": m["holder_zh"], "rank": rank, "note": m["note_zh"], "link": m["jingshan_link_zh"],
                          "credit": m["credit_line"], "url": m["page_url"], "w": im.width, "h": im.height}
            print(f"{slug:28s} {im.width}x{im.height} {os.path.getsize(f'{out}/{slug}.webp') // 1024:4d} KB  {hall}")
    js = ("// The real works that hang in the halls: written by tools/gallery.py from the museums' own records. Do not edit by hand.\n"
          "// Each is published for free reuse by the museum that holds it; `credit` is the source line to show with it.\n"
          "export const HANG = " + json.dumps(HANG, ensure_ascii=False) + ";\n"
          "export const WORKS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    open(f"{ROOT}/app/src/works.js", "w", encoding="utf-8").write(js)
    print(sum(os.path.getsize(f"{out}/{f}") for f in os.listdir(out)) // 1024, "KB in app/levels/t00/gallery")

if __name__ == "__main__":
    main()
